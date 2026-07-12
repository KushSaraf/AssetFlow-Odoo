import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  const engineering = await prisma.department.create({
    data: { name: 'Engineering' },
  });
  const facilities = await prisma.department.create({
    data: { name: 'Facilities' },
  });
  const fieldOps = await prisma.department.create({
    data: { name: 'Field Ops' },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.employee.create({
    data: {
      name: 'Admin User',
      email: 'admin@assetflow.com',
      password_hash: passwordHash,
      role: 'Admin',
    },
  });

  const aditi = await prisma.employee.create({
    data: {
      name: 'Aditi Rao',
      email: 'aditi@assetflow.com',
      password_hash: passwordHash,
      department_id: engineering.id,
      role: 'Department Head',
    },
  });

  const rohan = await prisma.employee.create({
    data: {
      name: 'Rohan Mehta',
      email: 'rohan@assetflow.com',
      password_hash: passwordHash,
      department_id: facilities.id,
      role: 'Department Head',
    },
  });

  const sana = await prisma.employee.create({
    data: {
      name: 'Sana Iqbal',
      email: 'sana@assetflow.com',
      password_hash: passwordHash,
      department_id: fieldOps.id,
      role: 'Department Head',
    },
  });

  const priya = await prisma.employee.create({
    data: {
      name: 'Priya Shah',
      email: 'priya@assetflow.com',
      password_hash: passwordHash,
      department_id: engineering.id,
      role: 'Employee',
    },
  });

  const electronics = await prisma.asset_category.create({
    data: {
      name: 'Electronics',
      description: 'Laptops, monitors, etc.',
      fields: {
        create: [
          { field_name: 'Warranty Period', field_type: 'number', required: false },
        ],
      },
    },
  });

  const dellLaptop = await prisma.asset.create({
    data: {
      tag: 'AF-0114',
      name: 'Dell Laptop',
      category_id: electronics.id,
      department_id: engineering.id,
      serial_number: 'DELL-12345',
      acquisition_date: new Date(),
      acquisition_cost: 1500,
      condition: 'Good',
      status: 'Allocated',
    },
  });

  await prisma.allocation.create({
    data: {
      asset_id: dellLaptop.id,
      employee_id: priya.id,
      allocated_by: aditi.id,
    },
  });

  const roomB2 = await prisma.asset.create({
    data: {
      tag: 'AF-0201',
      name: 'Room B2',
      category_id: electronics.id, // Using existing for simplicity
      acquisition_date: new Date(),
      condition: 'Good',
      is_bookable: true,
      status: 'Available',
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
