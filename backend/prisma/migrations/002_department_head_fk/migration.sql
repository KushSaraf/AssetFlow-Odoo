-- Migration 2: add department.head_employee_id FK -> employee
-- This is a deferred migration — both tables now exist so the circular FK is safe to add.

ALTER TABLE "department"
  ADD CONSTRAINT "department_head_employee_id_fkey"
  FOREIGN KEY ("head_employee_id")
  REFERENCES "employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
