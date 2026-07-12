import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface AuthUser {
  id: string;
  role: string;
  department_id?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboard(user: AuthUser) {
    const totalAssets = await this.prisma.asset.count();

    const myAllocations = await this.prisma.allocation.count({
      where: { employee_id: user.id, returned_at: null },
    });

    const pendingMaintenance = await this.prisma.maintenance_request.count({
      where: { status: 'Pending' },
    });

    const openAudits = await this.prisma.audit_cycle.count({
      where: { status: 'Open' },
    });

    return { totalAssets, myAllocations, pendingMaintenance, openAudits };
  }

  async getNotifications(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { recipient_id: user.id },
      orderBy: { created_at: 'desc' },
    });
  }

  async markAsRead(id: string, user: AuthUser) {
    return this.prisma.notification.updateMany({
      where: { id, recipient_id: user.id },
      data: { read_at: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOverdueAllocations() {
    this.logger.debug('Running overdue allocations check');
    const overdue = await this.prisma.allocation.findMany({
      where: {
        returned_at: null,
        expected_return_date: { lt: new Date() },
      },
      include: { asset: true },
    });

    for (const alloc of overdue) {
      if (alloc.employee_id) {
        await this.prisma.notification.create({
          data: {
            recipient_id: alloc.employee_id,
            type: 'AssetOverdue',
            payload: {
              message: `The asset ${alloc.asset.name} (${alloc.asset.tag}) is overdue for return.`,
            },
          },
        });
      }
    }
  }
}
