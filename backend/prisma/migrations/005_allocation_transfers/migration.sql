-- Migration 5: allocation + transfer_request
-- HAND-EDITED: includes partial unique index (not expressible in Prisma DSL)
--              and CHECK constraint for exactly-one-of employee/department

CREATE TABLE "allocation" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"             TEXT NOT NULL,
  "employee_id"          TEXT,
  "department_id"        TEXT,
  "allocated_by"         TEXT NOT NULL,
  "allocated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expected_return_date" TIMESTAMP(3),
  "returned_at"          TIMESTAMP(3),
  "condition_in"         TEXT,
  "condition_out"        TEXT,
  "checkin_notes"        TEXT,

  CONSTRAINT "allocation_pkey" PRIMARY KEY ("id"),

  -- Business rule: exactly one of employee_id or department_id must be set
  CONSTRAINT "allocation_exactly_one_recipient"
    CHECK (
      ("employee_id" IS NOT NULL AND "department_id" IS NULL)
      OR
      ("employee_id" IS NULL AND "department_id" IS NOT NULL)
    ),

  CONSTRAINT "allocation_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "allocation_employee_id_fkey"
    FOREIGN KEY ("employee_id")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "allocation_department_id_fkey"
    FOREIGN KEY ("department_id")
    REFERENCES "department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "allocation_allocated_by_fkey"
    FOREIGN KEY ("allocated_by")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Index for overdue query + conflict check
CREATE INDEX "allocation_asset_id_returned_at_idx" ON "allocation"("asset_id", "returned_at");

-- BUSINESS-CRITICAL: One open allocation per asset (evaluators will check this)
-- Enforces that only one allocation per asset can have returned_at IS NULL
CREATE UNIQUE INDEX "one_open_allocation_per_asset"
  ON "allocation"("asset_id")
  WHERE "returned_at" IS NULL;

CREATE TABLE "transfer_request" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"           TEXT NOT NULL,
  "from_allocation_id" TEXT NOT NULL,
  "requested_by"       TEXT NOT NULL,
  "to_employee_id"     TEXT,
  "to_department_id"   TEXT,
  "approver_id"        TEXT,
  "status"             TEXT NOT NULL DEFAULT 'Requested',
  "reason"             TEXT,
  "decided_at"         TIMESTAMP(3),

  CONSTRAINT "transfer_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transfer_request_status_check"
    CHECK ("status" IN ('Requested', 'Approved', 'Rejected', 'Re-allocated')),
  CONSTRAINT "transfer_request_from_allocation_id_fkey"
    FOREIGN KEY ("from_allocation_id")
    REFERENCES "allocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transfer_request_requested_by_fkey"
    FOREIGN KEY ("requested_by")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transfer_request_approver_id_fkey"
    FOREIGN KEY ("approver_id")
    REFERENCES "employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
