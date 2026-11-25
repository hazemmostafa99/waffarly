import { createTestDatabaseClient } from '../support/test-database.js';
import { getTestDatabaseUrl } from '../support/test-database-environment.js';
import { ConflictException } from '@nestjs/common';

import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { PosReturnsService } from '../../src/modules/orders/returns/pos-returns.service.js';

const databaseUrl = getTestDatabaseUrl();

it(
  'records completed-sale item returns once, caps quantities, and keeps money and stock unchanged',
  { skip: !databaseUrl },
  async (testContext) => {
    assert.ok(databaseUrl, 'Configure TEST_DATABASE_URL and apply POS migrations first.');
    const client = createTestDatabaseClient(testContext);
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
              branchId: branch.id,
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
              branchId: branch.id,
              username: `return-supervisor-${token}`,
              displayName: 'Return supervisor',
              passwordHash: 'database-test-only',
              role: 'supervisor',
              permissions: [],
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
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
            branch: { id: branch.id, name: branch.name, archivedAt: null },
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
          const service = new PosReturnsService(
            transactionClient,
            new InventoryLedgerService(transactionClient),
          );
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

          await assert.rejects(
            service.record(
              employee,
              order.id,
              {
                ...command,
                requestId: randomUUID(),
                lines: [{ orderLineId: line.id, quantity: 1, disposition: 'restock' }],
              },
              supervisorRow.id,
            ),
            ConflictException,
          );

          await transaction.merchant.update({
            where: { id: merchant.id },
            data: { activity: 'clothing' },
          });
          employee.activity = 'clothing';
          const warehouse = await transaction.warehouse.create({
            data: {
              merchantId: merchant.id,
              branchId: branch.id,
              name: 'Clothing stock',
              isDefaultConsumption: true,
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
          });
          const stockItem = await transaction.stockItem.create({
            data: {
              merchantId: merchant.id,
              creationRequest: randomUUID(),
              creationFingerprint: randomUUID().replaceAll('-', ''),
              name: 'Blue shirt size M',
              baseUnit: 'piece',
              createdBy: 'pos-item-return-test',
              updatedBy: 'pos-item-return-test',
            },
          });
          const clothingOrder = await transaction.storefrontOrder.create({
            data: {
              merchantId: merchant.id,
              branchId: branch.id,
              source: 'pos',
              fulfillmentType: 'takeaway',
              status: 'completed',
              completedAt: new Date(),
              total: '100.00',
              currency: 'EGP',
            },
          });
          const clothingLine = await transaction.storefrontOrderLine.create({
            data: {
              merchantId: merchant.id,
              orderId: clothingOrder.id,
              productId: randomUUID(),
              variantId: randomUUID(),
              productName: 'Blue shirt',
              variantName: 'M / Blue',
              stockHandling: 'direct_sale',
              stockRequirementsFrozenAt: new Date(),
              quantity: 2,
              unitPrice: '50.00',
              lineTotal: '100.00',
              stockRequirements: {
                create: {
                  stockItemId: stockItem.id,
                  stockItemName: stockItem.name,
                  baseUnit: 'piece',
                  quantity: '2.000000',
                },
              },
            },
          });
          const sellable = await service.record(
            employee,
            clothingOrder.id,
            {
              requestId: randomUUID(),
              branchId: branch.id,
              reason: 'Sellable shirt returned',
              lines: [{ orderLineId: clothingLine.id, quantity: 1, disposition: 'restock' }],
            },
            supervisorRow.id,
          );
          assert.equal(sellable.return.lines[0]?.variantName, 'M / Blue');
          assert.equal(sellable.return.lines[0]?.disposition, 'restock');
          assert.equal(
            (
              await transaction.stockBalance.findUniqueOrThrow({
                where: {
                  merchantId_warehouseId_stockItemId_condition: {
                    merchantId: merchant.id,
                    warehouseId: warehouse.id,
                    stockItemId: stockItem.id,
                    condition: 'available',
                  },
                },
              })
            ).quantity.toString(),
            '1',
          );
          await service.record(
            employee,
            clothingOrder.id,
            {
              requestId: randomUUID(),
              branchId: branch.id,
              reason: 'Damaged shirt returned',
              lines: [{ orderLineId: clothingLine.id, quantity: 1, disposition: 'waste' }],
            },
            supervisorRow.id,
          );
          assert.equal(
            await transaction.stockMovement.count({
              where: { merchantId: merchant.id, stockItemId: stockItem.id },
            }),
            1,
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
