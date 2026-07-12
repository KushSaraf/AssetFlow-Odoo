import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('maintenance-requests')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  findAll(@Req() req: any, @Query() filters: any) {
    return this.maintenanceService.findAll(filters, req.user);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.maintenanceService.create(req.user, body);
  }

  @Roles('Asset Manager', 'Admin')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.maintenanceService.approve(id, req.user);
  }

  @Roles('Asset Manager', 'Admin')
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reason') reason: string,
  ) {
    return this.maintenanceService.reject(id, req.user, reason);
  }

  @Roles('Asset Manager', 'Admin')
  @Post(':id/assign-technician')
  assignTechnician(
    @Param('id') id: string,
    @Body('technician') technician: string,
  ) {
    return this.maintenanceService.assignTechnician(id, technician);
  }

  @Roles('Asset Manager', 'Admin')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.maintenanceService.start(id);
  }

  @Roles('Asset Manager', 'Admin')
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body('resolution_notes') notes: string) {
    return this.maintenanceService.resolve(id, notes);
  }
}
