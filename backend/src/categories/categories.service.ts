import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.asset_category.findMany({
      include: { fields: true, _count: { select: { assets: true } } },
    });
  }

  async create(data: { name: string; description?: string }) {
    if (!data.name?.trim()) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Category name is required.',
          field: 'name',
        },
      });
    }
    try {
      return await this.prisma.asset_category.create({ data });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({
          error: {
            code: 'validation_error',
            message: 'A category with this name already exists.',
            field: 'name',
          },
        });
      }
      throw e;
    }
  }

  async createField(
    categoryId: string,
    data: { field_name: string; field_type: string; required?: boolean },
  ) {
    const category = await this.prisma.asset_category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Category not found' },
      });
    }
    return this.prisma.asset_category_field.create({
      data: {
        category_id: categoryId,
        field_name: data.field_name,
        field_type: data.field_type,
        required: data.required ?? false,
      },
    });
  }
}
