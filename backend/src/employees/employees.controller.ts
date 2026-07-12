import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles('Admin', 'Asset Manager', 'Department Head')
  @Get()
  findAll(
    @Req() req: any,
    @Query('department_id') department_id?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.findAll(req.user, {
      department_id,
      role,
      status,
    });
  }

  @Roles('Admin')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { department_id?: string; status?: string },
  ) {
    return this.employeesService.update(id, body);
  }

  @Roles('Admin')
  @Patch(':id/promote')
  promote(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { role: string; department_id?: string },
  ) {
    return this.employeesService.promote(
      req.user,
      id,
      body.role,
      body.department_id,
    );
  }

  @Roles('Admin')
  @Patch(':id/revoke')
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.employeesService.revoke(req.user, id);
  }
}
