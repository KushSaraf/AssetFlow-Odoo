import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async createCycle(user: any, data: any) {
    const { auditor_ids, start_date, end_date, ...cycleData } = data;

    if (!cycleData.name) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Give the audit cycle a name.',
          field: 'name',
        },
      });
    }
    if (!Array.isArray(auditor_ids) || auditor_ids.length === 0) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Assign at least one auditor before saving.',
          field: 'auditor_ids',
        },
      });
    }
    if (!start_date || !end_date) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Provide a start and end date.',
          field: 'start_date',
        },
      });
    }

    const where: any = {};
    if (data.scope_department_id)
      where.department_id = data.scope_department_id;
    if (data.scope_location) where.location = data.scope_location;

    const assetsInScope = await this.prisma.asset.findMany({
      where,
      select: { id: true },
    });

    const cycle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.audit_cycle.create({
        data: {
          ...cycleData,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          status: 'In Progress',
          assignments: {
            create: auditor_ids.map((id: string) => ({ auditor_id: id })),
          },
        },
      });

      // Auditor Assigned notifications (ui-spec §6 catalog)
      for (const auditorId of auditor_ids) {
        await tx.notification.create({
          data: {
            recipient_id: auditorId,
            type: 'AuditorAssigned',
            payload: {
              message: `You have been assigned as an auditor on "${created.name}".`,
              audit_cycle_id: created.id,
            },
          },
        });
      }

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'created_audit_cycle',
          entity_type: 'audit_cycle',
          entity_id: created.id,
        },
      });

      return created;
    });

    return { ...cycle, assets_in_scope: assetsInScope.length };
  }

  async findAll(user: any) {
    const where: any = {};
    if (user.role === 'Department Head') {
      where.scope_department_id = user.department_id;
    }
    return this.prisma.audit_cycle.findMany({
      where,
      include: { assignments: { include: { auditor: true } } },
    });
  }

  async findOne(id: string, user: any) {
    const cycle = await this.prisma.audit_cycle.findUnique({
      where: { id },
      include: {
        findings: {
          include: {
            asset: true,
            recorder: true,
          },
        },
        assignments: {
          include: {
            auditor: true,
          },
        },
        department: true,
      },
    });
    if (!cycle) throw new NotFoundException();

    // Fetch assets in scope
    const where: any = {};
    if (cycle.scope_department_id) {
      where.department_id = cycle.scope_department_id;
    }
    if (cycle.scope_location) {
      where.location = cycle.scope_location;
    }

    const assets = await this.prisma.asset.findMany({ where });
    const checklist = assets.map((asset) => ({
      id: asset.id,
      asset,
    }));

    return {
      ...cycle,
      checklist,
    };
  }

  async recordFinding(id: string, user: any, data: any) {
    if (data.result !== 'Verified' && !data.notes) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Add a note explaining the discrepancy.',
          field: 'notes',
        },
      });
    }

    const cycle = await this.prisma.audit_cycle.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!cycle) throw new NotFoundException();
    if (cycle.status === 'Closed') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'This audit cycle is closed — findings can no longer be edited.',
        },
      });
    }
    // Only assigned auditors (or Admin) record findings.
    const isAuditor = cycle.assignments.some((a) => a.auditor_id === user.id);
    if (!isAuditor && user.role !== 'Admin') {
      throw new ForbiddenException({
        error: {
          code: 'forbidden',
          message: 'Only auditors assigned to this cycle can record findings.',
        },
      });
    }

    // Re-marking an asset replaces the earlier finding for it in this cycle.
    const finding = await this.prisma.$transaction(async (tx) => {
      await tx.audit_finding.deleteMany({
        where: { cycle_id: id, asset_id: data.asset_id },
      });
      return tx.audit_finding.create({
        data: {
          cycle_id: id,
          asset_id: data.asset_id,
          result: data.result,
          notes: data.notes,
          recorded_by: user.id,
        },
        include: { asset: true },
      });
    });

    // Audit Discrepancy Flagged → Asset Managers + asset's current holder (§6)
    if (finding.result !== 'Verified') {
      const holder = await this.prisma.allocation.findFirst({
        where: { asset_id: finding.asset_id, returned_at: null },
      });
      const assetManagers = await this.prisma.employee.findMany({
        where: { role: 'Asset Manager', status: 'Active' },
        select: { id: true },
      });
      const recipients = new Set(
        [...assetManagers.map((m) => m.id), holder?.employee_id].filter(
          (r): r is string => !!r,
        ),
      );
      for (const recipient_id of recipients) {
        await this.prisma.notification.create({
          data: {
            recipient_id,
            type: 'AuditDiscrepancyFlagged',
            payload: {
              message: `Audit finding: ${finding.asset.name} (${finding.asset.tag}) marked ${finding.result} in "${cycle.name}".`,
              audit_cycle_id: id,
            },
          },
        });
      }
    }

    await this.prisma.logActivity(
      user.id,
      'recorded_finding',
      'audit_finding',
      finding.id,
    );

    return finding;
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

  async closeCycle(id: string, user: any) {
    const cycle = await this.prisma.audit_cycle.findUnique({
      where: { id },
      include: { findings: true, assignments: true },
    });
    if (!cycle) throw new NotFoundException();
    if (cycle.status === 'Closed') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'This audit cycle is already closed.',
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const finding of cycle.findings) {
        if (finding.result === 'Missing') {
          // Close-cycle side effect (ui-spec §5): Missing → Lost.
          await tx.asset.update({
            where: { id: finding.asset_id },
            data: { status: 'Lost' },
          });
        } else if (finding.result === 'Damaged') {
          // Damaged routes into the maintenance workflow instead of a
          // direct status change; skip if one was already auto-created.
          const existing = await tx.maintenance_request.findUnique({
            where: { source_audit_finding_id: finding.id },
          });
          if (!existing) {
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
      }

      const closed = await tx.audit_cycle.update({
        where: { id },
        data: { status: 'Closed', closed_at: new Date() },
      });

      // Audit Cycle Closed → all auditors + Admins (§6 catalog)
      const admins = await tx.employee.findMany({
        where: { role: 'Admin', status: 'Active' },
        select: { id: true },
      });
      const recipients = new Set([
        ...cycle.assignments.map((a) => a.auditor_id),
        ...admins.map((a) => a.id),
      ]);
      for (const recipient_id of recipients) {
        await tx.notification.create({
          data: {
            recipient_id,
            type: 'AuditCycleClosed',
            payload: {
              message: `Audit cycle "${cycle.name}" has been closed.`,
              audit_cycle_id: id,
            },
          },
        });
      }

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'closed_audit_cycle',
          entity_type: 'audit_cycle',
          entity_id: id,
        },
      });

      return closed;
    });
  }
}
