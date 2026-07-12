import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: any, user: any) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.asset_id) where.asset_id = filters.asset_id;

    // Role scoping (ui-spec §2): Employee sees own; Dept Head sees dept.
    if (user.role === 'Employee') {
      where.raised_by = user.id;
    } else if (user.role === 'Department Head') {
      where.OR = [
        { raised_by: user.id },
        { asset: { department_id: user.department_id } },
      ];
    }

    return this.prisma.maintenance_request.findMany({
      where,
      include: { asset: true, raiser: true, approver: true },
    });
  }

  async create(user: any, data: any) {
    if (!data.issue) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Describe the issue before submitting.',
          field: 'issue',
        },
      });
    }
    if (!data.priority) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Select a priority.',
          field: 'priority',
        },
      });
    }

    // Only the current holder may raise a request, unless Asset Manager/Admin
    // (ui-spec §3 Screen 7 request form scope).
    if (!['Admin', 'Asset Manager'].includes(user.role)) {
      const holds = await this.prisma.allocation.findFirst({
        where: {
          asset_id: data.asset_id,
          returned_at: null,
          OR: [
            { employee_id: user.id },
            ...(user.department_id
              ? [{ department_id: user.department_id }]
              : []),
          ],
        },
      });
      if (!holds) {
        throw new ForbiddenException({
          error: {
            code: 'forbidden',
            message:
              'You can only raise maintenance requests for assets allocated to you.',
          },
        });
      }
    }

    const request = await this.prisma.maintenance_request.create({
      data: {
        asset_id: data.asset_id,
        raised_by: user.id,
        issue: data.issue,
        priority: data.priority,
      },
    });

    await this.prisma.logActivity(
      user.id,
      'raised_maintenance',
      'maintenance_request',
      request.id,
    );

    return request;
  }

  private async getOrThrow(id: string) {
    const req = await this.prisma.maintenance_request.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!req) throw new NotFoundException();
    return req;
  }

  private assertStatus(req: { status: string }, allowed: string[]) {
    if (!allowed.includes(req.status)) {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: `This action requires the request to be ${allowed.join(' or ')} (currently ${req.status}).`,
        },
      });
    }
  }

  async approve(id: string, user: any) {
    const req = await this.getOrThrow(id);
    this.assertStatus(req, ['Pending']);

    return this.prisma.$transaction(async (tx) => {
      // Critical side effect (ui-spec §3 Screen 7): approval is the exact
      // moment the asset flips to Under Maintenance.
      await tx.asset.update({
        where: { id: req.asset_id },
        data: { status: 'Under Maintenance' },
      });
      const updated = await tx.maintenance_request.update({
        where: { id },
        data: { status: 'Approved', approver_id: user.id },
      });

      await tx.notification.create({
        data: {
          recipient_id: req.raised_by,
          type: 'MaintenanceApproved',
          payload: {
            message: `Your maintenance request for ${req.asset.name} (${req.asset.tag}) has been approved.`,
            maintenance_request_id: id,
          },
        },
      });

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'approved_maintenance',
          entity_type: 'maintenance_request',
          entity_id: id,
        },
      });

      return updated;
    });
  }

  async reject(id: string, user: any, reason: string) {
    if (!reason) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Add a reason for rejecting this request.',
          field: 'reason',
        },
      });
    }
    const req = await this.getOrThrow(id);
    this.assertStatus(req, ['Pending']);

    const update = await this.prisma.maintenance_request.update({
      where: { id },
      data: {
        status: 'Rejected',
        approver_id: user.id,
        resolution_notes: reason,
      },
    });

    await this.prisma.notification.create({
      data: {
        recipient_id: req.raised_by,
        type: 'MaintenanceRejected',
        payload: {
          message: `Your maintenance request for ${req.asset.name} (${req.asset.tag}) was rejected. Reason: ${reason}`,
          maintenance_request_id: id,
        },
      },
    });

    await this.prisma.logActivity(
      user.id,
      'rejected_maintenance',
      'maintenance_request',
      id,
    );

    return update;
  }

  async assignTechnician(id: string, user: any, technician: string) {
    if (!technician) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Provide a technician name.',
          field: 'technician',
        },
      });
    }
    const req = await this.getOrThrow(id);
    this.assertStatus(req, ['Approved']);

    const updated = await this.prisma.maintenance_request.update({
      where: { id },
      data: { status: 'Technician Assigned', technician },
    });
    await this.prisma.logActivity(
      user.id,
      'assigned_technician',
      'maintenance_request',
      id,
    );
    return updated;
  }

  async start(id: string, user: any) {
    const req = await this.getOrThrow(id);
    this.assertStatus(req, ['Technician Assigned']);

    const updated = await this.prisma.maintenance_request.update({
      where: { id },
      data: { status: 'In Progress' },
    });
    await this.prisma.logActivity(
      user.id,
      'started_maintenance',
      'maintenance_request',
      id,
    );
    return updated;
  }

  async resolve(id: string, user: any, resolution_notes: string) {
    if (!resolution_notes) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Add resolution notes before resolving.',
          field: 'resolution_notes',
        },
      });
    }
    const req = await this.getOrThrow(id);
    this.assertStatus(req, ['Technician Assigned', 'In Progress']);

    return this.prisma.$transaction(async (tx) => {
      const openAllocation = await tx.allocation.findFirst({
        where: { asset_id: req.asset_id, returned_at: null },
      });

      // Reverts to prior status: Allocated if an open allocation exists,
      // else Available (ui-spec §5).
      const nextStatus = openAllocation ? 'Allocated' : 'Available';

      await tx.asset.update({
        where: { id: req.asset_id },
        data: { status: nextStatus },
      });

      const updated = await tx.maintenance_request.update({
        where: { id },
        data: { status: 'Resolved', resolved_at: new Date(), resolution_notes },
      });

      // Notify requester + current holder (§6 catalog)
      const recipients = new Set(
        [req.raised_by, openAllocation?.employee_id].filter(
          (r): r is string => !!r,
        ),
      );
      for (const recipient_id of recipients) {
        await tx.notification.create({
          data: {
            recipient_id,
            type: 'MaintenanceResolved',
            payload: {
              message: `Maintenance for ${req.asset.name} (${req.asset.tag}) is now resolved.`,
              maintenance_request_id: id,
            },
          },
        });
      }

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'resolved_maintenance',
          entity_type: 'maintenance_request',
          entity_id: id,
        },
      });

      return updated;
    });
  }
}
