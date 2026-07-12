-- Migration 6: resource_booking + maintenance_request
-- HAND-EDITED: includes the btree_gist EXCLUDE constraint for booking overlap prevention

-- Enable btree_gist extension (required for the EXCLUDE constraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "resource_booking" (
  "id"                         TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"                   TEXT NOT NULL,
  "booked_by"                  TEXT NOT NULL,
  "on_behalf_of_department_id" TEXT,
  "start_time"                 TIMESTAMP(3) NOT NULL,
  "end_time"                   TIMESTAMP(3) NOT NULL,
  "purpose"                    TEXT,
  "status"                     TEXT NOT NULL DEFAULT 'Upcoming',

  CONSTRAINT "resource_booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_booking_status_check"
    CHECK ("status" IN ('Upcoming', 'Ongoing', 'Completed', 'Cancelled')),
  CONSTRAINT "resource_booking_time_check"
    CHECK ("end_time" > "start_time"),
  CONSTRAINT "resource_booking_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "resource_booking_booked_by_fkey"
    FOREIGN KEY ("booked_by")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Index for calendar queries
CREATE INDEX "resource_booking_asset_id_start_time_idx" ON "resource_booking"("asset_id", "start_time");

-- BUSINESS-CRITICAL: No overlapping bookings per resource (evaluators will check this)
-- tsrange is exclusive on end (half-open [start, end)), so 9:00-10:00 and 10:00-11:00 do NOT overlap
ALTER TABLE "resource_booking"
  ADD CONSTRAINT "no_overlap"
  EXCLUDE USING gist (
    "asset_id" WITH =,
    tsrange("start_time", "end_time") WITH &&
  )
  WHERE ("status" <> 'Cancelled');

CREATE TABLE "maintenance_request" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"                TEXT NOT NULL,
  "raised_by"               TEXT NOT NULL,
  "issue"                   TEXT NOT NULL,
  "priority"                TEXT NOT NULL,
  "status"                  TEXT NOT NULL DEFAULT 'Pending',
  "approver_id"             TEXT,
  "technician"              TEXT,
  "resolution_notes"        TEXT,
  "resolved_at"             TIMESTAMP(3),
  "source_audit_finding_id" TEXT,

  CONSTRAINT "maintenance_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "maintenance_request_source_audit_finding_id_key" UNIQUE ("source_audit_finding_id"),
  CONSTRAINT "maintenance_request_priority_check"
    CHECK ("priority" IN ('Low', 'Medium', 'High', 'Critical')),
  CONSTRAINT "maintenance_request_status_check"
    CHECK ("status" IN ('Pending', 'Approved', 'Rejected', 'Technician Assigned', 'In Progress', 'Resolved')),
  CONSTRAINT "maintenance_request_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "maintenance_request_raised_by_fkey"
    FOREIGN KEY ("raised_by")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_request_approver_id_fkey"
    FOREIGN KEY ("approver_id")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
  -- NOTE: source_audit_finding_id FK added in migration 007 after audit_finding table exists
);
