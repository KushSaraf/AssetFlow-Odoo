import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async createCycle(data: any) {
    const { auditor_ids, start_date, end_date, ...cycleData } = data;

    const where: any = {};
    if (data.scope_department_id)
      where.department_id = data.scope_department_id;
    if (data.scope_location) where.location = data.scope_location;

    const assetsInScope = await this.prisma.asset.findMany({
      where,
      select: { id: true },
    });

    const cycle = await this.prisma.$transaction(async (tx) => {
      return tx.audit_cycle.create({
        data: {
          ...cycleData,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          assignments: {
            create: auditor_ids.map((id: string) => ({ auditor_id: id })),
          },
        },
      });
    });

    return { ...cycle, assets_in_scope: assetsInScope.length };
  }

  async findAll(user: any) {
    const where: any = {};
    if (user.role === 'Employee') {
      where.assignments = { some: { auditor_id: user.id } };
    }
    return this.prisma.audit_cycle.findMany({ where });
  }

  async findOne(id: string, user: any) {
    const cycle = await this.prisma.audit_cycle.findUnique({
      where: { id },
      include: { findings: true, assignments: true },
    });
    if (!cycle) throw new NotFoundException();
    return cycle;
  }

  async recordFinding(id: string, user: any, data: any) {
    if (data.result !== 'Verified' && !data.notes) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Notes are required if result is not Verified',
          field: 'notes',
        },
      });
    }

    return this.prisma.audit_finding.create({
      data: {
        cycle_id: id,
        asset_id: data.asset_id,
        result: data.result,
        notes: data.notes,
        recorded_by: user.id,
      },
    });
  }

  async getDiscrepancies(id: string) {
    return this.prisma.audit_finding.findMany({
      where: {
        cycle_id: id,
        result: { in: ['Missing', 'Damaged'] },
      },
      include: { asset: true, recorder: true },
    });
  }

  async closeCycle(id: string) {
    const cycle = await this.prisma.audit_cycle.findUnique({
      where: { id },
      include: { findings: true },
    });
    if (!cycle) throw new NotFoundException();

    return this.prisma.$transaction(async (tx) => {
      for (const finding of cycle.findings) {
        if (finding.result === 'Missing') {
          await tx.asset.update({
            where: { id: finding.asset_id },
            data: { status: 'Lost' },
          });
        } else if (finding.result === 'Damaged') {
          await tx.maintenance_request.create({
            data: {
              asset_id: finding.asset_id,
              raised_by: finding.recorded_by,
              issue: `Auto-generated from Audit Cycle (Damaged): ${finding.notes || ''}`,
              priority: 'High',
              source_audit_finding_id: finding.id,
            },
          });
        }
      }

      return tx.audit_cycle.update({
        where: { id },
        data: { status: 'Closed', closed_at: new Date() },
      });
    });
  }
}
