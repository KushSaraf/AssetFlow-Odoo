import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AllocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, filters: any) {
    const where: any = {};
    if (filters.asset_id) where.asset_id = filters.asset_id;
    if (filters.employee_id) where.employee_id = filters.employee_id;
    if (filters.department_id) where.department_id = filters.department_id;

    if (filters.status === 'open') {
      where.returned_at = null;
    } else if (filters.status === 'closed') {
      where.returned_at = { not: null };
    }

    if (filters.overdue === 'true') {
      where.returned_at = null;
      where.expected_return_date = { lt: new Date() };
    }

    if (user.role === 'Employee') {
      where.employee_id = user.id;
    }

    return this.prisma.allocation.findMany({
      where,
      include: { asset: true, employee: true, department: true },
    });
  }

  async create(
    user: any,
    data: {
      asset_id: string;
      employee_id?: string;
      department_id?: string;
      expected_return_date?: string;
    },
  ) {
    const openAllocation = await this.prisma.allocation.findFirst({
      where: { asset_id: data.asset_id, returned_at: null },
      include: { employee: true, department: true },
    });

    if (openAllocation) {
      throw new ConflictException({
        error: {
          code: 'already_allocated',
          message: 'Asset is already allocated',
          meta: { current_holder: openAllocation },
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.allocation.create({
        data: {
          asset_id: data.asset_id,
          employee_id: data.employee_id,
          department_id: data.department_id,
          allocated_by: user.id,
          expected_return_date: data.expected_return_date
            ? new Date(data.expected_return_date)
            : null,
        },
      });

      await tx.asset.update({
        where: { id: data.asset_id },
        data: { status: 'Allocated' },
      });

      return allocation;
    });
  }

  async returnAsset(
    id: string,
    data: { condition_in?: string; checkin_notes?: string },
  ) {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
    });
    if (!allocation)
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Allocation not found' },
      });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id },
        data: {
          returned_at: new Date(),
          condition_in: data.condition_in,
          checkin_notes: data.checkin_notes,
        },
      });

      await tx.asset.update({
        where: { id: allocation.asset_id },
        data: { status: 'Available', condition: data.condition_in || 'Good' },
      });

      return updated;
    });
  }

  async createTransferRequest(
    user: any,
    data: {
      asset_id: string;
      to_employee_id?: string;
      to_department_id?: string;
      reason?: string;
    },
  ) {
    const openAllocation = await this.prisma.allocation.findFirst({
      where: { asset_id: data.asset_id, returned_at: null },
    });

    if (!openAllocation) {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: 'Asset is not currently allocated',
        },
      });
    }

    return this.prisma.transfer_request.create({
      data: {
        asset_id: data.asset_id,
        from_allocation_id: openAllocation.id,
        requested_by: user.id,
        to_employee_id: data.to_employee_id,
        to_department_id: data.to_department_id,
        reason: data.reason,
      },
    });
  }

  async approveTransfer(id: string, user: any) {
    const req = await this.prisma.transfer_request.findUnique({
      where: { id },
      include: { from_allocation: true },
    });
    if (!req) throw new NotFoundException();

    return this.prisma.$transaction(async (tx) => {
      await tx.allocation.update({
        where: { id: req.from_allocation_id },
        data: { returned_at: new Date(), checkin_notes: 'Transfer approved' },
      });

      await tx.allocation.create({
        data: {
          asset_id: req.asset_id,
          employee_id: req.to_employee_id,
          department_id: req.to_department_id,
          allocated_by: user.id,
        },
      });

      return tx.transfer_request.update({
        where: { id },
        data: {
          status: 'Approved',
          approver_id: user.id,
          decided_at: new Date(),
        },
      });
    });
  }

  async rejectTransfer(id: string, user: any, reason: string) {
    return this.prisma.transfer_request.update({
      where: { id },
      data: {
        status: 'Rejected',
        approver_id: user.id,
        decided_at: new Date(),
        reason,
      },
    });
  }

  async findAllTransfers(user: any) {
    const where: any = {};
    if (user.role === 'Employee') {
      where.requested_by = user.id;
    }
    return this.prisma.transfer_request.findMany({
      where,
      include: {
        from_allocation: {
          include: {
            asset: true,
            employee: true,
            department: true,
          },
        },
        requester: true,
      },
    });
  }
}
