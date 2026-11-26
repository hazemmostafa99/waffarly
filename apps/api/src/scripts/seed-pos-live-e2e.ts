import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { hashPassword } from '../modules/auth/password.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

if (process.env.CI !== 'true' || databaseName !== 'waffarly_pos_e2e') {
  throw new Error('The POS live E2E fixture only runs in CI against waffarly_pos_e2e.');
}
if (!databaseUrl) throw new Error('DATABASE_URL is required for the POS live E2E fixture.');

const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });

try {
  const existing = await prisma.merchant.findUnique({
    where: { storefrontSlug: 'pos-live-e2e' },
    select: { id: true },
  });
  if (existing) throw new Error('The disposable POS E2E database already contains its fixture.');

  const password = 'pos-live-e2e-only-password';
  const passwordHash = await hashPassword(password);
  const ownerPasswordHash = await hashPassword('pos-live-e2e-only-owner-password');
  const isolatedEmployeePasswordHash = await hashPassword('pos-live-e2e-isolated-password');
  const supervisorPasswordHash = await hashPassword('pos-live-e2e-only-supervisor-password');
  const managerPasswordHash = await hashPassword('pos-live-e2e-only-manager-password');
  await prisma.$transaction(async (tx) => {
    const merchant = await tx.merchant.create({
      data: {
        name: 'POS live E2E test business',
        storefrontSlug: 'pos-live-e2e',
        storefrontHandle: 'pos-live-e2e',
        activity: 'restaurant',
        contactPhone: '01000000000',
        ownerName: 'CI test owner',
        ownerMobile: '01100000000',
        firstMonthActivatedAt: new Date(),
        firstMonthActivatedBy: 'pos-live-e2e',
        owner: {
          create: { username: 'owner', passwordHash: ownerPasswordHash },
        },
      },
    });
    const branch = await tx.branch.create({
      data: {
        merchantId: merchant.id,
        name: 'Live E2E branch',
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    const isolatedBranch = await tx.branch.create({
      data: {
        merchantId: merchant.id,
        name: 'Live E2E isolated branch',
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posEmployee.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        username: 'cashier',
        displayName: 'Live E2E cashier',
        passwordHash,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell'],
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posEmployee.create({
      data: {
        merchantId: merchant.id,
        branchId: isolatedBranch.id,
        username: 'isolated-cashier',
        displayName: 'Live E2E isolated cashier',
        passwordHash: isolatedEmployeePasswordHash,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell', 'view_orders', 'view_receipts'],
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posEmployee.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        username: 'manager',
        displayName: 'Live E2E branch manager',
        passwordHash: managerPasswordHash,
        role: 'branch_manager',
        permissions: ['view_orders', 'accept_recipe_orders', 'start_preparation', 'open_register_shift', 'sell', 'view_receipts', 'view_inventory', 'approve_discounts', 'approve_refunds', 'approve_shift_close', 'manage_cash_movements'],
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posEmployee.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        username: 'supervisor',
        displayName: 'Live E2E supervisor',
        passwordHash: supervisorPasswordHash,
        role: 'supervisor',
        permissions: ['open_register_shift', 'sell', 'approve_discounts', 'approve_voids', 'approve_refunds', 'approve_shift_close', 'manage_cash_movements'],
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posRegister.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        name: 'Live E2E register',
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posDiningTable.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        code: 'T01',
        capacity: 4,
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posDiningTable.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        code: 'T03',
        capacity: 4,
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.posDiningTable.create({
      data: {
        merchantId: merchant.id,
        branchId: branch.id,
        code: 'T02',
        capacity: 4,
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
    await tx.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Live POS E2E Item',
        description: 'Disposable CI-only sale fixture',
        basePrice: '42.50',
        availability: 'available',
        createdBy: 'pos-live-e2e',
        updatedBy: 'pos-live-e2e',
      },
    });
  });
} finally {
  await prisma.$disconnect();
}
