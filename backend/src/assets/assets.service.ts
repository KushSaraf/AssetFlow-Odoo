import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, filters: any) {
    const where: any = {};
    if (filters.q) {
      // ponytail: no `mode: 'insensitive'` — unsupported on SQLite (runtime
      // error); SQLite LIKE is already case-insensitive for ASCII.
      where.OR = [
        { name: { contains: filters.q } },
        { tag: { contains: filters.q } },
        { serial_number: { contains: filters.q } },
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

    // Role scoping (ui-spec §2): Dept Head sees their department's assets;
    // Employee sees own allocated assets + shared/bookable ones.
    if (user?.role === 'Department Head') {
      where.department_id = user.department_id;
    } else if (user?.role === 'Employee') {
      where.AND = [
        ...(where.OR ? [{ OR: where.OR }] : []),
        {
          OR: [
            { is_bookable: true },
            {
              allocations: {
                some: { employee_id: user.id, returned_at: null },
              },
            },
          ],
        },
      ];
      delete where.OR;
    }

    return this.prisma.asset.findMany({
      where,
      orderBy: { tag: 'asc' },
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

  /** Next sequential tag in the spec's `AF-0001` format. */
  private async nextTag(): Promise<string> {
    const last = await this.prisma.asset.findFirst({
      where: { tag: { startsWith: 'AF-' } },
      orderBy: { tag: 'desc' },
      select: { tag: true },
    });
    const lastNum = last ? parseInt(last.tag.slice(3), 10) || 0 : 0;
    return `AF-${String(lastNum + 1).padStart(4, '0')}`;
  }

  async create(user: any, data: any) {
    const { custom_fields, acquisition_date, ...assetData } = data;

    if (acquisition_date && new Date(acquisition_date) > new Date()) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: "Acquisition date can't be in the future.",
          field: 'acquisition_date',
        },
      });
    }

    assetData.status = 'Available';
    delete assetData.tag; // tag is never user-editable

    // ponytail: tag race between concurrent registers just retries once;
    // unique index on tag is the real guarantee.
    for (let attempt = 0; ; attempt++) {
      assetData.tag = await this.nextTag();
      try {
        const createdAsset = await this.prisma.asset.create({
          data: {
            ...assetData,
            acquisition_date: new Date(acquisition_date),
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
        if (user?.id) {
          await this.prisma.logActivity(
            user.id,
            'registered_asset',
            'asset',
            createdAsset.id,
          );
        }
        return createdAsset;
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 2) {
          const target = String(e?.meta?.target ?? '');
          if (target.includes('serial_number')) {
            throw new ConflictException({
              error: {
                code: 'validation_error',
                message:
                  'This serial number is already registered to another asset.',
                field: 'serial_number',
              },
            });
          }
          continue; // tag collision — recompute and retry
        }
        throw e;
      }
    }
  }

  async update(id: string, data: any) {
    const { custom_fields, acquisition_date, ...assetData } = data;
    delete assetData.tag; // tag is never user-editable
    delete assetData.status; // status only changes via lifecycle actions

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
      .catch((e: any) => {
        if (e?.code === 'P2002') {
          throw new ConflictException({
            error: {
              code: 'validation_error',
              message:
                'This serial number is already registered to another asset.',
              field: 'serial_number',
            },
          });
        }
        throw new NotFoundException({
          error: { code: 'not_found', message: 'Asset not found' },
        });
      });
  }

  async updateStatus(id: string, user: any, status: string) {
    // Manual status actions per ui-spec §5: Retired/Disposed, plus
    // Available for the "asset recovered" (Lost → Available) path.
    if (!['Retired', 'Disposed', 'Available'].includes(status)) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message:
            'Status can only be set to Retired, Disposed, or Available here — other statuses are driven by allocations, bookings, maintenance, and audits.',
          field: 'status',
        },
      });
    }

    if (status === 'Retired' || status === 'Disposed') {
      const openAllocations = await this.prisma.allocation.findFirst({
        where: { asset_id: id, returned_at: null },
        include: { employee: true, department: true },
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
      const updated = await this.prisma.asset.update({
        where: { id },
        data: { status },
      });
      if (user?.id) {
        await this.prisma.logActivity(
          user.id,
          `set_status_${status.toLowerCase()}`,
          'asset',
          id,
        );
      }
      return updated;
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

  async addDocument(
    id: string,
    fileData: { file_url?: string; type?: string },
  ) {
    if (!fileData?.file_url) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'file_url is required',
          field: 'file_url',
        },
      });
    }
    return this.prisma.asset_document.create({
      data: {
        asset_id: id,
        file_url: fileData.file_url,
        type: fileData.type || 'Document',
      },
    });
  }
}
