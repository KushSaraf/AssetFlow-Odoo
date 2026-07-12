"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
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
            category_id: electronics.id,
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
//# sourceMappingURL=seed.js.map