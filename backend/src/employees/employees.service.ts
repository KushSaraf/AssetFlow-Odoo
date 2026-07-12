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

  async promote(id: string, role: string) {
    if (!['Department Head', 'Asset Manager'].includes(role)) {
      throw new ForbiddenException({
        error: {
          code: 'validation_error',
          message: 'Invalid role for promotion',
        },
      });
    }
    try {
      return await this.prisma.employee.update({
        where: { id },
        data: { role },
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

  async revoke(id: string) {
    try {
      return await this.prisma.employee.update({
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
    } catch (e) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Employee not found' },
      });
    }
  }
}
