# AssetFlow — API Reference

Base URL: `http://localhost:4000`. All routes require `Authorization: Bearer <token>` unless marked **public**. A role mismatch returns `403`, a missing/invalid token `401`.

## Error shape (uniform across every endpoint)

```json
{
  "error": {
    "code": "already_allocated | overlap | validation_error | invalid_status | forbidden | not_found",
    "message": "human-readable message",
    "field": "email",
    "meta": { "current_holder": {}, "conflicting_booking": {} }
  }
}
```

`field` appears only on field-level validation errors. `meta.current_holder` drives the allocation-conflict modal; `meta.conflicting_booking` drives the booking-overlap message.

## Auth

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | `{name, email, password}` → `{token, user}`. Any `role` in the body is **ignored** — always creates an Employee. |
| POST | `/auth/login` | public | `{email, password}` → `{token, user}`. Generic error, never reveals which field was wrong. |
| POST | `/auth/forgot-password` | public | Stub — generic response, never leaks account existence. |
| GET | `/auth/me` | any | Current user from the JWT. |

## Departments (Admin-only writes)

| Method | Path | Access |
|---|---|---|
| GET | `/departments?status=` | any |
| POST | `/departments` | Admin |
| PUT | `/departments/:id` | Admin — rejects setting a department as its own ancestor |
| PATCH | `/departments/:id/status` | Admin — Active/Inactive (deactivate, never delete) |

## Categories (Admin-only writes)

| Method | Path | Access |
|---|---|---|
| GET | `/categories` | any — includes custom `fields[]` and asset counts |
| POST | `/categories` | Admin |
| POST | `/categories/:id/fields` | Admin — `{field_name, field_type: text\|number\|date, required}` |

## Employees

| Method | Path | Access |
|---|---|---|
| GET | `/employees?department_id=&role=&status=` | Admin, Asset Manager, Dept Head (auto-scoped to own dept) |
| PUT | `/employees/:id` | Admin — department/status only |
| PATCH | `/employees/:id/promote` | Admin — `{role: "Department Head"\|"Asset Manager", department_id?}`. **The only place roles change.** Fires a Role Updated notification. |
| PATCH | `/employees/:id/revoke` | Admin — reverts to Employee |

## Assets

| Method | Path | Access |
|---|---|---|
| GET | `/assets?q=&tag=&serial=&category_id=&status=&department_id=&location=&bookable=` | any — **scoped**: Dept Head sees own dept; Employee sees own allocated + shared/bookable |
| GET | `/assets/:id` | any — includes custom fields + documents |
| GET | `/assets/tag/:tag` | any — QR/tag lookup |
| POST | `/assets` | Admin, Asset Manager — tag auto-generated (`AF-0001` sequential), status starts `Available` |
| PUT | `/assets/:id` | Admin, Asset Manager — tag & status not editable here |
| PATCH | `/assets/:id/status` | Admin, Asset Manager — only `Retired` / `Disposed` / `Available` (recovery); `409` if the asset has an open allocation or upcoming booking |
| GET | `/assets/:id/allocation-history` | any |
| GET | `/assets/:id/maintenance-history` | any |
| POST | `/assets/:id/documents` | Admin, Asset Manager — `{file_url, type}` |

## Allocations & Transfers

| Method | Path | Access |
|---|---|---|
| GET | `/allocations?asset_id=&employee_id=&department_id=&status=open\|closed&overdue=true` | scoped: Employee = own, Dept Head = dept |
| POST | `/allocations` | Admin, Asset Manager, Dept Head. `{asset_id, employee_id XOR department_id, expected_return_date?}`. `409 already_allocated` with `meta.current_holder` if taken (also enforced by a DB partial unique index). |
| POST | `/allocations/:id/return` | Admin, Asset Manager — `{condition_in, checkin_notes}` (notes required). Asset reverts to Available. |
| GET | `/transfer-requests` | scoped per role |
| POST | `/transfer-requests` | any holder — `{asset_id, to_employee_id XOR to_department_id, reason}` |
| POST | `/transfer-requests/:id/approve` | Admin, Asset Manager, Dept Head (own dept only). Atomically closes the old allocation, opens the new one, sets status `Re-allocated`. |
| POST | `/transfer-requests/:id/reject` | same — `{reason}` required |

## Bookings

| Method | Path | Access |
|---|---|---|
| GET | `/bookings/resources` | any — bookable assets |
| GET | `/bookings?asset_id=&date=&my_bookings=true&upcoming=true` | any — Ongoing/Completed statuses are derived from the clock; ascending by start time |
| POST | `/bookings` | any — `{asset_id, start_time, end_time, purpose?, on_behalf_of_department_id?}`. End must be after start. `409 overlap` with `meta.conflicting_booking` on any intersection with a non-cancelled booking (back-to-back slots are allowed). |
| PUT | `/bookings/:id` | owner, Admin, Asset Manager — reschedule, re-runs the overlap check |
| POST | `/bookings/:id/cancel` | owner, Admin, Asset Manager — `{reason?}` |

## Maintenance

| Method | Path | Access |
|---|---|---|
| GET | `/maintenance-requests?status=&asset_id=` | scoped: Employee = own, Dept Head = dept |
| POST | `/maintenance-requests` | current holder of the asset, or Admin/Asset Manager for any asset — `{asset_id, issue, priority}` |
| POST | `/maintenance-requests/:id/approve` | Admin, Asset Manager — Pending only. **Side effect: asset → Under Maintenance.** |
| POST | `/maintenance-requests/:id/reject` | Admin, Asset Manager — Pending only, `{reason}` required |
| POST | `/maintenance-requests/:id/assign-technician` | Admin, Asset Manager — Approved only |
| POST | `/maintenance-requests/:id/start` | Admin, Asset Manager — Technician Assigned only |
| POST | `/maintenance-requests/:id/resolve` | Admin, Asset Manager — `{resolution_notes}` required. **Side effect: asset reverts to Allocated (if an open allocation exists) or Available.** |

## Audit (Employee has no access)

| Method | Path | Access |
|---|---|---|
| POST | `/audit-cycles` | Admin — `{name, scope_department_id?, scope_location?, start_date, end_date, auditor_ids[]}` (≥1 auditor required) |
| GET | `/audit-cycles` | Admin, Asset Manager, Dept Head (own dept) |
| GET | `/audit-cycles/:id` | same — returns findings + full in-scope asset checklist |
| POST | `/audit-cycles/:id/findings` | assigned auditors (and Admin) — `{asset_id, result: Verified\|Missing\|Damaged, notes}` (notes required unless Verified; blocked once the cycle is Closed) |
| GET | `/audit-cycles/:id/discrepancy-report` | Admin, Asset Manager, Dept Head — Missing/Damaged findings only |
| POST | `/audit-cycles/:id/close` | Admin — locks the cycle; Missing → asset `Lost`, Damaged → auto-created Pending maintenance request |

## Reports (Employee has no access)

| Method | Path | Access |
|---|---|---|
| GET | `/reports/asset-utilization?department_id=` | Admin, Asset Manager, Dept Head — counts, utilization rate, most-used + idle rankings |
| GET | `/reports/due-for-maintenance` | same — sorted by days since last service, nearing-retirement flags |
| GET | `/reports/depreciation?category_id=` | Admin, Asset Manager |
| GET | `/reports/export?type=assets\|allocations\|maintenance` | Admin, Asset Manager — streams a CSV |

## Dashboard, Notifications & Activity Log

| Method | Path | Access |
|---|---|---|
| GET | `/dashboard` | any — the six KPI counts, scoped to the viewer's role |
| GET | `/notifications` | any — own notifications, newest first |
| PATCH | `/notifications/:id/read` | any — own only |
| PATCH | `/notifications/read-all` | any — own only |
| GET | `/activity-log` | any — Admin/Asset Manager: full log; Dept Head: dept-scoped; Employee: own actions |

## Background jobs

- **Overdue detection** (daily, midnight): allocations past `expected_return_date` → Overdue Return Alert to the holder *and* their Department Head, deduped to one alert per allocation per day.
- **Booking reminders** (every 5 min): bookings starting within the next 15 minutes → Booking Reminder to the booker, sent once per booking.
