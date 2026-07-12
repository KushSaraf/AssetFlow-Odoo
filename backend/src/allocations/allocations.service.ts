import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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

    if (String(filters.overdue) === 'true') {
      where.returned_at = null;
      where.expected_return_date = { lt: new Date() };
    }

    // Role scoping (ui-spec §2): Employee sees own; Dept Head sees dept.
    if (user.role === 'Employee') {
      where.employee_id = user.id;
    } else if (user.role === 'Department Head') {
      where.OR = [
        { department_id: user.department_id },
        { employee: { department_id: user.department_id } },
      ];
    }

    return this.prisma.allocation.findMany({
      where,
      orderBy: { allocated_at: 'desc' },
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
    if (!data.asset_id) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Select an asset to allocate.',
          field: 'asset_id',
        },
      });
    }
    // Exactly one of employee/department (DB plan §3 exactly-one-of rule).
    if (!!data.employee_id === !!data.department_id) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Allocate to exactly one employee or one department.',
          field: 'employee_id',
        },
      });
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: data.asset_id },
    });
    if (!asset) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Asset not found' },
      });
    }

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

    // Lifecycle guard (ui-spec §5): only Available assets can be allocated.
    if (asset.status !== 'Available') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: `Asset is ${asset.status} and cannot be allocated.`,
        },
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const allocation = await tx.allocation.create({
          data: {
            asset_id: data.asset_id,
            employee_id: data.employee_id,
            department_id: data.department_id,
            allocated_by: user.id,
            condition_out: asset.condition,
            expected_return_date: data.expected_return_date
              ? new Date(data.expected_return_date)
              : null,
          },
        });

        await tx.asset.update({
          where: { id: data.asset_id },
          data: { status: 'Allocated' },
        });

        // Asset Assigned → new holder (employee, or the department's head)
        let recipientId = data.employee_id;
        if (!recipientId && data.department_id) {
          const dept = await tx.department.findUnique({
            where: { id: data.department_id },
          });
          recipientId = dept?.head_employee_id ?? undefined;
        }
        if (recipientId) {
          await tx.notification.create({
            data: {
              recipient_id: recipientId,
              type: 'AssetAssigned',
              payload: {
                message: `You have been assigned the asset ${asset.name} (${asset.tag}).`,
                asset_id: asset.id,
              },
            },
          });
        }

        await tx.activity_log.create({
          data: {
            actor_id: user.id,
            action: 'allocated',
            entity_type: 'allocation',
            entity_id: allocation.id,
          },
        });

        return allocation;
      });
    } catch (e: any) {
      // Unique partial index one_open_allocation_per_asset — race caught at DB.
      if (e?.code === 'P2002' || /one_open_allocation_per_asset/.test(e?.message ?? '')) {
        throw new ConflictException({
          error: {
            code: 'already_allocated',
            message: 'Asset is already allocated',
            meta: { current_holder: openAllocation },
          },
        });
      }
      throw e;
    }
  }

  async returnAsset(
    user: any,
    id: string,
    data: { condition_in?: string; checkin_notes?: string },
  ) {
    if (!data.checkin_notes) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Add a condition note before confirming the return.',
          field: 'checkin_notes',
        },
      });
    }

    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!allocation)
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Allocation not found' },
      });
    if (allocation.returned_at) {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'This allocation has already been returned.',
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id },
        data: {
          returned_at: new Date(),
          condition_in: data.condition_in,
          checkin_notes: data.checkin_notes,
        },
      });

      // Asset reverts to Available unless it is mid-maintenance.
      if (allocation.asset.status !== 'Under Maintenance') {
        await tx.asset.update({
          where: { id: allocation.asset_id },
          data: {
            status: 'Available',
            condition: data.condition_in || allocation.asset.condition,
          },
        });
      } else if (data.condition_in) {
        await tx.asset.update({
          where: { id: allocation.asset_id },
          data: { condition: data.condition_in },
        });
      }

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'returned',
          entity_type: 'allocation',
          entity_id: id,
        },
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
    if (!!data.to_employee_id === !!data.to_department_id) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Transfer to exactly one employee or one department.',
          field: 'to_employee_id',
        },
      });
    }

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

    const request = await this.prisma.transfer_request.create({
      data: {
        asset_id: data.asset_id,
        from_allocation_id: openAllocation.id,
        requested_by: user.id,
        to_employee_id: data.to_employee_id,
        to_department_id: data.to_department_id,
        reason: data.reason,
      },
    });

    await this.prisma.logActivity(
      user.id,
      'requested_transfer',
      'transfer_request',
      request.id,
    );

    return request;
  }

  /** Dept Heads may only decide transfers that touch their department. */
  private assertDeptHeadScope(user: any, req: any) {
    if (user.role !== 'Department Head') return;
    const deptIds = [
      req.from_allocation?.department_id,
      req.from_allocation?.employee?.department_id,
      req.to_department_id,
    ];
    if (!deptIds.includes(user.department_id)) {
      throw new ForbiddenException({
        error: {
          code: 'forbidden',
          message: 'You can only decide transfers within your department.',
        },
      });
    }
  }

  async approveTransfer(id: string, user: any) {
    const req = await this.prisma.transfer_request.findUnique({
      where: { id },
      include: { from_allocation: { include: { employee: true } } },
    });
    if (!req) throw new NotFoundException();
    if (req.status !== 'Requested') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: `Transfer request is already ${req.status}.`,
        },
      });
    }
    this.assertDeptHeadScope(user, req);

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

      // Approved + auto re-allocated in one atomic step → terminal state
      // 'Re-allocated' per ui-spec §3 Screen 5's transfer state machine.
      const transfer = await tx.transfer_request.update({
        where: { id },
        data: {
          status: 'Re-allocated',
          approver_id: user.id,
          decided_at: new Date(),
        },
      });

      const asset = await tx.asset.findUnique({ where: { id: req.asset_id } });
      if (asset) {
        const message = `Transfer of ${asset.name} (${asset.tag}) was approved and the asset re-allocated.`;
        // Notify requester + old holder + new holder (§6 catalog)
        const recipients = new Set(
          [
            req.requested_by,
            req.from_allocation?.employee_id,
            req.to_employee_id,
          ].filter((r): r is string => !!r),
        );
        for (const recipient_id of recipients) {
          await tx.notification.create({
            data: {
              recipient_id,
              type:
                recipient_id === req.to_employee_id
                  ? 'AssetAssigned'
                  : 'TransferApproved',
              payload: { message, asset_id: asset.id },
            },
          });
        }
      }

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'approved_transfer',
          entity_type: 'transfer_request',
          entity_id: id,
        },
      });

      return transfer;
    });
  }

  async rejectTransfer(id: string, user: any, reason: string) {
    if (!reason) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Add a reason for rejecting this request.',
          field: 'reason',
        },
      });
    }

    const req = await this.prisma.transfer_request.findUnique({
      where: { id },
      include: { from_allocation: { include: { employee: true } } },
    });
    if (!req) throw new NotFoundException();
    if (req.status !== 'Requested') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: `Transfer request is already ${req.status}.`,
        },
      });
    }
    this.assertDeptHeadScope(user, req);

    const update = await this.prisma.transfer_request.update({
      where: { id },
      data: {
        status: 'Rejected',
        approver_id: user.id,
        decided_at: new Date(),
        reason,
      },
    });

    const asset = await this.prisma.asset.findUnique({
      where: { id: req.asset_id },
    });
    if (asset) {
      await this.prisma.notification.create({
        data: {
          recipient_id: req.requested_by,
          type: 'TransferRejected',
          payload: {
            message: `Your transfer request for ${asset.name} (${asset.tag}) has been rejected. Reason: ${reason}`,
            asset_id: asset.id,
          },
        },
      });
    }

    await this.prisma.logActivity(
      user.id,
      'rejected_transfer',
      'transfer_request',
      id,
    );

    return update;
  }

  async findAllTransfers(user: any) {
    const where: any = {};
    if (user.role === 'Employee') {
      where.requested_by = user.id;
    } else if (user.role === 'Department Head') {
      where.OR = [
        { requested_by: user.id },
        { to_department_id: user.department_id },
        { from_allocation: { department_id: user.department_id } },
        { from_allocation: { employee: { department_id: user.department_id } } },
      ];
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
