import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: any) {
    const where: any = {};
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { tag: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (filters.tag) where.tag = filters.tag;
    if (filters.serial) where.serial_number = filters.serial;
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.status) where.status = filters.status;
    if (filters.department_id) where.department_id = filters.department_id;
    if (filters.location) where.location = filters.location;
    if (filters.bookable !== undefined)
      where.is_bookable = filters.bookable === 'true';

    return this.prisma.asset.findMany({
      where,
      include: { category: true, department: true },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        department: true,
        custom_fields: { include: { category_field: true } },
        documents: true,
      },
    });
    if (!asset)
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Asset not found' },
      });
    return asset;
  }

  async findByTag(tag: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { tag },
      include: { category: true, department: true },
    });
    if (!asset)
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Asset not found' },
      });
    return asset;
  }

  async create(data: any) {
    const { custom_fields, acquisition_date, ...assetData } = data;
    // Generate a unique tag (e.g., AST-xxxxxx)
    assetData.tag = `AST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    assetData.status = 'Available';

    const createdAsset = await this.prisma.asset.create({
      data: {
        ...assetData,
        acquisition_date: new Date(acquisition_date),
        custom_fields: custom_fields
          ? {
              create: Object.entries(custom_fields).map(([fieldId, val]) => ({
                category_field_id: fieldId,
                value: String(val),
              })),
            }
          : undefined,
      },
    });
    return createdAsset;
  }

  async update(id: string, data: any) {
    const { custom_fields, acquisition_date, ...assetData } = data;

    return await this.prisma
      .$transaction(async (tx) => {
        if (custom_fields) {
          await tx.asset_custom_field_value.deleteMany({
            where: { asset_id: id },
          });
        }
        return tx.asset.update({
          where: { id },
          data: {
            ...assetData,
            ...(acquisition_date && {
              acquisition_date: new Date(acquisition_date),
            }),
            custom_fields: custom_fields
              ? {
                  create: Object.entries(custom_fields).map(
                    ([fieldId, val]) => ({
                      category_field_id: fieldId,
                      value: String(val),
                    }),
                  ),
                }
              : undefined,
          },
        });
      })
      .catch((e) => {
        throw new NotFoundException({
          error: { code: 'not_found', message: 'Asset not found' },
        });
      });
  }

  async updateStatus(id: string, status: string) {
    if (status === 'Retired' || status === 'Disposed') {
      const openAllocations = await this.prisma.allocation.findFirst({
        where: { asset_id: id, returned_at: null },
      });
      if (openAllocations) {
        throw new ConflictException({
          error: {
            code: 'already_allocated',
            message: 'Cannot retire/dispose an asset with an open allocation',
            meta: { current_holder: openAllocations },
          },
        });
      }

      const openBookings = await this.prisma.resource_booking.findFirst({
        where: {
          asset_id: id,
          end_time: { gt: new Date() },
          status: { not: 'Cancelled' },
        },
      });
      if (openBookings) {
        throw new ConflictException({
          error: {
            code: 'overlap',
            message: 'Cannot retire/dispose an asset with upcoming bookings',
            meta: { conflicting_booking: openBookings },
          },
        });
      }
    }

    try {
      return await this.prisma.asset.update({
        where: { id },
        data: { status },
      });
    } catch (e) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Asset not found' },
      });
    }
  }

  async getAllocationHistory(id: string) {
    return this.prisma.allocation.findMany({
      where: { asset_id: id },
      include: { employee: true, department: true, allocator: true },
      orderBy: { allocated_at: 'desc' },
    });
  }

  async getMaintenanceHistory(id: string) {
    return this.prisma.maintenance_request.findMany({
      where: { asset_id: id },
      include: { raiser: true, approver: true },
      orderBy: { id: 'desc' },
    });
  }

  async addDocument(id: string, fileData: any) {
    return this.prisma.asset_document.create({
      data: {
        asset_id: id,
        file_url: 'https://example.com/mock-upload-url.pdf', // Mocked upload
        type: 'Document',
      },
    });
  }
}
