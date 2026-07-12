import { Module } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { AllocationsController } from './allocations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AllocationsController],
  providers: [AllocationsService],
})
export class AllocationsModule {}
