import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL || 'file:./dev.db',
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    // Business-critical DB constraint (docs/database/PLAN.md §3): one open
    // allocation per asset. Prisma's DSL can't express partial indexes, and
    // SQLite has no EXCLUDE constraint for booking overlaps — that one stays
    // an in-transaction check in BookingsService.
    await this.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS one_open_allocation_per_asset
       ON allocation(asset_id) WHERE returned_at IS NULL`,
    );
  }

  /** Append-only activity trail (ui-spec §3 Screen 10). */
  async logActivity(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    await this.activity_log.create({
      data: {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
      },
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
