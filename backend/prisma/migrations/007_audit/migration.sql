-- Migration 7: audit_cycle, audit_assignment, audit_finding

CREATE TABLE "audit_cycle" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name"                TEXT NOT NULL,
  "scope_department_id" TEXT,
  "scope_location"      TEXT,
  "start_date"          TIMESTAMP(3) NOT NULL,
  "end_date"            TIMESTAMP(3) NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'Draft',
  "closed_at"           TIMESTAMP(3),

  CONSTRAINT "audit_cycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_cycle_status_check"
    CHECK ("status" IN ('Draft', 'In Progress', 'Closed')),
  CONSTRAINT "audit_cycle_scope_department_id_fkey"
    FOREIGN KEY ("scope_department_id")
    REFERENCES "department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "audit_assignment" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id"   TEXT NOT NULL,
  "auditor_id" TEXT NOT NULL,

  CONSTRAINT "audit_assignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_assignment_cycle_id_fkey"
    FOREIGN KEY ("cycle_id")
    REFERENCES "audit_cycle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "audit_assignment_auditor_id_fkey"
    FOREIGN KEY ("auditor_id")
    REFERENCES "employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "audit_finding" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id"    TEXT NOT NULL,
  "asset_id"    TEXT NOT NULL,
  "result"      TEXT NOT NULL,
  "notes"       TEXT,
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_finding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_finding_result_check"
    CHECK ("result" IN ('Verified', 'Missing', 'Damaged')),
  CONSTRAINT "audit_finding_cycle_id_fkey"
    FOREIGN KEY ("cycle_id")
    REFERENCES "audit_cycle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "audit_finding_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "audit_finding_recorded_by_fkey"
    FOREIGN KEY ("recorded_by")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Deferred FK: maintenance_request → audit_finding
-- (could not be added in migration 006 because audit_finding did not exist yet)
ALTER TABLE "maintenance_request"
  ADD CONSTRAINT "maintenance_request_source_audit_finding_id_fkey"
  FOREIGN KEY ("source_audit_finding_id")
  REFERENCES "audit_finding"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
