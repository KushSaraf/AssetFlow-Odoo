import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    const where = status ? { status } : {};
    return this.prisma.department.findMany({
      where,
      include: {
        head_employee: { select: { id: true, name: true } },
        parent_department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  private duplicateNameError() {
    return new ConflictException({
      error: {
        code: 'validation_error',
        message: 'A department with this name already exists.',
        field: 'name',
      },
    });
  }

  /** ui-spec §7.1: parent cannot be self or a descendant (no cycles). */
  private async assertNoCycle(id: string, parentId?: string | null) {
    let current = parentId;
    while (current) {
      if (current === id) {
        throw new BadRequestException({
          error: {
            code: 'validation_error',
            message: "Can't set a department as its own ancestor.",
            field: 'parent_department_id',
          },
        });
      }
      const parent = await this.prisma.department.findUnique({
        where: { id: current },
        select: { parent_department_id: true },
      });
      current = parent?.parent_department_id;
    }
  }

  async create(data: {
    name: string;
    head_employee_id?: string;
    parent_department_id?: string;
  }) {
    if (!data.name?.trim()) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Department name is required.',
          field: 'name',
        },
      });
    }
    try {
      return await this.prisma.department.create({ data });
    } catch (e: any) {
      if (e?.code === 'P2002') throw this.duplicateNameError();
      throw e;
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      head_employee_id?: string;
      parent_department_id?: string;
    },
  ) {
    if (data.parent_department_id) {
      await this.assertNoCycle(id, data.parent_department_id);
    }
    try {
      return await this.prisma.department.update({
        where: { id },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw this.duplicateNameError();
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
