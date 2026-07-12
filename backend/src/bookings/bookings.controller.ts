import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('resources')
  getResources() {
    return this.bookingsService.getResources();
  }

  @Get()
  findAll(@Req() req: any, @Query() filters: any) {
    return this.bookingsService.findAll(filters, req.user);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.bookingsService.create(req.user, body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.bookingsService.update(id, req.user, body);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reason') reason: string,
  ) {
    return this.bookingsService.cancel(id, req.user, reason);
  }
}
