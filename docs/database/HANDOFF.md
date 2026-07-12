# AssetFlow — Database Handoff to Backend

## 1. Environment Variable

| Var | Value (local dev) |
|---|---|
| `DATABASE_URL` | `postgresql://assetflow_user:assetflow_password@localhost:5432/assetflow` |

Set this in `backend/.env` (already populated). Never commit `.env`; `.env.example` is safe to commit.

## 2. Running Migrations

> Requires Postgres running (`docker compose up -d` from `database/`).

```bash
# From backend/
npx prisma migrate deploy        # applies all pending migrations (CI / first-time setup)
npx prisma migrate dev           # dev mode — detects schema drift + re-generates client
npx prisma generate              # regenerate PrismaClient after schema changes only
```

> ⚠️ **Migrations 005 and 006 are hand-edited** — do **not** regenerate them with `--create-only` and overwrite. They contain raw SQL that Prisma cannot express in its DSL. A one-line comment at the top of each file marks them as hand-edited.

## 3. Resetting & Re-seeding (local dev)

```bash
# Wipes all data, re-runs all migrations, then re-seeds
npx prisma migrate reset         # prompts for confirmation

# Seed only (no migration reset)
npx prisma db seed
```

Seed credentials (password: `password123` for all):

| Email | Role |
|---|---|
| admin@assetflow.com | Admin |
| kamya@assetflow.com | Asset Manager |
| vikram@assetflow.com | Asset Manager |
| aditi@assetflow.com | Department Head (Engineering) |
| rohan@assetflow.com | Department Head (Facilities) |
| sana@assetflow.com | Department Head (Field Ops) |
| priya@assetflow.com | Employee |
| raj@assetflow.com | Employee |

## 4. Business-Critical Constraints — Backend MUST Handle These

These two constraints are enforced at the DB layer. If violated, Postgres raises a specific error. Backend **must** catch them and return structured `409` responses (per `docs/backend/PLAN.md §4`), not raw 500s.

### 4.1 One open allocation per asset

**Constraint name:** `one_open_allocation_per_asset`  
**Table:** `allocation`  
**Type:** Partial UNIQUE INDEX on `(asset_id) WHERE returned_at IS NULL`  
**Prisma error code:** `P2002` (unique constraint violation)  
**Additional check:** look for `one_open_allocation_per_asset` in `error.meta.target`

```typescript
// Example NestJS handler pattern
try {
  await prisma.allocation.create({ data: ... });
} catch (e) {
  if (e.code === 'P2002' && e.meta?.target?.includes('one_open_allocation_per_asset')) {
    throw new ConflictException({
      code: 'ASSET_ALREADY_ALLOCATED',
      message: 'This asset already has an open allocation.',
    });
  }
  throw e;
}
```

### 4.2 No overlapping bookings per resource

**Constraint name:** `no_overlap`  
**Table:** `resource_booking`  
**Type:** EXCLUDE USING gist on `(asset_id WITH =, tsrange(start_time, end_time) WITH &&) WHERE (status <> 'Cancelled')`  
**Prisma error code:** `P2010` (raw query error) or the raw `pg` error code `23P01` (exclusion_violation)

```typescript
// Example NestJS handler pattern
try {
  await prisma.resource_booking.create({ data: ... });
} catch (e) {
  if (e.code === 'P2010' || e.meta?.code === '23P01') {
    throw new ConflictException({
      code: 'BOOKING_OVERLAP',
      message: 'This resource is already booked for the requested time slot.',
    });
  }
  throw e;
}
```

## 5. Enum Values (must match exactly — enforced by DB CHECK constraints)

| Field | Allowed values |
|---|---|
| `employee.role` | `Admin`, `Asset Manager`, `Department Head`, `Employee` |
| `employee.status` | `Active`, `Inactive` |
| `department.status` | `Active`, `Inactive` |
| `asset_category.status` | `Active`, `Inactive` |
| `asset_category_field.field_type` | `text`, `number`, `date` |
| `asset.condition` | `New`, `Good`, `Fair`, `Poor` |
| `asset.status` | `Available`, `Allocated`, `Reserved`, `Under Maintenance`, `Lost`, `Retired`, `Disposed` |
| `asset_document.type` | `photo`, `document` |
| `transfer_request.status` | `Requested`, `Approved`, `Rejected`, `Re-allocated` |
| `resource_booking.status` | `Upcoming`, `Ongoing`, `Completed`, `Cancelled` |
| `maintenance_request.priority` | `Low`, `Medium`, `High`, `Critical` |
| `maintenance_request.status` | `Pending`, `Approved`, `Rejected`, `Technician Assigned`, `In Progress`, `Resolved` |
| `audit_cycle.status` | `Draft`, `In Progress`, `Closed` |
| `audit_finding.result` | `Verified`, `Missing`, `Damaged` |
| `notification.type` | `AssetAssigned`, `TransferApproved`, `TransferRejected`, `OverdueReturnAlert`, `BookingConfirmed`, `BookingCancelled`, `BookingReminder`, `MaintenanceApproved`, `MaintenanceRejected`, `MaintenanceResolved`, `AuditDiscrepancyFlagged`, `AuditCycleClosed`, `RoleUpdated` |

## 6. Asset Status Trigger Points

`asset.status` is **never** freely editable via a form. It is only written at these trigger points (service-layer or DB trigger, per team decision):

| Trigger | → Status |
|---|---|
| `allocation` INSERT (no prior open allocation) | `Allocated` |
| `allocation.returned_at` SET + Asset Manager confirms | `Available` |
| `resource_booking` INSERT (current window) for bookable asset | `Reserved` |
| `maintenance_request.status` = `Approved` | `Under Maintenance` |
| `maintenance_request.status` = `Resolved` (open allocation exists) | `Allocated` |
| `maintenance_request.status` = `Resolved` (no open allocation) | `Available` |
| Audit cycle close, finding = `Missing` | `Lost` |
| Audit cycle close, finding = `Damaged` | auto-creates Pending `maintenance_request` |
| Manual action by Asset Manager / Admin (guard: must be `Available`) | `Retired` / `Disposed` |

## 7. Other Constraints

- **`allocation.allocation_exactly_one_recipient`** — CHECK that exactly one of `employee_id` / `department_id` is set (not both, not neither). Prisma error code: `P2010`, pg code: `23514` (check_violation). Return a `400 Bad Request`.
- **`asset.tag`** — system-generated, never user-editable. Format `AF-NNNN` (zero-padded 4 digits, sequential). Backend must implement the sequence on INSERT.
- **`asset.serial_number`** — unique if provided. `P2002` → `400 Bad Request` ("This serial number is already registered").
- **`employee.email`** / **`department.name`** / **`asset_category.name`** — unique. `P2002` → `409 Conflict` with field-specific message.
