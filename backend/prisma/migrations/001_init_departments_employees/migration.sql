-- Migration 1: init_departments_employees
-- Creates department and employee tables first (circular FK resolved by making head_employee_id nullable; FK added in migration 3)

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Department table (no head_employee_id FK yet — added in migration 3 after employee exists)
CREATE TABLE "department" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name"                 TEXT NOT NULL,
  "parent_department_id" TEXT,
  "head_employee_id"     TEXT,
  "status"               TEXT NOT NULL DEFAULT 'Active',

  CONSTRAINT "department_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "department_name_key" UNIQUE ("name"),
  CONSTRAINT "department_status_check" CHECK ("status" IN ('Active', 'Inactive'))
);

-- Self-referencing FK for hierarchy
ALTER TABLE "department"
  ADD CONSTRAINT "department_parent_department_id_fkey"
  FOREIGN KEY ("parent_department_id")
  REFERENCES "department"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Employee table
CREATE TABLE "employee" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "department_id" TEXT,
  "role"          TEXT NOT NULL DEFAULT 'Employee',
  "status"        TEXT NOT NULL DEFAULT 'Active',

  CONSTRAINT "employee_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "employee_email_key"   UNIQUE ("email"),
  CONSTRAINT "employee_role_check"  CHECK ("role" IN ('Admin', 'Asset Manager', 'Department Head', 'Employee')),
  CONSTRAINT "employee_status_check" CHECK ("status" IN ('Active', 'Inactive')),
  CONSTRAINT "employee_department_id_fkey"
    FOREIGN KEY ("department_id")
    REFERENCES "department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
