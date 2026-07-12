# AssetFlow — Architecture

## Overview

```
frontend (Next.js, :3000)  ──fetch──▶  backend (NestJS, :4000)  ──Prisma──▶  SQLite (backend/dev.db)
```

- **Frontend**: Next.js App Router, one route per screen under `src/app/app/*`. All data access goes through `src/lib/api.ts` (`apiFetch`), which attaches the JWT and normalizes the API's error shape into an `ApiError`. TanStack Query handles caching/invalidation; special error codes (`already_allocated`, `overlap`) render as the conflict modal / inline overlap message instead of a toast.
- **Backend**: one NestJS module per resource — `auth`, `departments`, `categories`, `employees`, `assets`, `allocations`, `bookings`, `maintenance`, `audit`, `reports`, `notifications`. Controllers declare access with `@Roles(...)`; services own all business logic and write notifications + activity-log rows inside the same transaction as the state change.
- **Auth**: JWT (`{sub, role}`) via Passport. Two global guards: `JwtAuthGuard` (401 unless `@Public()`) and `RolesGuard` (403 on role mismatch). The JWT strategy re-loads the user per request, so deactivated accounts and revoked roles take effect immediately.

## Security model

- **Non-self-elevation**: `POST /auth/signup` discards any client-sent `role`; every signup is an Employee. Only `PATCH /employees/:id/promote|revoke` (Admin-only) touches the role column.
- Passwords hashed with bcrypt; login/forgot-password responses never reveal whether an email exists.
- Row-level scoping is applied server-side in every list query (Employee → own records, Dept Head → department records), so the same UI works per role without client-side filtering.

## Data model

Seventeen tables (see `backend/prisma/schema.prisma`): `department` (self-referencing hierarchy + head), `employee`, `asset_category` / `asset_category_field` / `asset_custom_field_value` (EAV-lite for category-specific fields), `asset`, `asset_document`, `allocation`, `transfer_request`, `resource_booking`, `maintenance_request`, `audit_cycle` / `audit_assignment` / `audit_finding`, `notification`, `activity_log`.

Key integrity rules:

- **One open allocation per asset** — partial unique index `one_open_allocation_per_asset ON allocation(asset_id) WHERE returned_at IS NULL`, created at startup in `PrismaService.onModuleInit` (Prisma's DSL can't express partial indexes). The service check gives the friendly 409; the index guarantees it under races.
- **No overlapping bookings** — SQLite has no `EXCLUDE` constraint, so the interval check (`new.start < existing.end AND new.end > existing.start`) runs inside the insert transaction; SQLite's serialized writes make it race-safe.
- Uniqueness: `department.name`, `employee.email`, `asset_category.name`, `asset.tag`, `asset.serial_number` (nullable-unique).
- Exactly-one-of `employee_id`/`department_id` on allocations and transfer targets (service-validated).
- Deletes are mostly `RESTRICT`; records deactivate (`status: Inactive`) or move to terminal statuses rather than being deleted.

## Asset lifecycle (status is derived, never free-edited)

| Trigger | Status change |
|---|---|
| Allocation created | Available → **Allocated** |
| Return confirmed | Allocated → **Available** |
| Maintenance approved | → **Under Maintenance** (holder retained) |
| Maintenance resolved | → **Allocated** if an open allocation exists, else **Available** |
| Audit cycle closed, Missing finding | → **Lost** |
| Audit cycle closed, Damaged finding | auto-creates a Pending maintenance request (no direct status change) |
| Manual action (Asset Manager/Admin) | → **Retired** / **Disposed** (blocked while allocated/booked); Lost → Available (recovered) |

Booking statuses `Ongoing`/`Completed` are computed from the clock at read time; only `Cancelled` is stored.

## Workflows

- **Transfer**: `Requested → Re-allocated` (approval atomically closes the old allocation and opens the new one) or `Rejected` (reason required). Dept Heads can only decide transfers touching their own department.
- **Maintenance**: `Pending → Approved → Technician Assigned → In Progress → Resolved`, with `Rejected` as a terminal branch. Each transition validates the current state — no skipping stages.
- **Audit**: cycle created `In Progress` with assigned auditors → auditors record per-asset findings (re-marking replaces the earlier finding) → discrepancy report is a filtered view → Admin closes, which locks all findings and applies the side effects above.

## Notifications & activity log

Every state change writes a `notification` row (recipient-targeted) and an `activity_log` row (append-only audit trail), in the same transaction as the change. Catalog: Asset Assigned, Transfer Approved/Rejected, Overdue Return Alert (holder + their Dept Head), Booking Confirmed/Cancelled/Reminder, Maintenance Approved/Rejected/Resolved, Auditor Assigned, Audit Discrepancy Flagged, Audit Cycle Closed, Role Updated.

Two cron jobs (`@nestjs/schedule`): daily overdue detection and a 5-minute booking-reminder sweep, both deduped so a given allocation/booking alerts at most once per day/slot.

## Testing & CI

- `backend/src/**/**.spec.ts` — Jest unit tests for the two headline rules (booking overlap incl. the back-to-back edge case, allocation conflict incl. the `current_holder` payload) plus validation guards. Run with `npm test`.
- `.github/workflows/ci.yml` — on every push/PR: backend install → prisma generate → build → tests → schema push + seed against a fresh SQLite DB; frontend install → production build.
