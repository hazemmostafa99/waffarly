import { createPostgresAdapter, PrismaClient, type Prisma } from '@waffarly/database';
import { POS_EMPLOYEE_ROLES } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { Request } from 'express';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PosEmployeeService } from '../../src/modules/auth/pos-employee.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'persists employee presets, isolates tenants and reloads role and branch changes on existing sessions',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl);
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback employee role verification fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const token = randomUUID();
            const merchantData = {
              name: 'Role verification',
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Test Owner',
              ownerMobile: '01100000000',
              firstMonthActivatedAt: new Date(),
            };
            const merchant = await tx.merchant.create({
              data: { ...merchantData, storefrontSlug: `roles-${token}` },
            });
            const other = await tx.merchant.create({
              data: { ...merchantData, storefrontSlug: `roles-other-${token}` },
            });
            const branch = await tx.branch.create({
              data: {
                merchantId: merchant.id,
                name: 'Assigned',
                createdBy: 'test',
                updatedBy: 'test',
              },
            });
            const otherBranch = await tx.branch.create({
              data: { merchantId: other.id, name: 'Foreign', createdBy: 'test', updatedBy: 'test' },
            });
            const scoped = new Proxy(tx, {
              get(target, key) {
                if (key === '$transaction')
                  return async (callback: (transaction: Prisma.TransactionClient) => unknown) =>
                    callback(target);
                return Reflect.get(target, key);
              },
            });
            const employees = new PosEmployeeService(scoped as never);
            const input = {
              username: 'staff',
              displayName: 'Role Test',
              password: 'long-test-password',
              branchIds: [branch.id],
            };
            for (const role of POS_EMPLOYEE_ROLES) {
              const saved = await employees.create(merchant.id, 'owner', {
                ...input,
                username: `staff-${role}`,
                role,
              });
              assert.equal(saved.role, role);
              assert.deepEqual(saved.branchIds, [branch.id]);
              const filtered = await employees.list(merchant.id, {
                role,
                search: '',
                status: 'all',
                limit: 25,
              });
              assert.deepEqual(
                filtered.items.map((employee) => employee.id),
                [saved.id],
              );
            }
            assert.deepEqual(
              await employees.list(other.id, { search: '', status: 'all', limit: 25 }),
              { items: [], nextCursor: null },
            );
            await assert.rejects(
              employees.create(merchant.id, 'owner', {
                ...input,
                branchIds: [otherBranch.id],
                role: 'accountant',
              }),
              /belong to this business/,
            );
            const cashier = await employees.create(merchant.id, 'owner', {
              ...input,
              role: 'cashier',
            });
            const sessionToken = randomUUID();
            await tx.authSession.create({
              data: {
                tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
                subjectKind: 'POS',
                subjectId: cashier.id,
                expiresAt: new Date(Date.now() + 60_000),
              },
            });
            const auth = new AuthService(scoped as never, {} as never);
            const request = {
              headers: { cookie: `waffarly_pos_session=${sessionToken}` },
            } as Request;
            assert.equal(
              (await auth.requirePosEmployee(request)).permissions.includes('sell'),
              true,
            );
            const accountant = await employees.update(merchant.id, 'owner', cashier.id, {
              revision: cashier.revision,
              displayName: 'Role Test',
              active: true,
              role: 'accountant',
              branchIds: [branch.id],
            });
            assert.deepEqual(accountant.permissions, ['view_receipts']);
            assert.deepEqual((await auth.requirePosEmployee(request)).permissions, [
              'view_receipts',
            ]);
            await assert.rejects(
              employees.update(other.id, 'owner', cashier.id, {
                revision: accountant.revision,
                displayName: 'Role Test',
                active: false,
                branchIds: [],
              }),
              /not found/,
            );
            await assert.rejects(
              employees.update(merchant.id, 'owner', cashier.id, {
                revision: cashier.revision,
                displayName: 'Role Test',
                active: true,
                role: 'branch_manager',
                branchIds: [branch.id],
              }),
              /changed since/,
            );
            await tx.branch.update({ where: { id: branch.id }, data: { archivedAt: new Date() } });
            await assert.rejects(auth.requirePosEmployee(request), /No active branch/);
            await employees.update(merchant.id, 'owner', cashier.id, {
              revision: accountant.revision,
              displayName: 'Role Test',
              active: false,
              branchIds: [],
            });
            await assert.rejects(auth.requirePosEmployee(request), /Session has expired/);
            throw rollback;
          },
          { timeout: 30_000 },
        ),
        (error: unknown) => error === rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
