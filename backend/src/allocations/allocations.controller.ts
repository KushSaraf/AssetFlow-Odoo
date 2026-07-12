import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Get('allocations')
  findAll(@Req() req: any, @Query() filters: any) {
    return this.allocationsService.findAll(req.user, filters);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Post('allocations')
  create(@Req() req: any, @Body() body: any) {
    return this.allocationsService.create(req.user, body);
  }

  @Roles('Admin', 'Asset Manager')
  @Post('allocations/:id/return')
  returnAsset(@Param('id') id: string, @Body() body: any) {
    return this.allocationsService.returnAsset(id, body);
  }

  @Post('transfer-requests')
  createTransferRequest(@Req() req: any, @Body() body: any) {
    return this.allocationsService.createTransferRequest(req.user, body);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Post('transfer-requests/:id/approve')
  approveTransfer(@Param('id') id: string, @Req() req: any) {
    return this.allocationsService.approveTransfer(id, req.user);
  }

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Post('transfer-requests/:id/reject')
  rejectTransfer(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reason') reason: string,
  ) {
    return this.allocationsService.rejectTransfer(id, req.user, reason);
  }
}
