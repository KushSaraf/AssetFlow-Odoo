/**
 * AssetFlow — Full Demo Seed Script
 * Covers all §5 seed requirements from docs/database/PLAN.md:
 *   - 3 departments with heads
 *   - ~8 employees across all roles
 *   - 3 categories: Electronics, Furniture, Vehicles
 *   - ~15 assets spanning every status
 *   - Open allocations, pending transfer request
 *   - 2–3 bookings including Room B2 9:00–10:00 (overlap demo)
 *   - Maintenance requests in each kanban stage
 *   - 1 audit cycle with findings
 *   - Notifications and activity log rows
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting full AssetFlow seed...');

  const existingDept = await prisma.department.findFirst();
  if (existingDept) {
    console.log('✅ Database already seeded! Skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // ─── 1. DEPARTMENTS (heads set in a second pass after employees exist) ────
  const engineering = await prisma.department.create({
    data: { name: 'Engineering', status: 'Active' },
  });
  const facilities = await prisma.department.create({
    data: { name: 'Facilities', status: 'Active' },
  });
  const fieldOps = await prisma.department.create({
    data: { name: 'Field Ops', status: 'Active' },
  });

  // ─── 2. EMPLOYEES ────────────────────────────────────────────────────────
  const admin = await prisma.employee.create({
    data: {
      name: 'Admin User',
      email: 'admin@assetflow.com',
      password_hash: passwordHash,
      role: 'Admin',
      status: 'Active',
    },
  });

  // Asset managers
  const kamya = await prisma.employee.create({
    data: {
      name: 'Kamya Nair',
      email: 'kamya@assetflow.com',
      password_hash: passwordHash,
      role: 'Asset Manager',
      status: 'Active',
    },
  });
  const vikram = await prisma.employee.create({
    data: {
      name: 'Vikram Sethi',
      email: 'vikram@assetflow.com',
      password_hash: passwordHash,
      role: 'Asset Manager',
      status: 'Active',
    },
  });

  // Department heads
  const aditi = await prisma.employee.create({
    data: {
      name: 'Aditi Rao',
      email: 'aditi@assetflow.com',
      password_hash: passwordHash,
      department_id: engineering.id,
      role: 'Department Head',
      status: 'Active',
    },
  });
  const rohan = await prisma.employee.create({
    data: {
      name: 'Rohan Mehta',
      email: 'rohan@assetflow.com',
      password_hash: passwordHash,
      department_id: facilities.id,
      role: 'Department Head',
      status: 'Active',
    },
  });
  const sana = await prisma.employee.create({
    data: {
      name: 'Sana Iqbal',
      email: 'sana@assetflow.com',
      password_hash: passwordHash,
      department_id: fieldOps.id,
      role: 'Department Head',
      status: 'Active',
    },
  });

  // Regular employees
  const priya = await prisma.employee.create({
    data: {
      name: 'Priya Shah',
      email: 'priya@assetflow.com',
      password_hash: passwordHash,
      department_id: engineering.id,
      role: 'Employee',
      status: 'Active',
    },
  });
  const raj = await prisma.employee.create({
    data: {
      name: 'Raj Kumar',
      email: 'raj@assetflow.com',
      password_hash: passwordHash,
      department_id: fieldOps.id,
      role: 'Employee',
      status: 'Active',
    },
  });

  // ─── 3. Assign department heads (second pass) ────────────────────────────
  await prisma.department.update({
    where: { id: engineering.id },
    data: { head_employee_id: aditi.id },
  });
  await prisma.department.update({
    where: { id: facilities.id },
    data: { head_employee_id: rohan.id },
  });
  await prisma.department.update({
    where: { id: fieldOps.id },
    data: { head_employee_id: sana.id },
  });

  // ─── 4. ASSET CATEGORIES ─────────────────────────────────────────────────
  const electronics = await prisma.asset_category.create({
    data: {
      name: 'Electronics',
      description: 'Laptops, monitors, projectors, and similar equipment',
      status: 'Active',
      fields: {
        create: [
          {
            field_name: 'Warranty Period',
            field_type: 'number',
            required: false,
          },
        ],
      },
    },
  });
  const furniture = await prisma.asset_category.create({
    data: {
      name: 'Furniture',
      description: 'Desks, chairs, tables, shelving',
      status: 'Active',
    },
  });
  const vehicles = await prisma.asset_category.create({
    data: {
      name: 'Vehicles',
      description: 'Company cars, vans, and field vehicles',
      status: 'Active',
    },
  });

  // ─── 5. ASSETS (~15, every status covered) ───────────────────────────────
  const today = new Date();
  const past = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
  const future = (daysFromNow: number) =>
    new Date(Date.now() + daysFromNow * 86_400_000);

  // AF-0114 — Dell Laptop (Allocated to Priya Shah)
  const laptop = await prisma.asset.create({
    data: {
      tag: 'AF-0114',
      name: 'Dell Laptop',
      category_id: electronics.id,
      department_id: engineering.id,
      serial_number: 'DELL-XPS-9310',
      acquisition_date: past(180),
      acquisition_cost: 1500,
      condition: 'Good',
      status: 'Allocated',
      is_bookable: false,
    },
  });

  // AF-0012 — HP Monitor (Available)
  const monitor = await prisma.asset.create({
    data: {
      tag: 'AF-0012',
      name: 'HP Monitor 27"',
      category_id: electronics.id,
      department_id: engineering.id,
      serial_number: 'HP-MON-2700A',
      acquisition_date: past(365),
      acquisition_cost: 350,
      condition: 'Good',
      status: 'Available',
      is_bookable: false,
    },
  });

  // AF-0062 — MacBook Pro (Under Maintenance)
  const macbook = await prisma.asset.create({
    data: {
      tag: 'AF-0062',
      name: 'MacBook Pro 14"',
      category_id: electronics.id,
      department_id: engineering.id,
      serial_number: 'APPL-MBP-0062',
      acquisition_date: past(90),
      acquisition_cost: 2200,
      condition: 'Fair',
      status: 'Under Maintenance',
      is_bookable: false,
    },
  });

  // AF-0201 — Room B2 (Reserved/bookable)
  const roomB2 = await prisma.asset.create({
    data: {
      tag: 'AF-0201',
      name: 'Room B2',
      category_id: furniture.id,
      department_id: facilities.id,
      acquisition_date: past(730),
      acquisition_cost: 0,
      condition: 'Good',
      status: 'Available',
      is_bookable: true,
    },
  });

  // AF-0030 — Conference Projector (Available, bookable)
  const projector = await prisma.asset.create({
    data: {
      tag: 'AF-0030',
      name: 'Conference Projector',
      category_id: electronics.id,
      department_id: facilities.id,
      serial_number: 'EPSON-PRJ-030',
      acquisition_date: past(400),
      acquisition_cost: 800,
      condition: 'Good',
      status: 'Available',
      is_bookable: true,
    },
  });

  // AF-0045 — Field Ops Van (Allocated to Raj)
  const van = await prisma.asset.create({
    data: {
      tag: 'AF-0045',
      name: 'Toyota HiAce Van',
      category_id: vehicles.id,
      department_id: fieldOps.id,
      serial_number: 'TYT-HIX-2023-045',
      acquisition_date: past(300),
      acquisition_cost: 35000,
      condition: 'Good',
      status: 'Allocated',
      is_bookable: false,
    },
  });

  // AF-0078 — Standing Desk (Available)
  const desk = await prisma.asset.create({
    data: {
      tag: 'AF-0078',
      name: 'Adjustable Standing Desk',
      category_id: furniture.id,
      department_id: engineering.id,
      acquisition_date: past(200),
      acquisition_cost: 600,
      condition: 'Good',
      status: 'Available',
      is_bookable: false,
    },
  });

  // AF-0090 — Ergonomic Chair (Available)
  const chair = await prisma.asset.create({
    data: {
      tag: 'AF-0090',
      name: 'Herman Miller Aeron Chair',
      category_id: furniture.id,
      department_id: engineering.id,
      acquisition_date: past(500),
      acquisition_cost: 1200,
      condition: 'Fair',
      status: 'Available',
      is_bookable: false,
    },
  });

  // AF-0101 — iPhone 14 (Reserved via booking)
  const phone = await prisma.asset.create({
    data: {
      tag: 'AF-0101',
      name: 'iPhone 14 Pro',
      category_id: electronics.id,
      department_id: fieldOps.id,
      serial_number: 'APPL-IP14-0101',
      acquisition_date: past(100),
      acquisition_cost: 1100,
      condition: 'New',
      status: 'Available',
      is_bookable: true,
    },
  });

  // AF-0150 — Old Desktop (Retired)
  const desktop = await prisma.asset.create({
    data: {
      tag: 'AF-0150',
      name: 'Dell Optiplex Desktop',
      category_id: electronics.id,
      acquisition_date: past(2000),
      acquisition_cost: 900,
      condition: 'Poor',
      status: 'Retired',
      is_bookable: false,
    },
  });

  // AF-0160 — Broken Scanner (Lost)
  const scanner = await prisma.asset.create({
    data: {
      tag: 'AF-0160',
      name: 'Handheld Barcode Scanner',
      category_id: electronics.id,
      department_id: fieldOps.id,
      serial_number: 'SCAN-HH-0160',
      acquisition_date: past(800),
      acquisition_cost: 200,
      condition: 'Poor',
      status: 'Lost',
      is_bookable: false,
    },
  });

  // AF-0170 — Old Fleet Car (Disposed)
  const oldCar = await prisma.asset.create({
    data: {
      tag: 'AF-0170',
      name: 'Maruti Suzuki Swift (2015)',
      category_id: vehicles.id,
      acquisition_date: past(3650),
      acquisition_cost: 8000,
      condition: 'Poor',
      status: 'Disposed',
      is_bookable: false,
    },
  });

  // AF-0055 — Tablet (Available)
  const tablet = await prisma.asset.create({
    data: {
      tag: 'AF-0055',
      name: 'iPad Air',
      category_id: electronics.id,
      department_id: facilities.id,
      serial_number: 'APPL-IPAD-0055',
      acquisition_date: past(150),
      acquisition_cost: 750,
      condition: 'Good',
      status: 'Available',
      is_bookable: false,
    },
  });

  // AF-0180 — Tata Nexon EV (Available)
  const ev = await prisma.asset.create({
    data: {
      tag: 'AF-0180',
      name: 'Tata Nexon EV',
      category_id: vehicles.id,
      department_id: fieldOps.id,
      serial_number: 'TATA-NEX-EV-180',
      acquisition_date: past(60),
      acquisition_cost: 18000,
      condition: 'New',
      status: 'Available',
      is_bookable: true,
    },
  });

  // AF-0010 — Wireless Keyboard (Available)
  const keyboard = await prisma.asset.create({
    data: {
      tag: 'AF-0010',
      name: 'Logitech MX Keys Keyboard',
      category_id: electronics.id,
      department_id: engineering.id,
      serial_number: 'LGT-MXK-0010',
      acquisition_date: past(250),
      acquisition_cost: 120,
      condition: 'Good',
      status: 'Available',
      is_bookable: false,
    },
  });

  // ─── 6. ALLOCATIONS ──────────────────────────────────────────────────────

  // AF-0114 Dell Laptop → Priya Shah (Engineering) — open
  const laptopAllocation = await prisma.allocation.create({
    data: {
      asset_id: laptop.id,
      employee_id: priya.id,
      allocated_by: kamya.id,
      allocated_at: past(30),
      expected_return_date: future(60),
      condition_out: 'Good',
    },
  });

  // AF-0045 Van → Raj Kumar (Field Ops) — open, OVERDUE
  const vanAllocation = await prisma.allocation.create({
    data: {
      asset_id: van.id,
      employee_id: raj.id,
      allocated_by: vikram.id,
      allocated_at: past(45),
      expected_return_date: past(5), // overdue by 5 days
      condition_out: 'Good',
    },
  });

  // AF-0062 MacBook — was allocated to Aditi before going to maintenance
  // (historical closed allocation)
  await prisma.allocation.create({
    data: {
      asset_id: macbook.id,
      employee_id: aditi.id,
      allocated_by: kamya.id,
      allocated_at: past(60),
      expected_return_date: future(30),
      returned_at: past(5), // closed when maintenance was approved
      condition_out: 'Good',
      condition_in: 'Fair',
      checkin_notes: 'Battery degraded, sent to maintenance',
    },
  });

  // ─── 7. TRANSFER REQUEST ─────────────────────────────────────────────────
  // Priya wants to transfer the Dell Laptop to Raj
  await prisma.transfer_request.create({
    data: {
      asset_id: laptop.id,
      from_allocation_id: laptopAllocation.id,
      requested_by: priya.id,
      to_employee_id: raj.id,
      status: 'Requested',
      reason: 'Raj needs a laptop for the upcoming field deployment',
    },
  });

  // ─── 8. RESOURCE BOOKINGS ────────────────────────────────────────────────
  // Today's date with specific times (for the overlap demo)
  const todayAt = (hours: number, minutes = 0) => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // Procurement Team books Room B2: 9:00–10:00 (this is the demo booking)
  await prisma.resource_booking.create({
    data: {
      asset_id: roomB2.id,
      booked_by: rohan.id,
      on_behalf_of_department_id: facilities.id,
      start_time: todayAt(9, 0),
      end_time: todayAt(10, 0),
      purpose: 'Procurement Team weekly standup',
      status: 'Upcoming',
    },
  });

  // Engineering books Room B2: 10:00–11:00 (adjacent, must succeed)
  await prisma.resource_booking.create({
    data: {
      asset_id: roomB2.id,
      booked_by: aditi.id,
      on_behalf_of_department_id: engineering.id,
      start_time: todayAt(10, 0),
      end_time: todayAt(11, 0),
      purpose: 'Sprint planning session',
      status: 'Upcoming',
    },
  });

  // Raj books the EV tomorrow
  await prisma.resource_booking.create({
    data: {
      asset_id: ev.id,
      booked_by: raj.id,
      start_time: future(1),
      end_time: new Date(future(1).getTime() + 4 * 3600 * 1000),
      purpose: 'Site visit — client premises',
      status: 'Upcoming',
    },
  });

  // Past completed booking for Room B2
  await prisma.resource_booking.create({
    data: {
      asset_id: roomB2.id,
      booked_by: sana.id,
      start_time: past(3),
      end_time: new Date(past(3).getTime() + 2 * 3600 * 1000),
      purpose: 'Field Ops quarterly review',
      status: 'Completed',
    },
  });

  // ─── 9. MAINTENANCE REQUESTS ─────────────────────────────────────────────

  // AF-0062 MacBook — Approved (asset is Under Maintenance)
  const macbookMaintenance = await prisma.maintenance_request.create({
    data: {
      asset_id: macbook.id,
      raised_by: aditi.id,
      issue: 'Battery draining rapidly — needs replacement',
      priority: 'High',
      status: 'Approved',
      approver_id: kamya.id,
    },
  });

  // AF-0045 Van — Technician Assigned
  await prisma.maintenance_request.create({
    data: {
      asset_id: van.id,
      raised_by: raj.id,
      issue: 'AC compressor making noise',
      priority: 'Medium',
      status: 'Technician Assigned',
      approver_id: vikram.id,
      technician: 'AutoCare Garage — Suresh',
    },
  });

  // AF-0078 Desk — In Progress
  await prisma.maintenance_request.create({
    data: {
      asset_id: desk.id,
      raised_by: priya.id,
      issue: 'Height adjustment mechanism stuck',
      priority: 'Low',
      status: 'In Progress',
      approver_id: kamya.id,
      technician: 'Office Maintenance Team',
    },
  });

  // AF-0010 Keyboard — Pending approval
  await prisma.maintenance_request.create({
    data: {
      asset_id: keyboard.id,
      raised_by: priya.id,
      issue: 'Several keys not responding',
      priority: 'Medium',
      status: 'Pending',
    },
  });

  // AF-0055 Tablet — Rejected
  await prisma.maintenance_request.create({
    data: {
      asset_id: tablet.id,
      raised_by: rohan.id,
      issue: 'Screen flicker reported intermittently',
      priority: 'Low',
      status: 'Rejected',
      approver_id: kamya.id,
      resolution_notes: 'Could not reproduce issue; resubmit if it persists',
    },
  });

  // AF-0012 Monitor — Resolved
  await prisma.maintenance_request.create({
    data: {
      asset_id: monitor.id,
      raised_by: priya.id,
      issue: 'Display flickering on HDMI input',
      priority: 'Medium',
      status: 'Resolved',
      approver_id: vikram.id,
      technician: 'HP Authorised Service Centre',
      resolution_notes: 'HDMI port replaced under warranty',
      resolved_at: past(10),
    },
  });

  // ─── 10. AUDIT CYCLE ─────────────────────────────────────────────────────
  const auditCycle = await prisma.audit_cycle.create({
    data: {
      name: 'Q3 Audit: Engineering Dept',
      scope_department_id: engineering.id,
      start_date: past(7),
      end_date: future(7),
      status: 'In Progress',
      assignments: {
        create: [{ auditor_id: kamya.id }, { auditor_id: vikram.id }],
      },
    },
  });

  // Audit findings
  await prisma.audit_finding.create({
    data: {
      cycle_id: auditCycle.id,
      asset_id: laptop.id,
      result: 'Verified',
      notes: 'Asset confirmed with Priya Shah',
      recorded_by: kamya.id,
    },
  });
  await prisma.audit_finding.create({
    data: {
      cycle_id: auditCycle.id,
      asset_id: monitor.id,
      result: 'Verified',
      notes: 'In storage room B, matches records',
      recorded_by: kamya.id,
    },
  });
  const damagedFinding = await prisma.audit_finding.create({
    data: {
      cycle_id: auditCycle.id,
      asset_id: macbook.id,
      result: 'Damaged',
      notes: 'Screen has hairline crack on bottom-left corner',
      recorded_by: vikram.id,
    },
  });
  await prisma.audit_finding.create({
    data: {
      cycle_id: auditCycle.id,
      asset_id: keyboard.id,
      result: 'Missing',
      notes: 'Not found at assigned location; holder says last seen in lab 2',
      recorded_by: vikram.id,
    },
  });

  // ─── 11. NOTIFICATIONS ───────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        recipient_id: priya.id,
        type: 'AssetAssigned',
        payload: {
          asset_tag: 'AF-0114',
          asset_name: 'Dell Laptop',
          allocated_by: 'Kamya Nair',
        },
        read_at: null,
        created_at: past(30),
      },
      {
        recipient_id: raj.id,
        type: 'OverdueReturnAlert',
        payload: {
          asset_tag: 'AF-0045',
          asset_name: 'Toyota HiAce Van',
          days_overdue: 5,
        },
        read_at: null,
        created_at: past(1),
      },
      {
        recipient_id: sana.id,
        type: 'OverdueReturnAlert',
        payload: {
          asset_tag: 'AF-0045',
          asset_name: 'Toyota HiAce Van',
          department: 'Field Ops',
        },
        read_at: null,
        created_at: past(1),
      },
      {
        recipient_id: aditi.id,
        type: 'MaintenanceApproved',
        payload: {
          asset_tag: 'AF-0062',
          asset_name: 'MacBook Pro 14"',
          approved_by: 'Kamya Nair',
        },
        read_at: past(5),
        created_at: past(5),
      },
      {
        recipient_id: priya.id,
        type: 'BookingConfirmed',
        payload: {
          asset_name: 'Room B2',
          start_time: todayAt(9, 0).toISOString(),
          end_time: todayAt(10, 0).toISOString(),
        },
        read_at: past(1),
        created_at: past(1),
      },
      {
        recipient_id: kamya.id,
        type: 'AuditDiscrepancyFlagged',
        payload: {
          asset_tag: 'AF-0010',
          asset_name: 'Logitech MX Keys Keyboard',
          result: 'Missing',
          cycle: 'Q3 Audit: Engineering Dept',
        },
        read_at: null,
        created_at: past(2),
      },
      {
        recipient_id: vikram.id,
        type: 'AuditDiscrepancyFlagged',
        payload: {
          asset_tag: 'AF-0062',
          asset_name: 'MacBook Pro 14"',
          result: 'Damaged',
          cycle: 'Q3 Audit: Engineering Dept',
        },
        read_at: null,
        created_at: past(2),
      },
      {
        recipient_id: priya.id,
        type: 'RoleUpdated',
        payload: {
          old_role: 'Employee',
          new_role: 'Employee',
          note: 'Account active',
        },
        read_at: past(30),
        created_at: past(30),
      },
    ],
  });

  // ─── 12. ACTIVITY LOG ────────────────────────────────────────────────────
  await prisma.activity_log.createMany({
    data: [
      {
        actor_id: kamya.id,
        action: 'allocated',
        entity_type: 'asset',
        entity_id: laptop.id,
        created_at: past(30),
      },
      {
        actor_id: aditi.id,
        action: 'raised_maintenance',
        entity_type: 'maintenance_request',
        entity_id: macbookMaintenance.id,
        created_at: past(6),
      },
      {
        actor_id: kamya.id,
        action: 'approved_maintenance',
        entity_type: 'maintenance_request',
        entity_id: macbookMaintenance.id,
        created_at: past(5),
      },
      {
        actor_id: rohan.id,
        action: 'booked_resource',
        entity_type: 'resource_booking',
        entity_id: roomB2.id,
        created_at: past(1),
      },
      {
        actor_id: priya.id,
        action: 'requested_transfer',
        entity_type: 'transfer_request',
        entity_id: laptop.id,
        created_at: past(2),
      },
      {
        actor_id: vikram.id,
        action: 'recorded_finding',
        entity_type: 'audit_finding',
        entity_id: damagedFinding.id,
        created_at: past(2),
      },
      {
        actor_id: admin.id,
        action: 'registered_asset',
        entity_type: 'asset',
        entity_id: ev.id,
        created_at: past(60),
      },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('Credentials (all use password: password123):');
  console.log('  admin@assetflow.com       — Admin');
  console.log('  kamya@assetflow.com       — Asset Manager');
  console.log('  vikram@assetflow.com      — Asset Manager');
  console.log('  aditi@assetflow.com       — Department Head (Engineering)');
  console.log('  rohan@assetflow.com       — Department Head (Facilities)');
  console.log('  sana@assetflow.com        — Department Head (Field Ops)');
  console.log('  priya@assetflow.com       — Employee');
  console.log('  raj@assetflow.com         — Employee');
  console.log('');
  console.log('Demo scenarios ready:');
  console.log(
    '  • Room B2 booked 9:00–10:00 → attempt 9:30–10:30 to demo overlap rejection',
  );
  console.log(
    '  • AF-0114 Dell Laptop allocated to Priya → attempt re-allocate to demo conflict modal',
  );
  console.log(
    '  • AF-0045 Van overdue by 5 days → visible on Dashboard overdue panel',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
