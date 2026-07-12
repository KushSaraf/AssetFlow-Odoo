# AssetFlow — Database Plan (Owner: Database person)

## Scope & Ownership
You own: schema design, migrations, constraints, indexes, and seed/demo data. Your output is the contract the Backend person builds against — get the schema stable early since both Backend and Frontend depend on it.

Reference: `docs/ui-spec.md` §4 (Data Model) is the source schema — this plan turns it into an ordered, buildable task list. Don't redesign entities here; if a field is missing, add it to `ui-spec.md` §4 first so Backend/Frontend see the same source of truth. Also see `docs/backend/PLAN.md` (consumes this schema) and `docs/frontend/PLAN.md`.

## 0. Stack
- **PostgreSQL** (14+, for the `EXCLUDE` constraint below).
- **Prisma Schema** (`prisma/schema.prisma`) — the models in §2 are defined here; this is the file Backend's `PrismaClient` is generated from, so treat schema changes as a shared-contract change (tell Backend before renaming a field, same rule as the API contract).
- **Indexing / Constraints** — most are expressible in `schema.prisma` (`@unique`, `@@index`, `@relation` with `onDelete`); the two business-critical ones (partial unique index, exclusion constraint) are **not** expressible in Prisma's DSL and must be added as raw SQL (see §3).
- **Triggers** (optional) — only if the team decides the asset-status derivation (§4.3 in `ui-spec.md`) should live in the DB rather than in NestJS service code; default recommendation is to keep it in Backend's service layer (easier to debug/test in a hackathon timeframe) and treat DB triggers as a stretch goal, not a requirement.
- **Views** (optional) — only if a report in Screen 9 is painful to express as a Prisma query; a plain SQL view queried via `prisma.$queryRaw` is an acceptable escape hatch, not a requirement for every report.

## Migration Workflow (Prisma-specific)
Prisma's migration flow is schema-first: edit `schema.prisma` → `npx prisma migrate dev --name <step>` generates a matching `migration.sql`. For the two constraints Prisma can't express:
1. Run `npx prisma migrate dev --create-only --name <step>` to generate the migration file without applying it.
2. Hand-edit the generated `migration.sql` to append the raw `CREATE UNIQUE INDEX ... WHERE ...` / `CREATE EXTENSION` + `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE ...` statements from §3.
3. Run `npx prisma migrate dev` (no `--create-only`) to apply it.
Document which migration files were hand-edited (a one-line comment at the top of the SQL file is enough) so nobody later regenerates over them and silently drops the constraint.

## 1. Task Checklist
- [ ] Stand up a local Postgres instance (or Docker container).
- [ ] Initialize `prisma/schema.prisma`, model the entities from §2 below.
- [ ] Enable the `btree_gist` extension (needed for the booking exclusion constraint).
- [ ] Write migrations in the dependency order below (§2), using the create-only + hand-edit flow above for the two special constraints.
- [ ] Apply all constraints from §3 (uniqueness, FKs, the two business-critical constraints).
- [ ] Add indexes from §4.
- [ ] Write a seed script (`prisma/seed.ts`, wired to `prisma db seed`) with realistic demo data (§5) so Backend/Frontend can develop against non-empty data from day one.
- [ ] ER Diagram: generate from the Prisma schema (e.g. `prisma-erd-generator`) rather than hand-drawing one — keeps it from going stale.
- [ ] Backup/restore scripts: `pg_dump`/`pg_restore` wrapper scripts for local dev snapshots (a nice-to-have safety net mid-hackathon, not a production DR plan).
- [ ] Query optimization / performance tuning: once Backend's endpoints are live, `EXPLAIN ANALYZE` the list/filter queries behind Screens 4, 5, 9 and confirm they're hitting the indexes in §4, not sequential-scanning.
- [ ] Hand off to Backend: connection string format, how to run migrations, how to reset/reseed (§6).

## 2. Migration Order
FK dependencies force this order. `department.head_employee_id` and `employee.department_id` reference each other — create both tables with those columns nullable and no FK, then add both FKs in a follow-up migration once both tables exist.

1. `department` (no `head_employee_id` FK yet)
2. `employee` (`department_id` FK now valid)
3. Add `department.head_employee_id` FK → `employee.id` (deferred migration)
4. `asset_category`
5. `asset_category_field`
6. `asset`
7. `asset_custom_field_value`
8. `asset_document`
9. `allocation`
10. `transfer_request`
11. `resource_booking`
12. `maintenance_request`
13. `audit_cycle`
14. `audit_assignment`
15. `audit_finding`
16. `notification`
17. `activity_log`

Full column list for every table is in `ui-spec.md` §4.1 — migrate exactly those fields/types, don't duplicate the list here (single source of truth).

## 3. Constraints to Implement (these are what evaluators will check first)
- **One open allocation per asset**: `CREATE UNIQUE INDEX one_open_allocation_per_asset ON allocation(asset_id) WHERE returned_at IS NULL;`
- **No overlapping bookings per resource**: `CREATE EXTENSION IF NOT EXISTS btree_gist; ALTER TABLE resource_booking ADD CONSTRAINT no_overlap EXCLUDE USING gist (asset_id WITH =, tsrange(start_time, end_time) WITH &&) WHERE (status <> 'Cancelled');`
  - MySQL fallback (no native `EXCLUDE`): wrap the insert in a `SERIALIZABLE` transaction that re-checks for overlaps immediately before inserting, inside the same transaction — weaker than a DB constraint, so flag it explicitly to Backend as a known gap if you end up here.
- **Enums**: Postgres `ENUM` type (or `CHECK (status IN (...))` if enums feel too rigid mid-hackathon) for every status/role/priority field — values must exactly match the state names in `ui-spec.md` (e.g. asset status: Available/Allocated/Reserved/Under Maintenance/Lost/Retired/Disposed).
- **Uniqueness**: `department.name`, `employee.email`, `asset_category.name`, `asset.tag`, `asset.serial_number` (nullable-unique).
- **Exactly-one-of check**: `allocation` must have exactly one of `employee_id`/`department_id` set — enforce with a `CHECK` constraint, not just app logic.
- **NOT NULL** on every required field per `ui-spec.md` §3 / §7.1.
- **ON DELETE** behavior per `ui-spec.md` §4.2 — mostly `RESTRICT`, a couple `CASCADE`; don't default everything to `CASCADE`.

## 4. Indexes (performance, not correctness)
- `asset(tag)`, `asset(status)`, `asset(department_id)`, `asset(category_id)` — Directory search/filter (Screen 4) hits all of these.
- `resource_booking(asset_id, start_time)` — calendar queries.
- `notification(recipient_id, read_at)` — unread-count query, runs on every page load.
- `activity_log(entity_type, entity_id)` — per-record activity lookups.
- `allocation(asset_id, returned_at)` — overdue query + conflict check.

## 5. Seed Data
Populate enough demo data that every screen in `ui-spec.md` §3 has something to show — empty states are a bad look mid-demo. Reuse the names/tags already used as examples in `ui-spec.md` so the seed matches the written spec:
- 3 departments: Engineering (Head: Aditi Rao), Facilities (Head: Rohan Mehta), Field Ops (Head: Sana Iqbal).
- ~8 employees across roles: 1 Admin, 2 Asset Managers, the 3 department heads above, remaining as Employee (include Priya Shah, Raj).
- 3 categories: Electronics (custom field: Warranty Period), Furniture, Vehicles.
- ~15 assets spanning every status at least once (Available, Allocated, Reserved, Under Maintenance, Lost, Retired) — include AF-0114 (Dell Laptop, allocated to Priya Shah) and AF-0012 / AF-0062 / AF-0201 from the spec's worked examples.
- A few open allocations, one pending transfer request, 2–3 bookings (including Room B2 booked 9:00–10:00, so the overlap demo works out of the box), a maintenance request in each kanban stage, one audit cycle with a couple of findings.
- A handful of notifications and activity-log rows so Screen 10 isn't empty on first load.

## 6. Handoff to Backend
Document once finalized: connection-string env var name, how to run migrations, how to reset+reseed for local dev, and the exact constraint/enum names from §3 — Backend's error-handling code needs to catch the `one_open_allocation_per_asset` and `no_overlap` constraint-violation errors specifically and turn them into the structured `409` responses defined in `docs/backend/PLAN.md` §4 (not a raw 500).
