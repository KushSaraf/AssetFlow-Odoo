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
import { DepartmentsService } from './departments.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.departmentsService.findAll(status);
  }

  @Roles('Admin')
  @Post()
  create(
    @Body()
    body: {
      name: string;
      head_employee_id?: string;
      parent_department_id?: string;
    },
  ) {
    return this.departmentsService.create(body);
  }

  @Roles('Admin')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      head_employee_id?: string;
      parent_department_id?: string;
    },
  ) {
    return this.departmentsService.update(id, body);
  }

  @Roles('Admin')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.departmentsService.updateStatus(id, status);
  }
}
