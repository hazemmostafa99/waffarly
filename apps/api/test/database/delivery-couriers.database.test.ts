import { createTestDatabaseClient } from '../support/test-database.js';
import { getTestDatabaseUrl } from '../support/test-database-environment.js';
import type { Prisma } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { DeliveryCourierService } from '../../src/modules/orders/delivery/delivery-courier.service.js';

const databaseUrl = getTestDatabaseUrl();

it(
  'keeps courier management within the merchant and offers only active branch assignments to POS',
  { skip: !databaseUrl },
  async (testContext) => {
    assert.ok(databaseUrl);
    const prisma = createTestDatabaseClient(testContext);
    const rollback = new Error('Rollback delivery courier verification fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          const token = randomUUID();
          const merchantData = {
            name: 'Courier verification',
            activity: 'restaurant',
            contactPhone: '01000000000',
            ownerName: 'Test Owner',
            ownerMobile: '01100000000',
          };
          const merchant = await tx.merchant.create({
            data: { ...merchantData, storefrontSlug: `couriers-${token}` },
          });
          const otherMerchant = await tx.merchant.create({
            data: { ...merchantData, storefrontSlug: `couriers-other-${token}` },
          });
          const branch = await tx.branch.create({
            data: { merchantId: merchant.id, name: 'Main', createdBy: 'test', updatedBy: 'test' },
          });
          const secondBranch = await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: 'Second',
              createdBy: 'test',
              updatedBy: 'test',
            },
          });
          const archivedBranch = await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: 'Archived',
              archivedAt: new Date(),
              createdBy: 'test',
              updatedBy: 'test',
            },
          });
          const unassignedBranch = await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: 'Unassigned',
              createdBy: 'test',
              updatedBy: 'test',
            },
          });
          const foreignBranch = await tx.branch.create({
            data: {
              merchantId: otherMerchant.id,
              name: 'Foreign',
              createdBy: 'test',
              updatedBy: 'test',
            },
          });
          const scoped = new Proxy(tx, {
            get(target, key) {
              if (key === '$transaction')
                return async (callback: (transaction: Prisma.TransactionClient) => unknown) =>
                  callback(target);
              return Reflect.get(target, key);
            },
          });
          const couriers = new DeliveryCourierService(scoped as never);
          const created = await couriers.create(merchant.id, 'owner', {
            name: 'Ahmed Courier',
            phone: '01012345678',
            branchIds: [branch.id, secondBranch.id],
          });
          assert.deepEqual(
            created.branches.map((assigned) => assigned.id),
            [branch.id, secondBranch.id],
          );

          const ownerPage = await couriers.listForOwner(merchant.id, {});
          assert.deepEqual(
            ownerPage.items.map((item) => item.id),
            [created.id],
          );
          assert.deepEqual(await couriers.listForOwner(otherMerchant.id, {}), {
            items: [],
            nextCursor: null,
          });

          const employee: PosEmployeeSession = {
            id: randomUUID(),
            merchantId: merchant.id,
            username: 'cashier',
            displayName: 'Cashier',
            role: 'cashier',
            permissions: ['sell'],
            branch: { id: branch.id, name: branch.name, archivedAt: null },
          };
          assert.deepEqual(await couriers.listForPos(employee, {}), {
            items: [{ id: created.id, name: created.name }],
            nextCursor: null,
          });
          assert.deepEqual(
            await couriers.listForPos(
              {
                ...employee,
                branch: { id: unassignedBranch.id, name: unassignedBranch.name, archivedAt: null },
              },
              {},
            ),
            { items: [], nextCursor: null },
          );
          await assert.rejects(
            couriers.listForPos({ ...employee, permissions: [] }, {}),
            /cannot manage deliveries/,
          );
          await assert.rejects(
            couriers.create(merchant.id, 'owner', {
              name: 'Wrong branch',
              phone: null,
              branchIds: [foreignBranch.id],
            }),
            /belong to this business/,
          );
          await assert.rejects(
            couriers.update(otherMerchant.id, 'owner', created.id, {
              name: created.name,
              phone: created.phone,
              branchIds: [branch.id],
              revision: created.revision,
              active: false,
            }),
            /was not found/,
          );

          const inactive = await couriers.update(merchant.id, 'owner', created.id, {
            name: created.name,
            phone: created.phone,
            branchIds: [archivedBranch.id],
            revision: created.revision,
            active: false,
          });
          assert.equal(inactive.active, false);
          assert.deepEqual(await couriers.listForPos(employee, {}), {
            items: [],
            nextCursor: null,
          });
          await assert.rejects(
            couriers.update(merchant.id, 'owner', created.id, {
              name: inactive.name,
              phone: inactive.phone,
              branchIds: [archivedBranch.id],
              revision: inactive.revision,
              active: true,
            }),
            /active branch/,
          );
          await assert.rejects(
            couriers.update(merchant.id, 'owner', created.id, {
              name: created.name,
              phone: created.phone,
              branchIds: [branch.id],
              revision: created.revision,
              active: true,
            }),
            /changed since it was loaded/,
          );

          throw rollback;
        }),
        (error) => error === rollback,
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  },
);
