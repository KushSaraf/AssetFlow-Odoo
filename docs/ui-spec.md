# AssetFlow — UI/UX & Data Model Spec

Source of truth: `description.pdf` (Features, User Roles, Basic Workflow) + `mockup.excalidraw` (low-fi layout/copy). This document turns both into a build-ready spec: every screen, every field, every role's variant of that screen, the validation rules that must be enforced, and the relational schema they all map to.

Visual language: **Odoo-style** — flat, dense, minimal shadow, list/kanban/form-based navigation, breadcrumb top bar, purple accent, compact spacing. Not a marketing-site aesthetic; an operational back-office tool.

---

## 1. Design System

### 1.1 Color

| Token | Hex | Use |
|---|---|---|
| `primary` | `#714B67` | Sidebar active state, primary buttons, links, page-title accents |
| `primary-hover` | `#5B3B53` | Primary button hover/active |
| `bg-page` | `#F7F7F8` | App background behind cards/lists |
| `bg-surface` | `#FFFFFF` | Cards, tables, panels, sidebar |
| `border` | `#E3E3E6` | Table borders, card borders, dividers |
| `text-primary` | `#1F1F1F` | Body text, headings |
| `text-secondary` | `#6C757D` | Meta text, helper text, placeholders |

Status colors (used as pill background + matching text, ~15% tint for bg):

| Domain | Status | Color |
|---|---|---|
| Asset lifecycle | Available | Green `#28A745` |
| | Allocated | Blue `#3B82F6` |
| | Reserved | Amber `#F59E0B` |
| | Under Maintenance | Orange `#FD7E14` |
| | Lost | Red `#DC3545` |
| | Retired | Grey `#6C757D` |
| | Disposed | Dark grey `#343A40` |
| Booking | Upcoming | Blue `#3B82F6` |
| | Ongoing | Green `#28A745` |
| | Completed | Grey `#6C757D` |
| | Cancelled | Red `#DC3545` (strikethrough label) |
| Transfer request | Requested | Amber `#F59E0B` |
| | Approved | Green `#28A745` |
| | Rejected | Red `#DC3545` |
| Maintenance | Pending | Amber `#F59E0B` |
| | Approved | Blue `#3B82F6` |
| | Rejected | Red `#DC3545` |
| | Technician Assigned | Indigo `#6366F1` |
| | In Progress | Orange `#FD7E14` |
| | Resolved | Green `#28A745` |
| Audit finding | Verified | Green `#28A745` |
| | Missing | Red `#DC3545` |
| | Damaged | Orange `#FD7E14` |

Overdue items (allocations/bookings/maintenance past their expected date) get a red left-border (4px) on their row/card in addition to the normal status pill — overdue is a visual overlay, not a separate status.

### 1.2 Typography & spacing

- Font stack: system sans (`-apple-system, "Segoe UI", Roboto, sans-serif`).
- Scale: Page title 20px/600, Section/card title 15px/600, Body 13px/400, Meta/caption 12px/400. Line-height 1.4.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32px. Tables and forms are dense (8–12px row padding), not airy.
- Corner radius: 4px on cards/inputs/buttons, 999px (pill) on status badges. No radius above 6px anywhere — this is what keeps it reading as Odoo rather than a generic SaaS template.
- Elevation: flat by default (1px border, no shadow). Shadow (`0 2px 8px rgba(0,0,0,.12)`) reserved for modals, dropdowns, and the notification flyout only.

### 1.3 Core components (reused across every screen)

- **Top app bar** — breadcrumb (`Module / Screen / Record`) on the left, global search in the center, bell icon with unread-count badge + user avatar/name dropdown (Profile, My Notifications, Logout) on the right.
- **Left sidebar nav** — 220px, collapsible to a 56px icon rail. AssetFlow monogram ("AF") + wordmark at top. Items: Dashboard, Organization Setup, Assets, Allocation & Transfer, Resource Booking, Maintenance, Audit, Reports, Notifications. Items are filtered per role per the Role Matrix (§2) — a role that has no access to a screen does not see it in the nav at all, not a disabled state. Active item: purple left-border (3px) + light-purple background.
- **List view** — top filter bar (free-text search, `Filter` chip dropdown, `Group By` dropdown, view-switch icons for List/Kanban/Calendar where applicable) → sortable data table with row checkboxes for bulk actions → pagination footer (rows-per-page + page nav). Row click opens the record's form view.
- **Kanban view** — one column per workflow stage, each card shows the record's key fields + a status pill + assignee avatar. Dragging a card to another column fires the same state-transition as the equivalent form-view action, and where that transition has side effects (e.g., approving a maintenance card flips the asset to Under Maintenance) the drop shows a confirm dialog before committing.
- **Form view ("notebook")** — breadcrumb + record title + `Save`/`Discard` buttons top-right; a horizontal status stepper showing the record's current lifecycle stage; smart-buttons (small stat buttons, e.g. "3 Maintenance Records") linking to related records; body organized into tabs (e.g. an Asset's form has Info / Allocation History / Maintenance History / Documents tabs) instead of one long scroll.
- **Status badge/pill** — rounded-pill, colored per §1.1, 11px uppercase bold text.
- **Stat-card (KPI)** — white card: large number, label below, click navigates to the corresponding filtered list.
- **Modal/dialog** — centered, 480px max-width, header + body + footer (`Cancel` / primary action). Used for conflict-blocks, confirmations, and quick-create forms.
- **Toast** — top-right slide-in, 4s auto-dismiss, colored left-border by type (success/error/info), used for every write action's result.

---

## 2. Role Matrix

`No access` = screen absent from that role's nav. `View` = read-only. `View+Act` = can perform the listed actions.

| Screen | Admin | Asset Manager | Department Head | Employee |
|---|---|---|---|---|
| 1. Login/Signup | Pre-auth, all roles | Pre-auth, all roles | Pre-auth, all roles | Pre-auth, all roles |
| 2. Dashboard | View+Act — org-wide KPIs, all quick actions | View+Act — asset-ops KPIs, all quick actions | View+Act — dept-scoped KPIs, book/raise-request quick actions | View+Act — personal KPIs, book/raise-request quick actions |
| 3. Organization Setup | View+Act — only role with access; all 3 tabs | No access | No access | No access |
| 4. Asset Registration & Directory | View+Act — full CRUD, all assets | View+Act — full CRUD, all assets | View — assets allocated to their department only | View — own allocated assets + assets flagged shared/bookable |
| 5. Allocation & Transfer | View+Act — override/reassign any asset | View+Act — allocate, approve transfers, approve returns | View+Act — approve allocation/transfer requests within their dept, view dept allocations | View+Act — initiate transfer/return request for assets they hold, view own |
| 6. Resource Booking | View+Act — manage bookable-resource list, book | View+Act — manage bookable-resource list, book | View+Act — book on behalf of department, view dept bookings | View+Act — book for self, view/cancel own bookings |
| 7. Maintenance Management | View — org-wide oversight only | View+Act — approve/reject, assign technician, mark resolved | View — dept requests only | View+Act — raise request for an asset allocated to them, view own requests |
| 8. Asset Audit | View+Act — create audit cycle, assign auditors, close cycle | View+Act — act as assigned auditor (mark Verified/Missing/Damaged), resolve discrepancies | View — dept-scoped findings only | No access |
| 9. Reports & Analytics | View+Act — org-wide, export | View+Act — asset/maintenance-scoped, export | View — dept-scoped only | No access |
| 10. Activity Logs & Notifications | View+Act — full org activity log + own notifications | View — own notifications + asset-ops-relevant log entries | View — own notifications + dept-relevant log entries | View — own notifications only |

---

## 3. Per-Screen Specs

### Screen 1 — Login / Signup

**Purpose:** Authenticate users with realistic, non-self-elevating account creation.

**Layout regions:** Centered auth card (420px) on a plain branded background. Card header: "AF" monogram + "AssetFlow" wordmark. Two modes toggled by a link at the bottom: Login / Sign up.

**Fields & components:**
- Login: Email (text, required, email format), Password (password, required), "Forgot password" link, `Log in` primary button.
- Sign up: Full Name (text, required), Email (text, required, unique, email format), Password (password, required, min 8 chars, show strength meter), Confirm Password (must match), `Create Account` primary button. **No role field anywhere on this form** — every signup creates an Employee-role account with no department assigned yet; department is assigned later by an Admin/Dept Head via Screen 3.
- Helper copy under the signup form: "Sign up creates an Employee account. Department Head and Asset Manager roles are assigned by an Admin."
- Forgot password: Email input → "reset link sent" confirmation state (no token flow specified beyond this in the brief; keep it a stub screen).

**States:** Empty/default. Field-level validation errors inline (red border + message) on blur, e.g. "Enter a valid email address." Auth failure → non-specific toast ("Invalid email or password") — never reveal whether the email exists, standard security practice. Loading state on submit (button spinner, disabled). Session-expired: any authenticated route hit with an invalid/expired session redirects here with a toast "Your session has expired, please log in again."

**Role-based variant:** None — this screen is identical and role-agnostic (role doesn't exist yet at this point).

**Key interactions & validation:**
- Email uniqueness enforced server-side; duplicate signup email → inline error "An account with this email already exists."
- Password rules enforced both client-side (immediate feedback) and server-side (never trust client-only validation).
- Successful signup logs the user in and routes to the Dashboard with an empty/no-department state (see Screen 2 empty state).

**Notifications:** None fired from this screen.

---

### Screen 2 — Dashboard / Home

**Purpose:** Give every role a real-time operational snapshot.

**Layout regions:** Page title ("Good morning, {Name}") → KPI stat-card row → two-column body: left = "Overdue" panel (red-accented) stacked above "Upcoming" panel, right = "Recent Activity" feed → Quick Actions bar (bottom or sidebar-adjacent).

**Fields & components (KPI cards, per brief):** Assets Available, Assets Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns. Each card shows a count and is clickable through to the filtered list (e.g. "Assets Available" → Screen 4 filtered to status=Available).

Example sample data for the mockup: Available 128, Allocated 76, Maintenance Today 9, Active Bookings 12, Pending Transfers 3, Upcoming Returns 4.

**Overdue panel:** distinct from "Upcoming" — lists items already past their Expected Return Date/booking end/maintenance SLA with a red left-border and "N days overdue" caption, e.g. "3 assets overdue for return — flagged for follow-up." Clicking a row deep-links to the relevant record.

**Recent Activity feed:** last ~10 org/dept/personal events (scope depends on role), e.g. "Laptop AF-0114 allocated to Priya Shah — Engineering", "Room B2 booked 2:00–3:00 PM", each with a relative timestamp ("18m ago").

**Quick actions:** `+ Register Asset` (Asset Manager/Admin only), `Book Resource` (all roles), `Raise Maintenance Request` (all roles, must have at least one allocated asset).

**Role-based variant:**
- Admin: org-wide KPI totals, org-wide activity feed, all quick actions except Register Asset is optional (Admin can, but Asset Manager is primary owner).
- Asset Manager: KPIs scoped to all assets, quick action `+ Register Asset` prominent.
- Department Head: KPIs scoped to their department's assets/bookings/transfers, activity feed scoped to their department.
- Employee: KPIs scoped to assets allocated to them + their own bookings, activity feed scoped to their own actions; no Register Asset action.
- First-login/no-department-yet state: KPI cards show "—" with a banner "You haven't been assigned to a department yet — contact your Admin."

**Key interactions & validation:** Overdue calculation is a derived read (today > expected_return_date / booking end_time / maintenance SLA date) — not a stored flag; recompute on every dashboard load (or on a scheduled job, see Data Model §4 note on Notification generation).

**Notifications:** Dashboard is a consumer of notifications, not a producer — see Screen 10 catalog for what feeds this feed.

---

### Screen 3 — Organization Setup (Admin only, 3 tabs)

**Purpose:** Maintain the master data everything else depends on.

**Layout regions:** Page title "Organization Setup" → tab bar (Departments / Categories / Employee) → tab body is a list view with a `+ Add` button top-right that opens a create modal/form.

#### Tab A — Department Management
**Fields:** Name (text, required, unique), Department Head (select, sourced from Employee Directory — only employees already promoted to Department Head, or "unassigned"), Parent Department (select, optional, sourced from existing departments, excludes self and descendants to prevent cycles), Status (toggle: Active/Inactive).
**List columns:** Name, Head, Parent Dept, Status, Employee count.
**States:** Deactivating a department with active employees/assets still assigned shows a confirm dialog ("This department has 12 active employees. They will remain assigned but the department will stop appearing in new-allocation pickers.") — deactivate, don't hard-delete.
**Interactions:** Creating/editing a department here immediately updates the Department picklist everywhere else in the app (Employee Directory, Asset Directory filters, Allocation forms, Booking "on behalf of department").

#### Tab B — Asset Category Management
**Fields:** Name (text, required, unique, e.g. Electronics/Furniture/Vehicles), Description (text, optional), Category-specific fields (dynamic list-builder: field name + field type [text/number/date] + required toggle — e.g. Electronics category adds a "Warranty Period (months)" number field that then appears on the Asset Registration form, §4, whenever that category is selected).
**List columns:** Name, # Assets in category, # custom fields, Status.
**States:** A category with assets already registered under it cannot be deleted, only deactivated (same pattern as departments).

#### Tab C — Employee Directory
**Fields:** Name (text, required), Email (text, required, unique), Department (select), Role (read-only display; Employee is default at signup), Status (Active/Inactive).
**List columns:** Name, Email, Department, Role (as a badge), Status.
**Role promotion:** Row action menu → "Promote to Department Head" / "Promote to Asset Manager" / "Revoke role (revert to Employee)". This is a modal confirming the change and, for Dept Head promotion, requiring a Department selection if one isn't already set. **This is the only place in the entire app roles are assigned** — call this out explicitly in the UI copy of the promote modal ("Role changes are only made here.") to reflect the brief's non-self-elevation requirement.
**States:** Deactivating an employee who currently holds allocated assets or has pending approvals shows a warning listing what needs to be reassigned first.

**Role-based variant:** Entire screen Admin-only; no other role sees this in nav (per Role Matrix).

**Notifications:** Promoting/demoting a user fires a notification to that user ("Your role has been updated to Department Head").

---

### Screen 4 — Asset Registration & Directory

**Purpose:** Register assets and search/track them centrally.

**Layout regions:** List view by default (Kanban/grid toggle optional) with a persistent search bar ("Search by tag, serial, or QR code…") + filter chips (Category, Status, Department, Location) → `+ Register Asset` button opens the registration form. Row click → Asset form view with tabs.

**Registration fields:** Name (text, required), Category (select, sourced from Screen 3 Tab B — selecting a category dynamically renders that category's custom fields, e.g. Warranty Period for Electronics), Asset Tag (auto-generated, read-only, format `AF-0001` sequential), Serial Number (text, optional, unique if provided), Acquisition Date (date, required), Acquisition Cost (currency, optional — explicitly kept for ranking/reporting only, never linked to accounting), Condition (select: New/Good/Fair/Poor), Location (text/select, free-text or a saved-locations list), Photo/Documents (file upload, multiple), Shared/Bookable flag (toggle — when on, the asset also appears as a bookable resource in Screen 6).

**Directory list columns:** Asset Tag, Name, Category, Status (pill), Department, Location, Condition.

**Asset form tabs:** Info (the registration fields, editable), Allocation History (table: Employee/Dept, From, To, Returned condition notes), Maintenance History (table: Date raised, Issue, Priority, Status, Resolved date), Documents (uploaded files/photos).

**Status pill per asset:** Available / Allocated / Reserved / Under Maintenance / Lost / Retired / Disposed — see the full transition table in §5.

**States:** Empty directory (no assets yet) → illustration + `+ Register Asset` CTA. Search with no results → "No assets match your search." QR code search: a camera/scan icon next to the search bar opens a scanner (or manual QR-string paste) that resolves straight to the matching Asset Tag.

**Role-based variant:**
- Admin / Asset Manager: full CRUD, see all assets, can register.
- Department Head: read-only list scoped to `department = their department`, no Register button.
- Employee: read-only list scoped to `allocated_to = me` UNION `shared/bookable = true`, no Register button, no Department/Location filters (not relevant to their scope).

**Key interactions & validation:** Asset Tag is never user-editable (system-generated, guarantees uniqueness). Serial Number, if provided, must be unique across active assets. Retiring/disposing an asset is a status action available only when the asset has no open allocation/booking (guard, not just a warning).

**Notifications:** None fired directly by registration; downstream screens (Allocation, Maintenance) fire notifications referencing the asset.

---

### Screen 5 — Asset Allocation & Transfer

**Purpose:** Manage who holds what, with explicit conflict rules.

**Layout regions:** List view of allocations (current + historical, filterable by status) → `Allocate Asset` action (from an Available asset's form, or from here picking an asset) opens the allocation form. Each allocation row has row-actions: Transfer, Return, View History.

**Allocation form fields:** Asset (select, searchable by tag/name, filtered to status=Available at open time), Allocate To (radio: Employee / Department, then a matching select), Expected Return Date (date, optional), Notes (text, optional).

**Conflict rule (must be a literal worked example in the UI, per brief):** If the selected asset already has an open allocation, the form does not silently fail — on attempting to submit, a modal appears:
> **Asset already allocated.** AF-0114 – Dell Laptop is currently held by **Priya Shah (Engineering)**. Direct re-allocation is blocked.
> `[Cancel]` `[Request Transfer]`

Choosing `Request Transfer` opens the Transfer Request form pre-filled with the asset and current holder.

**Transfer workflow (state machine, shown as a status pill on the transfer record):** `Requested` → `Approved` (by Asset Manager, or by Department Head if the transfer is within their department) → `Re-allocated` (the system automatically closes the old allocation and opens a new one, and both show up in the asset's Allocation History tab). A `Rejected` terminal state is also available to the approver, with a required reason note.

**Return flow:** From an active allocation's row-action `Return` → modal: Condition Check-in Notes (text, required), Condition rating (select, matches Asset condition options) → on submit, the allocation is closed (`returned_at` set), the asset status reverts to Available, and (per Role Matrix) an Asset Manager approval step gates the return being finalized — Employee/Dept Head can *initiate* a return, but the Asset Manager confirms the condition check-in before the asset flips back to Available.

**Overdue handling:** Any allocation past its Expected Return Date is auto-flagged: red left-border row + "N days overdue" badge, and feeds Screen 2's Overdue panel and Screen 10's notifications. This is a derived/computed flag, not manually set.

**Role-based variant:**
- Asset Manager / Admin: full allocate/approve/return access across all assets.
- Department Head: sees allocations within their department, can approve/reject Transfer Requests that are within their department, can initiate allocations to their own department's employees.
- Employee: sees only their own current/past allocations; can only *initiate* a Return or Transfer Request for an asset currently allocated to them (no direct allocate/approve access).

**Notifications:** Asset Assigned (to new holder), Transfer Approved/Rejected (to requester and old holder), Overdue Return Alert (to holder + their manager).

---

### Screen 6 — Resource Booking

**Purpose:** Time-slot booking of shared resources with no overlaps.

**Layout regions:** Resource picker (list of assets flagged shared/bookable, e.g. rooms/vehicles/equipment) → Calendar view (day/week) of the selected resource's existing bookings → `Book a Slot` button opens the booking form as a right-side panel or modal.

**Booking form fields:** Resource (pre-selected from picker), Date, Start Time, End Time, Purpose/Notes (text, optional), Book On Behalf Of (Department Head only — defaults to self for Employee).

**Overlap validation (must be a literal worked example, per brief):** Calendar renders existing bookings as blocks. On submit, if the requested range intersects any existing non-cancelled booking for that resource, the request is rejected inline:
> Room B2 is booked **9:00–10:00** (Procurement Team). Your request for **9:30–10:30** overlaps and cannot be booked.
> A request for **10:00–11:00** would be accepted since it starts exactly when the prior booking ends.

This must be enforced as a true interval-overlap check (`new.start < existing.end AND new.end > existing.start`), not a simple exact-match check — the 10:00–11:00 "starts right after" case must succeed.

**Booking status pill:** Upcoming / Ongoing / Completed / Cancelled, computed from current time vs. start/end (Ongoing/Completed are derived, not manually set; Cancelled is the only status a user sets directly).

**Row/card actions:** Cancel (with reason, only before start time), Reschedule (re-opens the form pre-filled, re-runs overlap validation against the new slot).

**States:** Empty calendar day → "No bookings for this day." Past-dated resource with no bookings still browsable read-only.

**Role-based variant:** Admin/Asset Manager additionally manage which assets appear in the resource picker (toggling the shared/bookable flag from Screen 4) and can cancel any booking; Department Head can book on behalf of their department; Employee books only for themselves and can only cancel their own bookings.

**Notifications:** Booking Confirmed (to requester), Booking Cancelled (to requester + anyone with adjacent bookings if relevant), Reminder (sent a configurable window, e.g. 15 min, before the slot starts).

---

### Screen 7 — Maintenance Management

**Purpose:** Route repairs through approval before work starts.

**Layout regions:** Default view is a **Kanban board**, one column per stage: `Pending` → `Approved` (or `Rejected` as a side terminal column) → `Technician Assigned` → `In Progress` → `Resolved`. A List-view toggle is available for filtering/search. `+ Raise Request` button.

**Request form fields:** Asset (select, filtered to assets currently allocated to the requester, or any asset for Asset Manager/Admin), Issue Description (text, required), Priority (select: Low/Medium/High/Critical), Photo attachment (optional).

**Kanban card contents:** Asset Tag + Name, issue one-liner, priority badge, requester, days-in-current-stage.

**Workflow (state machine):**
`Pending` → **Asset Manager decision** → `Approved` or `Rejected` (rejection requires a reason note, terminal) → `Technician Assigned` (Asset Manager assigns a technician, free-text or a saved technician list) → `In Progress` → `Resolved` (resolver notes required).

**Critical side effect (call out explicitly, per brief):** Approving a card is the exact moment the asset's status flips to `Under Maintenance` — not at request time. Resolving a card is the exact moment the asset status reverts to `Available` (unless the asset had an active allocation before maintenance started, in which case it reverts to `Allocated` to the same holder — the maintenance flow doesn't clear an existing allocation). This trigger mapping must be shown as a caption directly on the board: "Approving a card moves the asset to Under Maintenance; resolving returns it to its prior status."

**States:** Rejected cards are visually distinct (greyed, moved to a collapsed/side column) but retained in history, not deleted.

**Role-based variant:** Employee/Department Head can raise a request and watch its status but cannot drag cards between stages; only Asset Manager (and Admin, view-only unless also acting as Asset Manager) can move cards / take the approve-reject-assign-resolve actions.

**Notifications:** Maintenance Approved/Rejected (to requester), technician assignment (to technician if they're a system user), Resolved (to requester + asset's current holder).

---

### Screen 8 — Asset Audit

**Purpose:** Run structured verification cycles instead of a single ad-hoc form.

**Layout regions:** List of Audit Cycles (Name/period, Scope, Status: Draft/In Progress/Closed) → `+ New Audit Cycle` → cycle detail view: header (scope + date range + assigned auditors) + a checklist table of in-scope assets.

**Create Audit Cycle fields:** Name (text, e.g. "Q3 audit: Engineering dept"), Scope (Department and/or Location selects), Date Range (start/end date), Auditors (multi-select from Employee Directory — typically Asset Managers, but not restricted to that role at the data-model level; enforce "must be at least one auditor" at creation).

**Checklist (per in-scope asset):** Asset Tag + Name, Expected Location (from the asset's last known location), Verification (three-way control: `Verified` / `Missing` / `Damaged`), Notes (text, shown when Missing/Damaged is selected — required in that case).

**Discrepancy report:** Auto-generated read-only view, filtered to all `Missing`/`Damaged` findings in the cycle, e.g. "2 assets flagged — discrepancy report generated automatically." Exportable (ties into Screen 9's exportable-reports capability).

**Close Audit Cycle:** A single action, gated behind a confirm modal ("Closing locks this cycle — no further findings can be edited. 2 assets will be marked Lost, 1 marked Under Maintenance-review."). Effects: cycle becomes read-only/locked; every `Missing` finding sets its asset's status to `Lost`; every `Damaged` finding routes the asset into the Maintenance workflow (auto-creates a Pending maintenance request referencing the audit finding) rather than silently changing status.

**States:** In-progress cycle (checklist partially filled) shows a completion progress bar ("14 / 20 assets checked"). Closed cycles are read-only everywhere, including the checklist — no edits, only view.

**Role-based variant:** Admin creates cycles, assigns auditors, closes cycles (view+act on the cycle lifecycle, not necessarily the one entering findings). Asset Manager, when assigned as an auditor, enters findings for their assigned assets. Department Head sees findings scoped to their department, read-only. Employee has no access at all.

**Notifications:** Auditor Assigned (to the auditor), Audit Discrepancy Flagged (to Asset Manager + affected asset's current holder), Audit Cycle Closed (to all auditors + Admin).

---

### Screen 9 — Reports & Analytics

**Purpose:** Give managers actionable operational insight.

**Layout regions:** Report picker (tabs or a left rail of report types) → filter bar (date range, department, category) → chart/table body → `Export Report` button (CSV/PDF).

**Reports (per brief):**
1. **Asset utilization trends** — most-used vs. idle assets (ranked list/bar chart; idle threshold configurable, e.g. "unused 45+ days").
2. **Maintenance frequency** by asset/category (bar chart, count of maintenance requests grouped).
3. **Assets due for maintenance or nearing retirement** (list, sorted by days-until-due, derived from category-level service intervals / acquisition-date age).
4. **Department-wise allocation summary** (table: department, # assets allocated, total acquisition value).
5. **Resource booking heatmap** — peak usage windows by hour/day (grid heatmap, darker = busier).
6. All reports share an `Export Report` action.

**States:** Empty-data report (no maintenance history yet, etc.) shows "Not enough data yet" rather than a broken/empty chart.

**Role-based variant:** Admin sees all reports org-wide. Asset Manager sees asset/maintenance-scoped reports (1–3) org-wide. Department Head sees department-scoped versions of reports 1, 3, 4. Employee has no access (matches Role Matrix).

**Notifications:** None fired from this screen (pure read/export).

---

### Screen 10 — Activity Logs & Notifications

**Purpose:** Keep every role informed without digging for updates.

**Layout regions:** Two sub-areas reachable from the same nav item (tabs): **Notifications** (personal feed) and **Activity Log** (org/dept audit trail — visibility per Role Matrix). Notifications also surface as a bell-icon flyout from the top app bar on every screen (§1.3).

**Notification feed:** Filter chips (All / Alerts / Approvals / Bookings), each item: icon by type, message, relative timestamp, read/unread dot, click deep-links to the source record.

**Activity Log (Admin: full; others: scoped):** Table — Actor, Action, Entity (+ link), Timestamp. Read-only, not exportable from here (reporting export lives in Screen 9).

**Notification catalog** — see §6 for the full table (trigger, recipient, source screen). Types explicitly named in the brief: Asset Assigned, Maintenance Approved/Rejected, Booking Confirmed/Cancelled/Reminder, Transfer Approved, Overdue Return Alert, Audit Discrepancy Flagged.

**States:** Empty notifications → "You're all caught up." Unread count badge on the bell icon; "Mark all as read" action.

**Role-based variant:** Every role sees their own Notifications tab. Activity Log tab: Admin sees everything; Asset Manager/Department Head see entries relevant to their scope (asset-ops or department); Employee sees only their own actions (effectively a personal history, not an "activity log" in the audit sense).

---

## 4. Data Model (Entity-Relationship Design)

Target: PostgreSQL (or MySQL 8+), fully normalized, no document-store/BaaS shortcuts — this is the top-weighted piece of the eventual build, and the field names below are authoritative for every form in §3.

### 4.1 Entities

| Entity | Key fields | Notes |
|---|---|---|
| `department` | `id`, `name` (unique), `parent_department_id` (FK → self, nullable), `head_employee_id` (FK → employee, nullable), `status` (Active/Inactive) | Self-referencing for hierarchy |
| `employee` | `id`, `name`, `email` (unique), `password_hash`, `department_id` (FK, nullable until assigned), `role` (enum: Admin, Asset Manager, Department Head, Employee — default Employee), `status` (Active/Inactive) | Role only ever changes via the promote/revoke action on Screen 3 Tab C |
| `asset_category` | `id`, `name` (unique), `description`, `status` | |
| `asset_category_field` | `id`, `category_id` (FK), `field_name`, `field_type` (text/number/date), `required` (bool) | Backs the one deliberately flexible spot in the schema — category-specific fields |
| `asset_custom_field_value` | `id`, `asset_id` (FK), `category_field_id` (FK), `value` | EAV-lite table so `asset` itself stays a normal fixed-column table; avoids a JSONB blob that reporting queries would have to reach into |
| `asset` | `id`, `tag` (unique, system-generated `AF-0001`), `name`, `category_id` (FK), `department_id` (FK, nullable), `serial_number` (unique, nullable), `acquisition_date`, `acquisition_cost`, `condition` (enum), `location`, `status` (enum: Available/Allocated/Reserved/Under Maintenance/Lost/Retired/Disposed), `is_bookable` (bool) | `status` is written only by the trigger points in §5, never freely edited by a form |
| `asset_document` | `id`, `asset_id` (FK), `file_url`, `type` (photo/document), `uploaded_at` | |
| `allocation` | `id`, `asset_id` (FK), `employee_id` (FK, nullable), `department_id` (FK, nullable — exactly one of employee/department set), `allocated_by` (FK → employee), `allocated_at`, `expected_return_date` (nullable), `returned_at` (nullable), `condition_in`, `condition_out`, `checkin_notes` | **Unique partial index** on `(asset_id) WHERE returned_at IS NULL` — enforces one open allocation per asset at the DB layer |
| `transfer_request` | `id`, `asset_id` (FK), `from_allocation_id` (FK → allocation), `requested_by` (FK), `to_employee_id`/`to_department_id`, `approver_id` (FK, nullable), `status` (enum: Requested/Approved/Rejected/Re-allocated), `reason`, `decided_at` | |
| `resource_booking` | `id`, `asset_id` (FK, `is_bookable=true`), `booked_by` (FK), `on_behalf_of_department_id` (FK, nullable), `start_time`, `end_time`, `purpose`, `status` (enum: Upcoming derived/Cancelled stored; Ongoing/Completed derived from now() vs start/end) | **Exclusion constraint** `EXCLUDE USING gist (asset_id WITH =, tsrange(start_time, end_time) WITH &&) WHERE (status != 'Cancelled')` — this is what makes overlap rejection a DB guarantee, not just an app-level check |
| `maintenance_request` | `id`, `asset_id` (FK), `raised_by` (FK), `issue`, `priority` (enum), `status` (enum: Pending/Approved/Rejected/Technician Assigned/In Progress/Resolved), `approver_id` (FK, nullable), `technician`, `resolution_notes`, `resolved_at`, `source_audit_finding_id` (FK, nullable — set when auto-created by an audit `Damaged` finding) | |
| `audit_cycle` | `id`, `name`, `scope_department_id` (FK, nullable), `scope_location`, `start_date`, `end_date`, `status` (Draft/In Progress/Closed), `closed_at` | |
| `audit_assignment` | `id`, `cycle_id` (FK), `auditor_id` (FK → employee) | N:N cycle↔auditor |
| `audit_finding` | `id`, `cycle_id` (FK), `asset_id` (FK), `result` (enum: Verified/Missing/Damaged), `notes`, `recorded_by` (FK), `recorded_at` | |
| `notification` | `id`, `recipient_id` (FK), `type` (enum, matches §6 catalog), `payload` (structured, references the source entity id/type), `read_at` (nullable), `created_at` | |
| `activity_log` | `id`, `actor_id` (FK), `action`, `entity_type`, `entity_id`, `created_at` | Append-only |

### 4.2 Relationship cardinality & delete behavior

| Relationship | Cardinality | ON DELETE |
|---|---|---|
| department → department (parent) | 1:N | RESTRICT (can't delete a parent with children; deactivate instead) |
| department → employee | 1:N | RESTRICT (can't delete a department with active employees) |
| asset_category → asset | 1:N | RESTRICT |
| asset → allocation | 1:N (only one open at a time, enforced by unique partial index) | RESTRICT while an open allocation exists |
| asset → resource_booking | 1:N | RESTRICT while future/ongoing bookings exist |
| asset → maintenance_request | 1:N | CASCADE on asset hard-delete (rare; assets are normally Retired/Disposed, not deleted) |
| audit_cycle → audit_assignment | 1:N | CASCADE |
| audit_cycle → audit_finding | 1:N | CASCADE |
| employee → notification | 1:N | CASCADE |

### 4.3 Constraints that map directly to the brief's business rules

- **One active allocation per asset** — unique partial index on `allocation(asset_id) WHERE returned_at IS NULL`. This is what Screen 5's conflict-block dialog is reading when it decides to show "currently held by X" instead of letting the allocate form submit.
- **No overlapping bookings per resource** — Postgres `EXCLUDE` constraint on `(asset_id, tsrange(start_time, end_time))` scoped to non-cancelled bookings. This is what makes the 9:00–10:00 vs 9:30–10:30 rejection (and the 10:00–11:00 acceptance, since ranges are exclusive on the touching edge) a guarantee rather than a race-condition-prone app check.
- **Asset status is derived, not freely editable.** It's written only at these trigger points — document them as literal DB triggers or a single service-layer function, not scattered across every form's submit handler:
  - `allocation` INSERT (no prior open allocation) → `asset.status = 'Allocated'`
  - `allocation.returned_at` SET (and Asset Manager confirms check-in) → `asset.status = 'Available'`
  - `resource_booking` INSERT for the current time window → `asset.status = 'Reserved'` (only meaningful for bookable, not concurrently-allocated, assets)
  - `maintenance_request.status = 'Approved'` → `asset.status = 'Under Maintenance'`
  - `maintenance_request.status = 'Resolved'` → `asset.status` reverts to `'Allocated'` if an open allocation still exists, else `'Available'`
  - `audit_finding.result = 'Missing'` at cycle close → `asset.status = 'Lost'`
  - `audit_finding.result = 'Damaged'` at cycle close → auto-creates a `maintenance_request` (Pending) rather than changing status directly
  - Manual `Retired`/`Disposed` — Asset Manager/Admin action, only allowed when `status` is currently `Available` (no open allocation/booking)

---

## 5. Asset Lifecycle State Diagram

| From | To | Trigger |
|---|---|---|
| Available | Allocated | New allocation created (Screen 5) |
| Available | Reserved | Booking window becomes current (Screen 6, bookable assets only) |
| Available | Under Maintenance | Maintenance request approved (Screen 7) |
| Available | Retired | Manual action, Asset Manager/Admin |
| Available | Disposed | Manual action, Asset Manager/Admin (typically from Retired) |
| Allocated | Available | Allocation returned + condition check-in confirmed (Screen 5) |
| Allocated | Under Maintenance | Maintenance request approved while allocated (holder unchanged) |
| Reserved | Available | Booking window ends / booking cancelled |
| Under Maintenance | Available | Maintenance resolved, no open allocation existed before maintenance |
| Under Maintenance | Allocated | Maintenance resolved, an open allocation existed before maintenance (reverts to same holder) |
| Any non-terminal | Lost | Audit cycle closed with a `Missing` finding for that asset |
| Lost | Available | Manual "asset recovered" action, Asset Manager/Admin (found again) |
| Available / Retired | Disposed | Manual action, Admin only — terminal |

`Retired` and `Disposed` are terminal for allocation/booking purposes — an asset in either state cannot be allocated or booked (guarded at the form level, per §3 Screen 4/5/6).

---

## 6. Cross-Screen Notification Catalog

| Notification | Trigger | Recipient(s) | Source screen |
|---|---|---|---|
| Asset Assigned | New allocation created | New holder (employee or dept head) | 5 |
| Transfer Approved | Transfer request approved | Requester + old holder | 5 |
| Overdue Return Alert | `expected_return_date` passes with no return | Current holder + their Department Head | 5 (surfaces on 2 + 10) |
| Booking Confirmed | Booking created successfully | Requester | 6 |
| Booking Cancelled | Booking cancelled | Requester + booker-on-behalf-of dept head if applicable | 6 |
| Booking Reminder | Configurable window before `start_time` | Requester | 6 |
| Maintenance Approved / Rejected | Asset Manager decision on a request | Requester | 7 |
| Maintenance Resolved | Request marked Resolved | Requester + asset's current holder | 7 |
| Audit Discrepancy Flagged | Finding recorded as Missing/Damaged | Asset Manager + asset's current holder | 8 |
| Audit Cycle Closed | Cycle closed | All assigned auditors + Admin | 8 |
| Role Updated | Promote/revoke on Screen 3 Tab C | The affected employee | 3 |

All rows above write to the `notification` table (§4.1) and are what populates Screen 10's feed and the top-bar bell flyout (§1.3).

---

## 7. Hackathon Build-Constraint Alignment

Direct checklist against the organizers' stated evaluation criteria, so nothing on that list falls through the cracks between this spec and the eventual build.

| Criterion | Where this spec addresses it |
|---|---|
| DB design (top-weighted), real relational DB, no BaaS | §4 — normalized schema; the two business-critical rules (double-allocation, booking overlap) are enforced as DB constraints (unique partial index, exclusion constraint), not just app-level checks |
| Build from scratch, minimal third-party APIs | Conflict/overlap logic is DB-native (§4.3), not delegated to a scheduling SaaS. Screen 4's QR search should degrade to manual code entry rather than depend on a third-party barcode service. Screen 9's charts should use a lightweight in-house/open charting lib, not an embedded analytics platform. Auth (Screen 1) is first-party email/password against `employee`, not a third-party auth provider. |
| Real dynamic data, not static JSON | **Every number, name, and list in this document (KPI counts, sample employees/assets/dates) is illustrative content for design review only.** The shipped app must bind every screen in §3 to live queries against the §4 schema — no hardcoded/mock JSON shipped in the final build. |
| Robust input validation, clear user feedback | §7.1 below consolidates every entry-point's rules; each is enforced both client-side (immediate inline feedback) and server-side (source of truth — never trust client-only validation, since it's trivially bypassed) |
| Proper Git / team collaboration | Not a UI/UX-spec concern — a process constraint for the build phase, not a screen. Flagging here so it isn't dropped: repo should show commits from every team member, not one person driving. |
| Clean, interactive, consistent UI | §1 Design System (color/type/spacing tokens + the shared component set in §1.3) is what keeps this consistent across all 10 screens rather than each screen inventing its own patterns |

### 7.1 Consolidated Validation Rules

Extends the per-screen notes in §3 into one reference table — the pattern for every form in the app, not just login.

| Screen / form | Field | Rule | User-facing error |
|---|---|---|---|
| 1 — Signup | Email | Required, valid format, unique | "Enter a valid email address." / "An account with this email already exists." |
| 1 — Signup | Password | Min 8 chars | "Password must be at least 8 characters." |
| 1 — Signup | Confirm Password | Must match Password | "Passwords don't match." |
| 1 — Login | Email/Password | Credentials must resolve to an active account | "Invalid email or password." (never reveal which field is wrong) |
| 3A — Department | Name | Required, unique | "A department with this name already exists." |
| 3A — Department | Parent Department | Cannot be self or a descendant | "Can't set a department as its own ancestor." |
| 3B — Category | Name | Required, unique | "A category with this name already exists." |
| 3C — Employee | Email | Required, valid format, unique | Same as Signup |
| 4 — Asset | Serial Number | Unique if provided | "This serial number is already registered to another asset." |
| 4 — Asset | Acquisition Date | Required, not in the future | "Acquisition date can't be in the future." |
| 5 — Allocation | Asset | Must be status = Available at submit time | Triggers the conflict-block modal (§3 Screen 5), not a plain error |
| 5 — Return | Condition Check-in Notes | Required | "Add a condition note before confirming the return." |
| 6 — Booking | Start/End Time | End must be after start; range must not overlap an existing non-cancelled booking on that resource | "End time must be after start time." / the overlap message in §3 Screen 6 |
| 7 — Maintenance | Issue Description | Required | "Describe the issue before submitting." |
| 7 — Maintenance | Rejection reason | Required when rejecting | "Add a reason for rejecting this request." |
| 8 — Audit finding | Notes | Required when result = Missing or Damaged | "Add a note explaining the discrepancy." |
| 8 — Audit cycle | Auditors | At least one required | "Assign at least one auditor before saving." |

All uniqueness/format rules above are additionally enforced as DB constraints (unique indexes, `CHECK` constraints, `NOT NULL`) per §4 — the UI-level message is what the user sees, the DB constraint is what guarantees correctness even if a bug slips past the client.
