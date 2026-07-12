import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface AuthUser {
  id: string;
  role: string;
  department_id?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * KPI cards per ui-spec §3 Screen 2: Assets Available, Assets Allocated,
   * Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns.
   * Server-side role scoping — same component tree on every role client-side.
   */
  async getDashboard(user: AuthUser) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Scope filters per role
    const assetScope: any = {};
    const allocationScope: any = {};
    const bookingScope: any = {};
    const maintenanceScope: any = {};
    const transferScope: any = {};
    if (user.role === 'Department Head' && user.department_id) {
      assetScope.department_id = user.department_id;
      allocationScope.OR = [
        { department_id: user.department_id },
        { employee: { department_id: user.department_id } },
      ];
      bookingScope.booker = { department_id: user.department_id };
      maintenanceScope.asset = { department_id: user.department_id };
      transferScope.OR = [
        { to_department_id: user.department_id },
        { from_allocation: { employee: { department_id: user.department_id } } },
      ];
    } else if (user.role === 'Employee') {
      assetScope.allocations = { some: { employee_id: user.id, returned_at: null } };
      allocationScope.employee_id = user.id;
      bookingScope.booked_by = user.id;
      maintenanceScope.raised_by = user.id;
      transferScope.requested_by = user.id;
    }

    const [
      assetsAvailable,
      assetsAllocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueReturns,
    ] = await Promise.all([
      this.prisma.asset.count({
        where: { ...(user.role === 'Employee' ? {} : assetScope), status: 'Available' },
      }),
      this.prisma.asset.count({ where: { ...assetScope, status: 'Allocated' } }),
      this.prisma.maintenance_request.count({
        where: {
          ...maintenanceScope,
          status: { in: ['Approved', 'Technician Assigned', 'In Progress'] },
        },
      }),
      this.prisma.resource_booking.count({
        where: {
          ...bookingScope,
          status: { not: 'Cancelled' },
          start_time: { lte: endOfDay },
          end_time: { gte: now },
        },
      }),
      this.prisma.transfer_request.count({
        where: { ...transferScope, status: 'Requested' },
      }),
      this.prisma.allocation.count({
        where: {
          ...allocationScope,
          returned_at: null,
          expected_return_date: { gte: now },
        },
      }),
      this.prisma.allocation.count({
        where: {
          ...allocationScope,
          returned_at: null,
          expected_return_date: { lt: now },
        },
      }),
    ]);

    return {
      assetsAvailable,
      assetsAllocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueReturns,
    };
  }

  async getNotifications(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { recipient_id: user.id },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Activity Log per ui-spec §3 Screen 10: Admin sees everything,
   * Asset Manager / Dept Head see scope-relevant entries, Employee sees own.
   */
  async getActivityLog(user: AuthUser) {
    const where: any = {};
    if (user.role === 'Employee') {
      where.actor_id = user.id;
    } else if (user.role === 'Department Head') {
      where.actor = { department_id: user.department_id };
    }
    // Admin + Asset Manager: full log (asset ops touch every entity type)
    return this.prisma.activity_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, name: true, role: true } } },
    });
  }

  async markAsRead(id: string, user: AuthUser) {
    return this.prisma.notification.updateMany({
      where: { id, recipient_id: user.id },
      data: { read_at: new Date() },
    });
  }

  async markAllAsRead(user: AuthUser) {
    return this.prisma.notification.updateMany({
      where: { recipient_id: user.id, read_at: null },
      data: { read_at: new Date() },
    });
  }

  /** Overdue Return Alert → holder + their Department Head (ui-spec §6). */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOverdueAllocations() {
    this.logger.debug('Running overdue allocations check');
    const overdue = await this.prisma.allocation.findMany({
      where: {
        returned_at: null,
        expected_return_date: { lt: new Date() },
      },
      include: {
        asset: true,
        employee: { include: { department: true } },
      },
    });

    // One alert per allocation per day: skip if an alert for this
    // allocation went out in the last 23h (JSON payload dedupe in JS —
    // SQLite can't filter JSON columns).
    const recent = await this.prisma.notification.findMany({
      where: {
        type: 'OverdueReturnAlert',
        created_at: { gte: new Date(Date.now() - 23 * 3600_000) },
      },
      select: { payload: true },
    });
    const alreadyAlerted = new Set(
      recent.map((n) => (n.payload as any)?.allocation_id).filter(Boolean),
    );

    for (const alloc of overdue) {
      if (alreadyAlerted.has(alloc.id)) continue;
      const daysOverdue = Math.ceil(
        (Date.now() - alloc.expected_return_date!.getTime()) / 86_400_000,
      );
      const recipients = new Set(
        [
          alloc.employee_id,
          alloc.employee?.department?.head_employee_id,
        ].filter((r): r is string => !!r),
      );
      for (const recipient_id of recipients) {
        await this.prisma.notification.create({
          data: {
            recipient_id,
            type: 'OverdueReturnAlert',
            payload: {
              message: `${alloc.asset.name} (${alloc.asset.tag}) is ${daysOverdue} day(s) overdue for return.`,
              allocation_id: alloc.id,
            },
          },
        });
      }
    }
  }
}
