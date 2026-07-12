-- Migration 8: notification + activity_log

CREATE TABLE "notification" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "payload"      JSONB NOT NULL,
  "read_at"      TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_type_check"
    CHECK ("type" IN (
      'AssetAssigned',
      'TransferApproved',
      'TransferRejected',
      'OverdueReturnAlert',
      'BookingConfirmed',
      'BookingCancelled',
      'BookingReminder',
      'MaintenanceApproved',
      'MaintenanceRejected',
      'MaintenanceResolved',
      'AuditDiscrepancyFlagged',
      'AuditCycleClosed',
      'RoleUpdated'
    )),
  CONSTRAINT "notification_recipient_id_fkey"
    FOREIGN KEY ("recipient_id")
    REFERENCES "employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unread-count query — runs on every page load
CREATE INDEX "notification_recipient_id_read_at_idx" ON "notification"("recipient_id", "read_at");

CREATE TABLE "activity_log" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "actor_id"    TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id"   TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_log_actor_id_fkey"
    FOREIGN KEY ("actor_id")
    REFERENCES "employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Per-record activity lookups
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");
