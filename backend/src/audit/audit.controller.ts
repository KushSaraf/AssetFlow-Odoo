import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit-cycles')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('Admin')
  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.auditService.createCycle(req.user, body);
  }

  // Employee has no audit access at all (ui-spec §2 Role Matrix)
  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get()
  findAll(@Req() req: any) {
    return this.auditService.findAll(req.user);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.auditService.findOne(id, req.user);
  }

  @Roles('Admin', 'Asset Manager')
  @Post(':id/findings')
  recordFinding(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.auditService.recordFinding(id, req.user, body);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get(':id/discrepancy-report')
  getDiscrepancies(@Param('id') id: string) {
    return this.auditService.getDiscrepancies(id);
  }

  @Roles('Admin')
  @Post(':id/close')
  closeCycle(@Param('id') id: string, @Req() req: any) {
    return this.auditService.closeCycle(id, req.user);
  }
}
