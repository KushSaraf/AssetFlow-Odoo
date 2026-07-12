# AssetFlow — Backend Plan (Owner: Backend/API person)

## Scope & Ownership
You own: the API server, authentication/RBAC, business logic (state machines, conflict/overlap checks), server-side validation, and notification generation. Your output is the API contract in §3 — Frontend builds against it, so keep it stable once agreed; if it needs to change, tell Frontend before you change it, not after.

Reference: `docs/ui-spec.md` §3 (screen behavior), §4 (data model — owned by `docs/database/PLAN.md`, you consume it), §5 (asset lifecycle triggers), §6 (notification catalog), §7.1 (validation rules/copy).

## 0. Stack
- **NestJS** — one module per resource, matching the contract groups in §3: `AuthModule`, `DepartmentsModule`, `CategoriesModule`, `EmployeesModule`, `AssetsModule`, `AllocationsModule`, `BookingsModule`, `MaintenanceModule`, `AuditModule`, `ReportsModule`, `NotificationsModule`.
- **Prisma** — `PrismaService` wraps `PrismaClient`, injected into every module's service layer. The schema (`prisma/schema.prisma`) is owned by the Database person (`docs/database/PLAN.md`) — you consume the generated client, you don't redefine models. Two of the business-critical constraints (one-open-allocation-per-asset, no-overlap booking) can't be expressed in Prisma's schema DSL — they exist as hand-written SQL in the migration (see `docs/database/PLAN.md` §3), so your service code must catch the resulting DB errors (Postgres unique-violation `23505` / exclusion-violation `23P01`, surfaced by Prisma as `PrismaClientKnownRequestError`) and translate them into the `409` shapes in §4 below, rather than assuming a plain `try/catch` on application logic is enough.
- **JWT** — `@nestjs/jwt` + `passport-jwt` strategy; token carries `{sub: employee_id, role}`.
- **RBAC** — a `RolesGuard` + `@Roles(...roles)` decorator applied per-route, checked against the `role` claim in the JWT. Every route in §3 declares its allowed role(s) — wire the decorator to match that table exactly, don't leave any route ungated.
- **Cron** — `@nestjs/schedule`'s `@Cron()` for the overdue-detection background job (checklist item below) and for firing `Booking Reminder` notifications ahead of a slot's start time.
- **REST APIs** — plain REST/JSON per the contract in §3, no GraphQL layer.

## 1. Task Checklist
- [ ] Auth: signup (Employee-only, ignores any client-sent role — see §2), login, forgot-password stub, session/JWT handling, `GET /auth/me`.
- [ ] RBAC middleware: every endpoint in §3 declares which role(s) may call it; a role mismatch is a `403`, not a hidden `200` with filtered data.
- [ ] CRUD for Department, Category, Employee (Org Setup — Admin-only writes).
- [ ] Asset endpoints: register, search/filter, detail, history, status actions.
- [ ] Allocation & Transfer endpoints, including the conflict-block response shape.
- [ ] Booking endpoints, including the overlap-rejection response shape.
- [ ] Maintenance endpoints + the asset-status side effects on approve/resolve.
- [ ] Audit cycle endpoints + close-cycle side effects (Lost / auto-created maintenance request).
- [ ] Reports endpoints (read-only aggregation queries).
- [ ] Notifications + activity log endpoints, and the service that writes rows into `notification` from every trigger in `ui-spec.md` §6.
- [ ] Background job: overdue detection (allocations past `expected_return_date`, bookings/maintenance past SLA) — run on a schedule, not computed only when the dashboard is open, so notifications fire even if nobody's looking.
- [ ] Consistent error response shape (§4) so Frontend can render field-level errors generically.

## 2. Security & Non-Self-Elevation (explicitly called out in the brief)
- `POST /auth/signup` **ignores any `role` field in the request body**, even if the client sends one — always creates `role = Employee`, `department_id = null`. This must be a server-side guarantee, not a UI-hidden field: test it by sending `role: "Admin"` in the raw request body and confirming it's silently ignored.
- Only `PATCH /employees/:id/promote` (Admin-only via RBAC) may change `role`. No other endpoint touches that column.
- Passwords hashed (never stored/logged in plaintext), and login errors are generic ("Invalid email or password") — never reveal whether the email exists.

## 3. API Contract

Base path `/api`. Auth via `Authorization: Bearer <token>` unless marked public. `Role` = who may call it (roles from `ui-spec.md` §2).

### Auth
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | /auth/signup | public | `{name, email, password}` | `{token, user}` — always role=Employee |
| POST | /auth/login | public | `{email, password}` | `{token, user}` |
| POST | /auth/forgot-password | public | `{email}` | `{message}` (generic, doesn't leak account existence) |
| GET | /auth/me | any | — | current `user` |

### Departments (Org Setup Tab A)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /departments | any | `?status=` | `Department[]` |
| POST | /departments | Admin | `{name, head_employee_id?, parent_department_id?}` | `Department` |
| PUT | /departments/:id | Admin | same | `Department` |
| PATCH | /departments/:id/status | Admin | `{status}` | `Department` |

### Categories (Org Setup Tab B)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /categories | any | — | `Category[]` (with `fields[]`) |
| POST | /categories | Admin | `{name, description?}` | `Category` |
| POST | /categories/:id/fields | Admin | `{field_name, field_type, required}` | `CategoryField` |

### Employees (Org Setup Tab C)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /employees | Admin, Asset Manager, Dept Head (scoped) | `?department_id=&role=&status=` | `Employee[]` |
| PUT | /employees/:id | Admin | `{department_id?, status?}` | `Employee` |
| PATCH | /employees/:id/promote | Admin | `{role: "Department Head"\|"Asset Manager"}` | `Employee` |
| PATCH | /employees/:id/revoke | Admin | — | `Employee` (role → Employee) |

### Assets (Screen 4)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /assets | any (scoped) | `?q=&tag=&serial=&category_id=&status=&department_id=&location=&bookable=` | `Asset[]` |
| GET | /assets/:id | any (scoped) | — | `Asset` |
| GET | /assets/tag/:tag | any | — | `Asset` (QR/tag lookup) |
| POST | /assets | Admin, Asset Manager | `{name, category_id, serial_number?, acquisition_date, acquisition_cost?, condition, location, is_bookable, custom_fields{}}` | `Asset` (status=Available, tag auto-generated) |
| PUT | /assets/:id | Admin, Asset Manager | same fields | `Asset` |
| PATCH | /assets/:id/status | Admin, Asset Manager | `{status: "Retired"\|"Disposed"\|"Available"}` | `Asset` — `409` if asset has an open allocation/booking |
| GET | /assets/:id/allocation-history | any (scoped) | — | `Allocation[]` |
| GET | /assets/:id/maintenance-history | any (scoped) | — | `MaintenanceRequest[]` |
| POST | /assets/:id/documents | Admin, Asset Manager | multipart file | `Document` |

### Allocations & Transfers (Screen 5)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /allocations | scoped per role | `?asset_id=&employee_id=&department_id=&status=&overdue=true` | `Allocation[]` |
| POST | /allocations | Admin, Asset Manager, Dept Head (own dept) | `{asset_id, employee_id? or department_id?, expected_return_date?}` | `201 Allocation` **or** `409 {error:{code:"already_allocated", meta:{current_holder}}}` — drives the conflict-block modal in `ui-spec.md` §3 Screen 5 |
| POST | /allocations/:id/return | Admin, Asset Manager | `{condition_in, checkin_notes}` | `Allocation` (returned_at set, asset → Available) |
| POST | /transfer-requests | asset holder, Dept Head, Asset Manager | `{asset_id, to_employee_id? or to_department_id?, reason}` | `TransferRequest` (status=Requested) |
| POST | /transfer-requests/:id/approve | Asset Manager, Dept Head (own dept) | — | `TransferRequest` (status=Approved → auto Re-allocated: old allocation closed, new one opened) |
| POST | /transfer-requests/:id/reject | Asset Manager, Dept Head (own dept) | `{reason}` | `TransferRequest` |

### Bookings (Screen 6)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /bookings/resources | any | — | bookable `Asset[]` |
| GET | /bookings | any (scoped) | `?asset_id=&date=` | `Booking[]` |
| POST | /bookings | any | `{asset_id, start_time, end_time, purpose?, on_behalf_of_department_id?}` | `201 Booking` **or** `409 {error:{code:"overlap", meta:{conflicting_booking}}}` — drives the overlap-rejection message in `ui-spec.md` §3 Screen 6 |
| PUT | /bookings/:id | owner, Admin, Asset Manager | `{start_time, end_time}` | reschedule — re-runs the same overlap check |
| POST | /bookings/:id/cancel | owner, Admin, Asset Manager | `{reason?}` | `Booking` (status=Cancelled) |

### Maintenance (Screen 7)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| GET | /maintenance-requests | scoped per role | `?status=&asset_id=` | `MaintenanceRequest[]` |
| POST | /maintenance-requests | holder of an allocated asset, Asset Manager (any asset) | `{asset_id, issue, priority, photo?}` | `MaintenanceRequest` (status=Pending) |
| POST | /maintenance-requests/:id/approve | Asset Manager | — | status=Approved, **side effect: asset.status → Under Maintenance** |
| POST | /maintenance-requests/:id/reject | Asset Manager | `{reason}` | status=Rejected |
| POST | /maintenance-requests/:id/assign-technician | Asset Manager | `{technician}` | status=Technician Assigned |
| POST | /maintenance-requests/:id/start | Asset Manager | — | status=In Progress |
| POST | /maintenance-requests/:id/resolve | Asset Manager | `{resolution_notes}` | status=Resolved, **side effect: asset.status → prior allocation state, or Available if none** |

### Audit (Screen 8)
| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | /audit-cycles | Admin | `{name, scope_department_id?, scope_location?, start_date, end_date, auditor_ids[]}` | `AuditCycle` + checklist of in-scope assets |
| GET | /audit-cycles | scoped per role | — | `AuditCycle[]` |
| GET | /audit-cycles/:id | scoped per role | — | `AuditCycle` + `findings[]` |
| POST | /audit-cycles/:id/findings | assigned auditor | `{asset_id, result, notes?}` | `AuditFinding` (notes required if result ≠ Verified) |
| GET | /audit-cycles/:id/discrepancy-report | scoped per role | — | `AuditFinding[]` filtered Missing/Damaged |
| POST | /audit-cycles/:id/close | Admin | — | `AuditCycle` (status=Closed); **side effects**: Missing → asset.status=Lost, Damaged → auto-create Pending `MaintenanceRequest` |

### Reports (Screen 9)
| Method | Path | Role | Response |
|---|---|---|---|
| GET | /reports/utilization | Admin, Asset Manager, Dept Head (scoped) | most-used/idle assets |
| GET | /reports/maintenance-frequency | same | grouped counts by asset/category |
| GET | /reports/due-for-maintenance | same | assets sorted by days-until-due |
| GET | /reports/department-allocation-summary | same | table per department |
| GET | /reports/booking-heatmap | same | hour/day grid |
| GET | /reports/export | same | `?type=` → CSV/PDF stream |

### Notifications & Dashboard (Screens 2 & 10)
| Method | Path | Role | Response |
|---|---|---|---|
| GET | /dashboard/kpis | any (scoped) | KPI counts per `ui-spec.md` §3 Screen 2 |
| GET | /dashboard/overdue | any (scoped) | overdue allocations/bookings/maintenance |
| GET | /dashboard/recent-activity | any (scoped) | recent feed |
| GET | /notifications | any (own) | `Notification[]` |
| POST | /notifications/:id/read | any (own) | — |
| POST | /notifications/read-all | any (own) | — |
| GET | /activity-log | scoped per role (Admin=all) | `ActivityLog[]` |

## 4. Error Response Shape (standard across every endpoint)
```json
{
  "error": {
    "code": "already_allocated | overlap | validation_error | forbidden | not_found | ...",
    "message": "human-readable, matches ui-spec.md §7.1 copy where applicable",
    "field": "email",
    "meta": { "current_holder": {}, "conflicting_booking": {} }
  }
}
```
`field` is present only for field-level validation errors. Frontend maps `error.field` → inline field errors, and `error.code` → special-case UI (conflict modal, overlap message) — this shape is contract, not incidental, so don't change it per-endpoint.

## 5. Handoff to Frontend
As each endpoint group ships, share: base URL, auth header format, and keep this table current — Frontend shouldn't have to guess a response shape. If a shape changes, update this file and say so before Frontend hits it broken.
