import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { CategoriesModule } from './categories/categories.module';
import { EmployeesModule } from './employees/employees.module';
import { AssetsModule } from './assets/assets.module';
import { AllocationsModule } from './allocations/allocations.module';
import { BookingsModule } from './bookings/bookings.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    DepartmentsModule,
    CategoriesModule,
    EmployeesModule,
    AssetsModule,
    AllocationsModule,
    BookingsModule,
    MaintenanceModule,
    AuditModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
