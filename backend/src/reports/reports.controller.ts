import { Controller, Get, Query } from '@nestjs/common';
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

  @Roles('Admin', 'Asset Manager')
  @Get('depreciation')
  getDepreciation(@Query() filters: any) {
    return this.reportsService.getDepreciation(filters);
  }

  @Roles('Admin', 'Asset Manager')
  @Get('export')
  exportReport(@Query('type') type: string) {
    return this.reportsService.exportReport(type);
  }
}
