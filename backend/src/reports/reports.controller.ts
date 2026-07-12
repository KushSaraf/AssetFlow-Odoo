import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get('asset-utilization')
  getAssetUtilization(@Query() filters: any) {
    return this.reportsService.getAssetUtilization(filters);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get('due-for-maintenance')
  getDueForMaintenance() {
    return this.reportsService.getDueForMaintenance();
  }

  @Roles('Admin', 'Asset Manager')
  @Get('depreciation')
  getDepreciation(@Query() filters: any) {
    return this.reportsService.getDepreciation(filters);
  }

  @Roles('Admin', 'Asset Manager')
  @Get('export')
  async exportReport(@Query('type') type: string, @Res() res: Response) {
    const { filename, csv } = await this.reportsService.exportReport(type);
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(csv);
  }
}
