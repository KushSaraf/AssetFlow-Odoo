import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
<<<<<<< HEAD
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
=======
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
>>>>>>> 9090c73 (Completed Backend as per PLAN-A.)
  private pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
