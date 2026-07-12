import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getAssetUtilization(filters: any) {
    const where: any = {};
    if (filters.department_id) where.department_id = filters.department_id;

    const total = await this.prisma.asset.count({ where });
    const allocated = await this.prisma.asset.count({
      where: { ...where, status: 'Allocated' },
    });
    const available = await this.prisma.asset.count({
      where: { ...where, status: 'Available' },
    });
    const maintenance = await this.prisma.asset.count({
      where: { ...where, status: 'Under Maintenance' },
    });

    const utilization_rate = total > 0 ? (allocated / total) * 100 : 0;

    return {
      total_assets: total,
      allocated,
      available,
      maintenance,
      utilization_rate,
    };
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

  async exportReport(type: string) {
    if (type === 'csv') {
      return { url: 'https://example.com/exports/report.csv' };
    }
    return { url: 'https://example.com/exports/report.pdf' };
  }
}
