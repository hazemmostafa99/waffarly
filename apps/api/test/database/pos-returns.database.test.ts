import { ConflictException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosReturnsService } from '../../src/modules/orders/pos-returns.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'records completed-sale item returns once, caps quantities, and keeps money and stock unchanged',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply POS migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback POS item-return database fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `POS item return ${token}`,
              storefrontSlug: `pos-item-return-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'POS item return test',
              ownerMobile: '01100000000',
            },
          });
          const branch = await transaction.branch.create({
            data: {
              merchantId: merchant.id,
              name: `Returns ${token}`,
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
          });
          const cashierRow = await transaction.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: `return-cashier-${token}`,
              displayName: 'Return cashier',
              passwordHash: 'database-test-only',
              role: 'cashier',
              permissions: ['sell'],
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
          });
          const supervisorRow = await transaction.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: `return-supervisor-${token}`,
              displayName: 'Return supervisor',
              passwordHash: 'database-test-only',
              role: 'supervisor',
              permissions: [],
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
          });
          await transaction.posEmployeeBranch.createMany({
            data: [cashierRow, supervisorRow].map((employee) => ({
              merchantId: merchant.id,
              employeeId: employee.id,
              branchId: branch.id,
              createdBy: 'pos-item-return-test',
            })),
          });
          const order = await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branch.id,
              source: 'pos',
              fulfillmentType: 'takeaway',
              status: 'completed',
              completedAt: new Date(),
              total: '80.00',
              currency: 'EGP',
            },
          });
          const line = await transaction.storefrontOrderLine.create({
            data: {
              merchantId: merchant.id,
              orderId: order.id,
              productId: randomUUID(),
              productName: 'Test sandwich',
              quantity: 2,
              unitPrice: '40.00',
              lineTotal: '80.00',
            },
          });
          const employee: PosEmployeeSession = {
            id: cashierRow.id,
            merchantId: merchant.id,
            username: cashierRow.username,
            displayName: cashierRow.displayName,
            role: 'cashier',
            permissions: ['sell'],
            branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
          };
          const transactionClient = new Proxy(transaction, {
            get(target, property) {
              if (property === '$transaction') {
                return async (callback: (tx: typeof transaction) => Promise<unknown>) =>
                  callback(target);
              }
              return Reflect.get(target, property, target);
            },
          }) as unknown as PrismaService;
          const service = new PosReturnsService(transactionClient);
          const command = {
            requestId: randomUUID(),
            branchId: branch.id,
            reason: 'Customer returned a damaged item',
            lines: [{ orderLineId: line.id, quantity: 1 }],
          };
          const first = await service.record(employee, order.id, command, supervisorRow.id);
          assert.equal(first.return.amount, '40.00');
          assert.equal(first.return.approvedBy, supervisorRow.displayName);
          assert.equal(first.return.lines[0]?.disposition, 'waste');
          assert.equal(first.state.items[0]?.soldQuantity, 2);
          assert.equal(first.state.items[0]?.returnedQuantity, 1);
          assert.equal(first.state.items[0]?.returnableQuantity, 1);
          assert.equal(first.state.returns.length, 1);

          const replay = await service.record(employee, order.id, command, supervisorRow.id);
          assert.equal(replay.return.id, first.return.id);
          assert.equal(
            await transaction.posOrderItemReturn.count({ where: { orderId: order.id } }),
            1,
          );
          await assert.rejects(
            service.record(
              employee,
              order.id,
              {
                ...command,
                requestId: randomUUID(),
                lines: [{ orderLineId: line.id, quantity: 2 }],
              },
              supervisorRow.id,
            ),
            ConflictException,
          );
          await assert.rejects(
            service.record(
              employee,
              order.id,
              { ...command, requestId: randomUUID(), branchId: randomUUID() },
              supervisorRow.id,
            ),
          );
          assert.equal(
            await transaction.posOrderPayment.count({ where: { orderId: order.id } }),
            0,
          );
          assert.equal(
            await transaction.posOrderItemReturnLine.count({ where: { orderId: order.id } }),
            1,
          );
          assert.equal(
            (
              await transaction.storefrontOrder.findUniqueOrThrow({ where: { id: order.id } })
            ).total.toString(),
            '80',
          );
          throw rollback;
        }),
        rollback,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
