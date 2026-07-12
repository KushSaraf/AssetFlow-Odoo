# AssetFlow

**Enterprise Asset & Resource Management System** — track, allocate, and maintain physical assets and shared resources through a single ERP-style platform. Works for any organization with equipment, furniture, vehicles, or shared spaces.

Built with an Odoo-inspired operational UI: dense lists, kanban workflows, form views, and a role-scoped dashboard.

## Features

| # | Module | What it does |
|---|---|---|
| 1 | **Auth** | Email/password login & signup. Signup always creates an Employee account — roles are only ever assigned by an Admin (no self-elevation). |
| 2 | **Dashboard** | Live KPI cards (Assets Available, Assets Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns), overdue-returns panel, upcoming bookings, recent activity, quick actions — all scoped to the viewer's role. |
| 3 | **Organization Setup** (Admin) | Departments (with hierarchy + heads), asset categories (with dynamic custom fields, e.g. *Warranty Period* for Electronics), employee directory with promote/revoke role actions. |
| 4 | **Asset Directory** | Register assets with auto-generated sequential tags (`AF-0001`), search/filter by tag, serial, category, status, department, location. Per-asset allocation + maintenance history. |
| 5 | **Allocation & Transfer** | Allocate to an employee *or* department. Double-allocation is blocked at the **database level** (partial unique index) and surfaces as a conflict modal — *"currently held by Priya Shah"* — with a one-click Transfer Request. Transfers: `Requested → Re-allocated / Rejected`. |
| 6 | **Resource Booking** | Time-slot booking of shared resources with true interval-overlap rejection (9:00–10:00 blocks 9:30–10:30 but allows 10:00–11:00). Derived Upcoming/Ongoing/Completed statuses, reminder notifications before a slot starts. |
| 7 | **Maintenance** | Kanban approval workflow: `Pending → Approved → Technician Assigned → In Progress → Resolved`. Approval flips the asset to *Under Maintenance*; resolution reverts it to its prior status. |
| 8 | **Asset Audit** | Audit cycles with assigned auditors, per-asset Verified/Missing/Damaged findings, auto-generated discrepancy reports. Closing a cycle marks Missing assets *Lost* and routes Damaged assets into maintenance. |
| 9 | **Reports & Analytics** | Utilization (most-used vs idle), maintenance frequency, due-for-maintenance, department allocation summary, booking heatmap. CSV/PDF export. |
| 10 | **Notifications & Activity Log** | Full notification catalog (assignments, approvals, bookings, overdue alerts, audit flags) plus an append-only who-did-what-when activity log. |

## Roles

| Role | Access |
|---|---|
| **Admin** | Org setup, audit cycles, org-wide analytics, everything |
| **Asset Manager** | Register/allocate assets, approve transfers/returns/maintenance, act as auditor |
| **Department Head** | Dept-scoped views, approve transfers within their department, book on behalf of dept |
| **Employee** | Own assets & bookings, raise maintenance/transfer/return requests |

## Tech Stack

- **Backend** — NestJS 11, Prisma 7, SQLite (libSQL adapter), JWT + Passport, `@nestjs/schedule` cron jobs
- **Frontend** — Next.js 16 (App Router), React 19, TanStack Query 5, Tailwind CSS 4
- **Tests / CI** — Jest unit tests for the business-critical rules, GitHub Actions (build + test + seed smoke)

## Quickstart

Prereqs: Node.js ≥ 18.

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npx ts-node -r dotenv/config prisma/seed.ts   # demo data
npm run start:dev                              # http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                                    # http://localhost:3000
```

Windows: run `install.bat` then `start-windows.bat`. Ubuntu: `./start-ubuntu.sh`.

### Demo credentials (password for all: `password123`)

| Email | Role |
|---|---|
| admin@assetflow.com | Admin |
| kamya@assetflow.com / vikram@assetflow.com | Asset Manager |
| aditi@assetflow.com | Department Head (Engineering) |
| rohan@assetflow.com | Department Head (Facilities) |
| sana@assetflow.com | Department Head (Field Ops) |
| priya@assetflow.com / raj@assetflow.com | Employee |

Seeded demo scenarios: Room B2 is booked 9:00–10:00 (try 9:30–10:30 to see the overlap rejection), laptop AF-0114 is held by Priya (try re-allocating it to see the conflict modal), and van AF-0045 is 5 days overdue (visible on the dashboard).

## Tests

```bash
cd backend && npm test
```

Covers the two headline business rules — booking overlap (reject overlapping, accept back-to-back) and allocation conflict (block + report current holder) — plus validation guards.

## Documentation

- [docs/API.md](docs/API.md) — full REST API reference with per-route role access
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, data model, business rules, notification catalog
- [docs/ui-spec.md](docs/ui-spec.md) — design system & per-screen UX spec
- [docs/description.pdf](docs/description.pdf) — original problem statement

## Repository Layout

```
backend/    NestJS API (src/<module>/, prisma/schema.prisma, prisma/seed.ts)
frontend/   Next.js app (src/app/ routes, src/components/, src/lib/api.ts)
docs/       API reference, architecture, UI spec, brief
.github/    CI workflow (backend build+test+seed, frontend build)
```
