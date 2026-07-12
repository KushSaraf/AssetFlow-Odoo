# AssetFlow — Frontend Plan (Owner: Frontend/UI person)

## Scope & Ownership
You own: every screen in `docs/ui-spec.md` §3, the shared component library from §1.3, role-based navigation/rendering, and wiring forms to the API contract in `docs/backend/PLAN.md` §3. Client-side validation (per `ui-spec.md` §7.1) is a UX nicety, not the source of truth — always handle the `409`/`422` error shape from the API too, don't assume client-side checks catch everything.

Reference: `docs/ui-spec.md` §1 (design system/tokens/components), §2 (role matrix — drives what's in the nav), §3 (every screen's fields/states/role variants), §7.1 (validation copy). Also see `docs/backend/PLAN.md` (the API you consume) and `docs/database/PLAN.md`.

## 0. Stack
- **Next.js** (App Router) — route per screen, e.g. `/app/(auth)/login`, `/app/dashboard`, `/app/org-setup`, `/app/assets`, `/app/allocations`, `/app/bookings`, `/app/maintenance`, `/app/audit`, `/app/reports`, `/app/notifications`. Use Server Components for the initial data fetch where it's simple read-only data, Client Components wherever there's interactivity (forms, drag-and-drop kanban, calendar).
- **Tailwind CSS** — implement the `ui-spec.md` §1.1/§1.2 tokens (colors, spacing, radius) as `tailwind.config` theme extensions, not inline hex/px values scattered through components.
- **shadcn/ui** — maps directly onto the shared component list in §2 below: `Table`/`DataTable` recipe → `DataTable`, `Dialog` → `Modal`, `Badge` → `StatusBadge`, `Card` → `StatCard`, `Tabs` + `Form` → `FormView`, `Sonner`/`Toast` → `Toast`. `KanbanBoard` has no shadcn primitive — build it custom (drag via `@dnd-kit` or similar) on top of shadcn `Card`.
- **React Query (TanStack Query)** — one `useQuery`/`useMutation` hook per endpoint in `docs/backend/PLAN.md` §3. Put the `{error:{code, message, field, meta}}` handling (§6 below) in each mutation's `onError`, not duplicated per screen.
- **FullCalendar** — Screen 6 (Resource Booking) calendar/timeline view; feed it `GET /bookings` results and render the overlap-rejection response inline rather than trusting FullCalendar's own conflict detection (the server is the source of truth, per `docs/backend/PLAN.md` §3).
- **Charts** (e.g. Recharts) — Screen 9 (Reports & Analytics): bar charts for utilization/maintenance frequency, a grid/heatmap component for booking heatmap.

## 1. Task Checklist
- [ ] App shell: top app bar + collapsible left sidebar (`ui-spec.md` §1.3), role-filtered nav items per §2.
- [ ] Auth flow: login/signup screens (§3 Screen 1), token storage, route guard — redirect to login if unauthenticated, show a "not yet assigned to a department" banner on Dashboard if `department_id` is null.
- [ ] Shared component library (§2 below) — build once, before starting individual screens.
- [ ] Build all 10 screens per the breakdown in §3.
- [ ] Client-side validation mirroring `ui-spec.md` §7.1 (inline, on blur + on submit).
- [ ] Global error handling: a shared React Query `onError` (or a `QueryClient` default) that intercepts the `{error:{code, message, field}}` shape from the API (see `docs/backend/PLAN.md` §4) and routes it to an inline field error, a `Toast`, or a special-case `Modal` (conflict-block, overlap) depending on `code`.
- [ ] Notification bell: `useQuery` on `GET /notifications` with a short poll interval, unread badge, flyout list, deep-link on click.
- [ ] Responsive UI: Tailwind breakpoints on every screen; `Sidebar` collapses to a hamburger/bottom-nav below `md`, `DataTable`s scroll horizontally or drop to a stacked-card layout on mobile, `KanbanBoard` scrolls horizontally with one column visible at a time on small screens.

## 2. Shared Component Library (build first)
Straight from `ui-spec.md` §1.3 — used on every screen, so get these right once instead of rebuilding per-screen:
- `TopAppBar` — breadcrumb, search, bell, user menu
- `Sidebar` — role-filtered nav (hide items the current role has `No access` to, per §2's Role Matrix — don't just disable them)
- `DataTable` — sortable columns, row-select, filter chips, group-by, pagination
- `KanbanBoard` — column-per-stage, draggable cards, a drop-confirm hook for moves with side effects
- `FormView` ("notebook") — tabs, status stepper, smart-buttons, Save/Discard
- `StatusBadge` — colored pill; takes a status string + domain, looks up the color from `ui-spec.md` §1.1's status color table
- `StatCard` — KPI number + label + click-through to the filtered list
- `Modal`, `Toast`

## 3. Screen-by-Screen Build List
Each entry: components used, endpoints consumed (`method — path`, from `docs/backend/PLAN.md` §3), role-specific rendering notes.

**1. Login/Signup** — plain form, no shared shell. `POST /auth/signup`, `POST /auth/login`, `POST /auth/forgot-password`. No role field anywhere on the signup form — don't render one, per the brief's non-self-elevation requirement.

**2. Dashboard** — `StatCard` row, two-panel body (Overdue / Upcoming + Recent Activity), Quick Actions. `GET /dashboard/kpis`, `GET /dashboard/overdue`, `GET /dashboard/recent-activity`. Same component tree across roles; only the data returned changes (server scopes it) — don't duplicate role logic client-side here.

**3. Organization Setup** — `Tabs` + `DataTable` + `FormView` per tab. `GET/POST/PUT /departments`, `GET/POST /categories` + `/categories/:id/fields`, `GET/PUT /employees` + `/employees/:id/promote` + `/revoke`. Only render this item in the nav if `role === Admin`.

**4. Asset Directory** — `DataTable` (+ optional Kanban toggle) + `FormView` with Info / Allocation History / Maintenance History / Documents tabs. `GET /assets`, `POST /assets`, `GET /assets/:id`, `GET /assets/:id/allocation-history`, `GET /assets/:id/maintenance-history`, `GET /assets/tag/:tag` (QR search — fall back to manual tag entry, no third-party scanner dependency). Hide `+ Register Asset` for Dept Head/Employee.

**5. Allocation & Transfer** — `DataTable` + `FormView` + conflict `Modal`. `GET /allocations`, `POST /allocations` (on `409 already_allocated`, render the conflict modal using `meta.current_holder`, offer "Request Transfer" pre-filled into `POST /transfer-requests`), `POST /allocations/:id/return`, `POST /transfer-requests/:id/approve|reject`.

**6. Resource Booking** — calendar/timeline view + `FormView` panel. `GET /bookings/resources`, `GET /bookings`, `POST /bookings` (on `409 overlap`, show the inline rejection message using `meta.conflicting_booking`), `POST /bookings/:id/cancel`, `PUT /bookings/:id`.

**7. Maintenance Management** — `KanbanBoard` (+ List toggle) + `FormView`. `GET /maintenance-requests`, `POST /maintenance-requests`, plus the five action endpoints (`approve/reject/assign-technician/start/resolve`) wired to card drag for Asset Manager, and to explicit buttons (no drag) for roles that can only raise/view requests.

**8. Asset Audit** — `DataTable` (cycle list) + cycle detail with a checklist `DataTable`. `POST /audit-cycles`, `GET /audit-cycles`, `GET /audit-cycles/:id`, `POST /audit-cycles/:id/findings`, `GET /audit-cycles/:id/discrepancy-report`, `POST /audit-cycles/:id/close` (confirm modal showing the side-effect summary from the response). Not in nav for Employee role.

**9. Reports & Analytics** — chart components (bar/heatmap) + `DataTable` for tabular reports. All `GET /reports/*` + `GET /reports/export`. Not in nav for Employee role.

**10. Activity Logs & Notifications** — two tabs: `NotificationList` + `DataTable` (activity log). `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /activity-log`.

## 4. Client-Side Validation
Mirror `ui-spec.md` §7.1's table exactly — same field, same rule, same message. That table is the shared contract between your inline validation and Backend's server-side validation; don't invent different copy on either side.

## 5. Handoff / Build-Order Notes
- You need Backend's endpoints live (even against seeded data) before a screen is truly done — coordinate build order with `docs/backend/PLAN.md`'s checklist. If an endpoint isn't ready yet, stub it locally against the response shapes in §3 so you're not blocked.
- Design tokens (colors/type/spacing, `ui-spec.md` §1.1/§1.2) get implemented once as a shared stylesheet/theme, not re-declared per component or per screen.
