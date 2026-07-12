import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    const where = status ? { status } : {};
    return this.prisma.department.findMany({ where });
  }

  async create(data: {
    name: string;
    head_employee_id?: string;
    parent_department_id?: string;
  }) {
    return this.prisma.department.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      head_employee_id?: string;
      parent_department_id?: string;
    },
  ) {
    try {
      return await this.prisma.department.update({
        where: { id },
        data,
      });
    } catch (e) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Department not found' },
      });
    }
  }

  async updateStatus(id: string, status: string) {
    try {
      return await this.prisma.department.update({
        where: { id },
        data: { status },
      });
    } catch (e) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Department not found' },
      });
    }
  }
}
