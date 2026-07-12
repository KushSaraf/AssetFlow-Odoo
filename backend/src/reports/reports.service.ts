import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const IDLE_THRESHOLD_DAYS = 45;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Utilization summary + most-used vs idle ranking (ui-spec §3 Screen 9 report 1). */
  async getAssetUtilization(filters: any) {
    const where: any = {};
    if (filters.department_id) where.department_id = filters.department_id;

    const [total, allocated, available, maintenance] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.count({ where: { ...where, status: 'Allocated' } }),
      this.prisma.asset.count({ where: { ...where, status: 'Available' } }),
      this.prisma.asset.count({
        where: { ...where, status: 'Under Maintenance' },
      }),
    ]);

    // Most-used: ranked by total allocation + booking count.
    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        _count: { select: { allocations: true, bookings: true } },
        allocations: {
          orderBy: { allocated_at: 'desc' },
          take: 1,
          select: { allocated_at: true, returned_at: true },
        },
      },
    });

    const ranked = assets
      .map((a) => ({
        asset_id: a.id,
        tag: a.tag,
        name: a.name,
        status: a.status,
        usage_count: a._count.allocations + a._count.bookings,
        last_used_at: a.allocations[0]?.allocated_at ?? null,
      }))
      .sort((a, b) => b.usage_count - a.usage_count);

    const idleCutoff = new Date(Date.now() - IDLE_THRESHOLD_DAYS * 86_400_000);
    const idle = ranked.filter(
      (a) =>
        a.status === 'Available' &&
        (a.last_used_at === null || a.last_used_at < idleCutoff),
    );

    return {
      total_assets: total,
      allocated,
      available,
      maintenance,
      utilization_rate: total > 0 ? (allocated / total) * 100 : 0,
      most_used: ranked.slice(0, 10),
      idle_assets: idle,
      idle_threshold_days: IDLE_THRESHOLD_DAYS,
    };
  }

  /** Assets due for maintenance or nearing retirement (report 3). */
  async getDueForMaintenance() {
    const assets = await this.prisma.asset.findMany({
      where: { status: { notIn: ['Retired', 'Disposed', 'Lost'] } },
      include: {
        category: true,
        maintenance: {
          where: { status: 'Resolved' },
          orderBy: { resolved_at: 'desc' },
          take: 1,
          select: { resolved_at: true },
        },
        _count: { select: { maintenance: true } },
      },
    });

    const now = Date.now();
    return assets
      .map((a) => {
        const ageDays = Math.floor(
          (now - a.acquisition_date.getTime()) / 86_400_000,
        );
        const lastServiced = a.maintenance[0]?.resolved_at ?? null;
        const daysSinceService = lastServiced
          ? Math.floor((now - lastServiced.getTime()) / 86_400_000)
          : ageDays;
        return {
          asset_id: a.id,
          tag: a.tag,
          name: a.name,
          category: a.category.name,
          condition: a.condition,
          age_days: ageDays,
          days_since_last_service: daysSinceService,
          maintenance_count: a._count.maintenance,
          nearing_retirement: ageDays > 4 * 365 || a.condition === 'Poor',
        };
      })
      .sort((a, b) => b.days_since_last_service - a.days_since_last_service);
  }

  async getDepreciation(filters: any) {
    const where: any = {};
    if (filters.category_id) where.category_id = filters.category_id;

    const assets = await this.prisma.asset.findMany({
      where,
      include: { category: true },
    });

    return assets.map((a) => {
      const ageYears =
        (new Date().getTime() - new Date(a.acquisition_date).getTime()) /
        (1000 * 3600 * 24 * 365);
      const deprecationRate = 0.2;
      const currentValue = Math.max(
        0,
        (a.acquisition_cost || 0) * Math.pow(1 - deprecationRate, ageYears),
      );

      return {
        asset_id: a.id,
        name: a.name,
        tag: a.tag,
        acquisition_cost: a.acquisition_cost,
        current_value: currentValue,
      };
    });
  }

  private toCsv(headers: string[], rows: (string | number | null)[][]) {
    const esc = (v: string | number | null) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join(
      '\n',
    );
  }

  /** Real CSV export streamed from live data — no mock URLs. */
  async exportReport(type: string): Promise<{ filename: string; csv: string }> {
    switch (type) {
      case 'assets': {
        const assets = await this.prisma.asset.findMany({
          include: { category: true, department: true },
          orderBy: { tag: 'asc' },
        });
        return {
          filename: 'assets_report.csv',
          csv: this.toCsv(
            ['Tag', 'Name', 'Category', 'Department', 'Status', 'Condition', 'Location', 'Acquisition Date', 'Acquisition Cost'],
            assets.map((a) => [
              a.tag,
              a.name,
              a.category.name,
              a.department?.name ?? '',
              a.status,
              a.condition,
              a.location ?? '',
              a.acquisition_date.toISOString().slice(0, 10),
              a.acquisition_cost ?? '',
            ]),
          ),
        };
      }
      case 'allocations': {
        const allocations = await this.prisma.allocation.findMany({
          include: { asset: true, employee: true, department: true },
          orderBy: { allocated_at: 'desc' },
        });
        return {
          filename: 'allocations_report.csv',
          csv: this.toCsv(
            ['Asset Tag', 'Asset', 'Holder', 'Allocated At', 'Expected Return', 'Returned At'],
            allocations.map((al) => [
              al.asset.tag,
              al.asset.name,
              al.employee?.name ?? al.department?.name ?? '',
              al.allocated_at.toISOString(),
              al.expected_return_date?.toISOString().slice(0, 10) ?? '',
              al.returned_at?.toISOString() ?? '',
            ]),
          ),
        };
      }
      case 'maintenance': {
        const requests = await this.prisma.maintenance_request.findMany({
          include: { asset: true, raiser: true },
        });
        return {
          filename: 'maintenance_report.csv',
          csv: this.toCsv(
            ['Asset Tag', 'Asset', 'Issue', 'Priority', 'Status', 'Raised By', 'Resolved At'],
            requests.map((r) => [
              r.asset.tag,
              r.asset.name,
              r.issue,
              r.priority,
              r.status,
              r.raiser.name,
              r.resolved_at?.toISOString() ?? '',
            ]),
          ),
        };
      }
      default:
        throw new BadRequestException({
          error: {
            code: 'validation_error',
            message: 'type must be one of: assets, allocations, maintenance',
            field: 'type',
          },
        });
    }
  }
}
