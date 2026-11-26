import { testStorefrontHandle } from '../support/merchant-fixtures.js';
import { createTestDatabaseClient } from '../support/test-database.js';
import { getTestDatabaseUrl } from '../support/test-database-environment.js';
import { type Prisma } from '@waffarly/database';
import { POS_EMPLOYEE_ROLES } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { Request, Response } from 'express';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PosEmployeeService } from '../../src/modules/employees/pos-employee.service.js';

const databaseUrl = getTestDatabaseUrl();

it(
  'persists employee presets, isolates tenants, reloads grants and revokes POS sessions',
  { skip: !databaseUrl },
  async (testContext) => {
    assert.ok(databaseUrl);
    const prisma = createTestDatabaseClient(testContext);
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
              data: { ...merchantData, storefrontSlug: `roles-${token}`, storefrontHandle: testStorefrontHandle() },
            });
            const other = await tx.merchant.create({
              data: { ...merchantData, storefrontSlug: `roles-other-${token}`, storefrontHandle: testStorefrontHandle() },
            });
            const branch = await tx.branch.create({
              data: {
                merchantId: merchant.id,
                name: 'Assigned',
                createdBy: 'test',
                updatedBy: 'test',
              },
            });
            const replacementBranch = await tx.branch.create({
              data: {
                merchantId: merchant.id,
                name: 'Replacement',
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
              branchId: branch.id,
            };
            for (const role of POS_EMPLOYEE_ROLES) {
              const saved = await employees.create(merchant.id, 'owner', {
                ...input,
                username: `staff-${role}`,
                role,
              });
              assert.equal(saved.role, role);
              assert.equal(saved.branch.id, branch.id);
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
                branchId: otherBranch.id,
                role: 'accountant',
              }),
              /belongs to this business/,
            );
            const cashier = await employees.create(merchant.id, 'owner', {
              ...input,
              role: 'cashier',
            });
            const supervisor = await employees.create(merchant.id, 'owner', {
              ...input,
              username: 'approval-supervisor',
              role: 'supervisor',
            });
            const sessionToken = randomUUID();
            await tx.authSession.create({
              data: {
                tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
                subjectKind: 'POS',
                subjectId: cashier.id,
                deviceId: '88888888-8888-4888-8888-888888888888',
                expiresAt: new Date(Date.now() + 60_000),
              },
            });
            const logoutSessionToken = randomUUID();
            const logoutSessionHash = createHash('sha256').update(logoutSessionToken).digest('hex');
            await tx.authSession.create({
              data: {
                tokenHash: logoutSessionHash,
                subjectKind: 'POS',
                subjectId: cashier.id,
                deviceId: '99999999-9999-4999-8999-999999999999',
                expiresAt: new Date(Date.now() + 60_000),
              },
            });
            const auth = new AuthService(scoped as never, {} as never);
            assert.equal(
              await auth.verifyPosEmployeeApproval({
                merchantId: merchant.id,
                branchId: branch.id,
                actingEmployeeId: cashier.id,
                username: 'approval-supervisor',
                password: input.password,
                permission: 'approve_voids',
              }),
              supervisor.id,
            );
            await assert.rejects(
              auth.verifyPosEmployeeApproval({
                merchantId: merchant.id,
                branchId: branch.id,
                actingEmployeeId: cashier.id,
                username: 'approval-supervisor',
                password: 'wrong-password',
                permission: 'approve_voids',
              }),
              /credentials are invalid/,
            );
            await assert.rejects(
              auth.verifyPosEmployeeApproval({
                merchantId: merchant.id,
                branchId: branch.id,
                actingEmployeeId: supervisor.id,
                username: cashier.username,
                password: input.password,
                permission: 'approve_voids',
              }),
              /not authorized/,
            );
            const request = {
              headers: { cookie: `waffarly_pos_session=${sessionToken}` },
            } as Request;
            assert.equal(
              (await auth.requirePosEmployee(request)).permissions.includes('sell'),
              true,
            );
            const logoutRequest = {
              headers: { cookie: `waffarly_pos_session=${logoutSessionToken}` },
            } as Request;
            assert.equal((await auth.requirePosEmployee(logoutRequest)).id, cashier.id);
            const clearedCookies: string[] = [];
            const response = {
              clearCookie(name: string) {
                clearedCookies.push(name);
              },
            } as unknown as Response;
            await auth.logout(logoutRequest, response, 'POS');
            assert.deepEqual(clearedCookies, ['waffarly_pos_session']);
            assert.equal(
              await tx.authSession.findUnique({ where: { tokenHash: logoutSessionHash } }),
              null,
            );
            await assert.rejects(auth.requirePosEmployee(logoutRequest), /session has expired/i);
            assert.ok(
              await tx.authSession.findUnique({
                where: { tokenHash: createHash('sha256').update(sessionToken).digest('hex') },
              }),
              'logging out one device keeps the employee’s other session active',
            );
            const accountant = await employees.update(merchant.id, 'owner', cashier.id, {
              revision: cashier.revision,
              displayName: 'Role Test',
              active: true,
              role: 'accountant',
              branchId: branch.id,
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
                branchId: branch.id,
              }),
              /not found/,
            );
            await assert.rejects(
              employees.update(merchant.id, 'owner', cashier.id, {
                revision: cashier.revision,
                displayName: 'Role Test',
                active: true,
                role: 'branch_manager',
                branchId: branch.id,
              }),
              /changed since/,
            );
            await tx.branch.update({ where: { id: branch.id }, data: { archivedAt: new Date() } });
            await assert.rejects(auth.requirePosEmployee(request), /assigned branch is inactive/);
            await employees.update(merchant.id, 'owner', cashier.id, {
              revision: accountant.revision,
              displayName: 'Role Test',
              active: false,
              branchId: replacementBranch.id,
            });
            await assert.rejects(auth.requirePosEmployee(request), /session has expired/i);
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
