import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: any, user: any) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.asset_id) where.asset_id = filters.asset_id;

    if (user.role === 'Employee') {
      where.raised_by = user.id;
    }

    return this.prisma.maintenance_request.findMany({
      where,
      include: { asset: true, raiser: true, approver: true },
    });
  }

  async create(user: any, data: any) {
    return this.prisma.maintenance_request.create({
      data: {
        asset_id: data.asset_id,
        raised_by: user.id,
        issue: data.issue,
        priority: data.priority,
      },
    });
  }

  async approve(id: string, user: any) {
    const req = await this.prisma.maintenance_request.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException();

    return this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: req.asset_id },
        data: { status: 'Under Maintenance' },
      });
      const updated = await tx.maintenance_request.update({
        where: { id },
        data: { status: 'Approved', approver_id: user.id },
      });

      const asset = await tx.asset.findUnique({ where: { id: req.asset_id } });
      if (asset) {
        await tx.notification.create({
          data: {
            recipient_id: req.raised_by,
            type: 'MaintenanceApproved',
            payload: { message: `Your maintenance request for ${asset.name} (${asset.tag}) has been approved.` },
          },
        });
      }

      return updated;
    });
  }

  async reject(id: string, user: any, reason: string) {
    const req = await this.prisma.maintenance_request.findUnique({ where: { id }, include: { asset: true } });
    
    const update = await this.prisma.maintenance_request.update({
      where: { id },
      data: {
        status: 'Rejected',
        approver_id: user.id,
        resolution_notes: reason,
      },
    });

    if (req && req.asset) {
      await this.prisma.notification.create({
        data: {
          recipient_id: req.raised_by,
          type: 'MaintenanceRejected',
          payload: { message: `Your maintenance request for ${req.asset.name} (${req.asset.tag}) was rejected.` },
        },
      });
    }

    return update;
  }

  async assignTechnician(id: string, technician: string) {
    return this.prisma.maintenance_request.update({
      where: { id },
      data: { status: 'Technician Assigned', technician },
    });
  }

  async start(id: string) {
    return this.prisma.maintenance_request.update({
      where: { id },
      data: { status: 'In Progress' },
    });
  }

  async resolve(id: string, resolution_notes: string) {
    const req = await this.prisma.maintenance_request.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException();

    return this.prisma.$transaction(async (tx) => {
      const openAllocation = await tx.allocation.findFirst({
        where: { asset_id: req.asset_id, returned_at: null },
      });

      const nextStatus = openAllocation ? 'Allocated' : 'Available';

      await tx.asset.update({
        where: { id: req.asset_id },
        data: { status: nextStatus },
      });

      const updated = await tx.maintenance_request.update({
        where: { id },
        data: { status: 'Resolved', resolved_at: new Date(), resolution_notes },
      });

      const asset = await tx.asset.findUnique({ where: { id: req.asset_id } });
      if (asset) {
        await tx.notification.create({
          data: {
            recipient_id: req.raised_by,
            type: 'MaintenanceResolved',
            payload: { message: `Maintenance for ${asset.name} (${asset.tag}) is now resolved.` },
          },
        });
      }

      return updated;
    });
  }
}
