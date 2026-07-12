import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll(@Query() filters: any) {
    return this.assetsService.findAll(filters);
  }

  @Get('tag/:tag')
  findByTag(@Param('tag') tag: string) {
    return this.assetsService.findByTag(tag);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Roles('Admin', 'Asset Manager')
  @Post()
  create(@Body() body: any) {
    return this.assetsService.create(body);
  }

  @Roles('Admin', 'Asset Manager')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.assetsService.update(id, body);
  }

  @Roles('Admin', 'Asset Manager')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.assetsService.updateStatus(id, status);
  }

  @Get(':id/allocation-history')
  getAllocationHistory(@Param('id') id: string) {
    return this.assetsService.getAllocationHistory(id);
  }

  @Get(':id/maintenance-history')
  getMaintenanceHistory(@Param('id') id: string) {
    return this.assetsService.getMaintenanceHistory(id);
  }

  @Roles('Admin', 'Asset Manager')
  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() body: any) {
    return this.assetsService.addDocument(id, body);
  }
}
