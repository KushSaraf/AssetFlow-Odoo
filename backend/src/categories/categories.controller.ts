import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Roles('Admin')
  @Post()
  create(@Body() body: { name: string; description?: string }) {
    return this.categoriesService.create(body);
  }

  @Roles('Admin')
  @Post(':id/fields')
  createField(
    @Param('id') id: string,
    @Body()
    body: { field_name: string; field_type: string; required?: boolean },
  ) {
    return this.categoriesService.createField(id, body);
  }
}
