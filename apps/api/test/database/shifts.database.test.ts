import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'serializes register shift openings, replays the same request, and enforces tenant and branch scope',
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      databaseUrl,
      'Configure DATABASE_URL and apply the POS register/shift migration first.',
    );
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const token = randomUUID().replaceAll('-', '');
    const merchantIds: string[] = [];

    try {
      const merchant = await prisma.merchant.create({
        data: {
          name: `POS shift verification ${token}`,
          storefrontSlug: `pos-shift-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'POS shift verification',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(merchant.id);
      const otherMerchantRecord = await prisma.merchant.create({
        data: {
          name: `POS shift other verification ${token}`,
          storefrontSlug: `pos-shift-other-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000001',
          ownerName: 'POS shift other verification',
          ownerMobile: '01100000001',
        },
      });
      merchantIds.push(otherMerchantRecord.id);
      const branch = await prisma.branch.create({
        data: {
          merchantId: merchant.id,
          name: `POS shift branch ${token}`,
          createdBy: 'pos-shift-database-test',
          updatedBy: 'pos-shift-database-test',
        },
      });
      const otherBranch = await prisma.branch.create({
        data: {
          merchantId: otherMerchantRecord.id,
          name: `POS shift other branch ${token}`,
          createdBy: 'pos-shift-database-test',
          updatedBy: 'pos-shift-database-test',
        },
      });
      const employeeRecord = await prisma.posEmployee.create({
        data: {
          merchantId: merchant.id,
          username: `shift-${token}`,
          displayName: 'POS shift cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['open_register_shift', 'sell'],
          createdBy: 'pos-shift-database-test',
          updatedBy: 'pos-shift-database-test',
        },
      });
      await prisma.posEmployeeBranch.create({
        data: {
          merchantId: merchant.id,
          employeeId: employeeRecord.id,
          branchId: branch.id,
          createdBy: 'pos-shift-database-test',
        },
      });
      const otherEmployeeRecord = await prisma.posEmployee.create({
        data: {
          merchantId: otherMerchantRecord.id,
          username: `other-shift-${token}`,
          displayName: 'Other POS shift cashier',
          passwordHash: 'database-test-only',
          role: 'cashier',
          permissions: ['open_register_shift', 'sell'],
          createdBy: 'pos-shift-database-test',
          updatedBy: 'pos-shift-database-test',
        },
      });
      await prisma.posEmployeeBranch.create({
        data: {
          merchantId: otherMerchantRecord.id,
          employeeId: otherEmployeeRecord.id,
          branchId: otherBranch.id,
          createdBy: 'pos-shift-database-test',
        },
      });

      const service = new ShiftsService(prisma as unknown as PrismaService);
      const register = await service.createRegister(merchant.id, 'pos-shift-database-test', {
        branchId: branch.id,
        name: 'Shared cashier register',
      });
      const competingRegister = await service.createRegister(
        merchant.id,
        'pos-shift-database-test',
        { branchId: branch.id, name: 'Concurrent cashier register' },
      );
      const employee: PosEmployeeSession = {
        id: employeeRecord.id,
        merchantId: merchant.id,
        username: employeeRecord.username,
        displayName: employeeRecord.displayName,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell'],
        branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
      };

      const retry = {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '125.5',
      };
      const sameCommand = await Promise.all([
        service.openShift(employee, retry),
        service.openShift(employee, retry),
      ]);
      assert.equal(sameCommand[0].id, sameCommand[1].id);
      assert.equal(sameCommand[0].openingFloat, '125.50');

      const competing = await Promise.allSettled([
        service.openShift(employee, {
          registerId: competingRegister.id,
          requestId: randomUUID(),
          openingFloat: '10.00',
        }),
        service.openShift(employee, {
          registerId: competingRegister.id,
          requestId: randomUUID(),
          openingFloat: '20.00',
        }),
      ]);
      assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = competing.find((result) => result.status === 'rejected');
      assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof ConflictException);
      assert.equal(
        await prisma.posShift.count({
          where: {
            merchantId: merchant.id,
            registerId: competingRegister.id,
            status: { in: ['open', 'closing'] },
          },
        }),
        1,
      );

      await assert.rejects(
        service.openShift(
          { ...employee, branches: [] },
          {
            registerId: register.id,
            requestId: randomUUID(),
            openingFloat: '1.00',
          },
        ),
        (error: unknown) => error instanceof ForbiddenException,
      );
      const otherMerchant: PosEmployeeSession = {
        id: otherEmployeeRecord.id,
        merchantId: otherMerchantRecord.id,
        username: otherEmployeeRecord.username,
        displayName: otherEmployeeRecord.displayName,
        role: 'cashier',
        permissions: ['open_register_shift', 'sell'],
        branches: [{ id: otherBranch.id, name: otherBranch.name, archivedAt: null }],
      };
      await assert.rejects(
        service.openShift(otherMerchant, {
          registerId: register.id,
          requestId: randomUUID(),
          openingFloat: '1.00',
        }),
        (error: unknown) => error instanceof NotFoundException,
      );
    } finally {
      try {
        for (const merchantId of merchantIds) {
          await prisma.$transaction(async (tx) => {
            await tx.posShift.deleteMany({ where: { merchantId } });
            await tx.posRegister.deleteMany({ where: { merchantId } });
            await tx.posEmployeeBranch.deleteMany({ where: { merchantId } });
            await tx.posEmployee.deleteMany({ where: { merchantId } });
            await tx.branch.deleteMany({ where: { merchantId } });
            // Remove the subscription created with this test merchant before its parent row.
            await tx.subscriptionEvent.deleteMany({ where: { merchantId } });
            await tx.subscriptionPeriod.deleteMany({ where: { merchantId } });
            await tx.subscription.deleteMany({ where: { merchantId } });
            await tx.merchant.deleteMany({ where: { id: merchantId } });
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
