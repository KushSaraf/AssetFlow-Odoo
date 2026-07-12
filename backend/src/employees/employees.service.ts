import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    user: any,
    filters: { department_id?: string; role?: string; status?: string },
  ) {
    const where: any = {};
    if (filters.department_id) where.department_id = filters.department_id;
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;

    if (user.role === 'Department Head') {
      where.department_id = user.department_id;
    }

    return this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        department_id: true,
        role: true,
        status: true,
      },
    });
  }

  async update(id: string, data: { department_id?: string; status?: string }) {
    try {
      return await this.prisma.employee.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          department_id: true,
          role: true,
          status: true,
        },
      });
    } catch (e) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Employee not found' },
      });
    }
  }

  /** The ONLY place roles change (brief's non-self-elevation requirement). */
  async promote(actor: any, id: string, role: string, department_id?: string) {
    if (!['Department Head', 'Asset Manager'].includes(role)) {
      throw new ForbiddenException({
        error: {
          code: 'validation_error',
          message: 'Invalid role for promotion',
        },
      });
    }
    try {
      const updated = await this.prisma.employee.update({
        where: { id },
        data: { role, ...(department_id ? { department_id } : {}) },
        select: {
          id: true,
          name: true,
          email: true,
          department_id: true,
          role: true,
          status: true,
        },
      });
      await this.notifyRoleChange(actor, updated.id, role);
      return updated;
    } catch (e: any) {
      if (e?.code === 'P2025' || e?.name === 'NotFoundError') {
        throw new NotFoundException({
          error: { code: 'not_found', message: 'Employee not found' },
        });
      }
      throw e;
    }
  }

  async revoke(actor: any, id: string) {
    try {
      const updated = await this.prisma.employee.update({
        where: { id },
        data: { role: 'Employee' },
        select: {
          id: true,
          name: true,
          email: true,
          department_id: true,
          role: true,
          status: true,
        },
      });
      await this.notifyRoleChange(actor, updated.id, 'Employee');
      return updated;
    } catch (e: any) {
      if (e?.code === 'P2025' || e?.name === 'NotFoundError') {
        throw new NotFoundException({
          error: { code: 'not_found', message: 'Employee not found' },
        });
      }
      throw e;
    }
  }

  /** Role Updated notification to the affected employee (ui-spec §6). */
  private async notifyRoleChange(actor: any, employeeId: string, role: string) {
    await this.prisma.notification.create({
      data: {
        recipient_id: employeeId,
        type: 'RoleUpdated',
        payload: { message: `Your role has been updated to ${role}.` },
      },
    });
    if (actor?.id) {
      await this.prisma.logActivity(
        actor.id,
        role === 'Employee' ? 'revoked_role' : `promoted_to_${role.toLowerCase().replace(' ', '_')}`,
        'employee',
        employeeId,
      );
    }
  }
}
