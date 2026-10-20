import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { Prisma } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosReturnsService } from '../../src/modules/orders/pos-returns.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

it(
  'lists immutable waste returns by tenant, branch and date with stable bounded pagination',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply POS migrations first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const rollback = new Error('Rollback POS item-return report fixtures');
    try {
      await assert.rejects(
        client.$transaction(async (transaction) => {
          const token = randomUUID().replaceAll('-', '');
          const merchant = await transaction.merchant.create({
            data: {
              name: `POS return report ${token}`,
              storefrontSlug: `pos-return-report-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'POS return report test',
              ownerMobile: '01100000000',
            },
          });
          const branchA = await transaction.branch.create({
            data: {
              merchantId: merchant.id,
              name: `Front ${token}`,
              createdBy: 'pos-return-report-test',
              updatedBy: 'pos-return-report-test',
            },
          });
          const branchB = await transaction.branch.create({
            data: {
              merchantId: merchant.id,
              name: `Patio ${token}`,
              createdBy: 'pos-return-report-test',
              updatedBy: 'pos-return-report-test',
            },
          });
          const employee = await transaction.posEmployee.create({
            data: {
              merchantId: merchant.id,
              username: `return-report-${token}`,
              displayName: 'Return report cashier',
              passwordHash: 'database-test-only',
              role: 'cashier',
              permissions: ['sell'],
              createdBy: 'pos-return-report-test',
              updatedBy: 'pos-return-report-test',
            },
          });
          const createSaleReturn = async (options: {
            ownerId: string;
            branchId: string;
            branchName: string;
            issuedAt: Date;
            label: string;
          }) => {
            const order = await transaction.storefrontOrder.create({
              data: {
                merchantId: options.ownerId,
                branchId: options.branchId,
                branchName: options.branchName,
                source: 'pos',
                fulfillmentType: 'takeaway',
                status: 'completed',
                completedAt: options.issuedAt,
                total: '120.00',
                currency: 'EGP',
              },
            });
            const orderLine = await transaction.storefrontOrderLine.create({
              data: {
                merchantId: options.ownerId,
                orderId: order.id,
                productId: randomUUID(),
                productName: `${options.label} sandwich`,
                quantity: 2,
                unitPrice: '60.00',
                lineTotal: '120.00',
              },
            });
            const returnId = randomUUID();
            const requestId = randomUUID();
            await transaction.posOrderItemReturn.create({
              data: {
                id: returnId,
                merchantId: options.ownerId,
                orderId: order.id,
                requestId,
                fingerprint: 'a'.repeat(64),
                createdByEmployeeId: employee.id,
                returnNumber: `RET-${returnId.slice(0, 12).toUpperCase()}`,
                reason: `${options.label} returned damaged`,
                amount: '60.00',
                currency: 'EGP',
                issuedAt: options.issuedAt,
                snapshot: {
                  id: returnId,
                  requestId,
                  orderId: order.id,
                  issuedBy: 'Return report cashier',
                  approvedBy: null,
                  internalSnapshotMarker: 'must-not-be-returned',
                } as Prisma.InputJsonValue,
                lines: {
                  create: {
                    productName: `${options.label} sandwich`,
                    variantName: 'Large',
                    quantity: 1,
                    disposition: 'waste',
                    unitPrice: '60.00',
                    amount: '60.00',
                    orderLine: {
                      connect: {
                        id_orderId_merchantId: {
                          id: orderLine.id,
                          orderId: order.id,
                          merchantId: options.ownerId,
                        },
                      },
                    },
                  },
                },
              },
            });
            return { id: returnId, orderId: order.id };
          };

          const ownerRows = [
            await createSaleReturn({
              ownerId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              issuedAt: new Date('2026-10-19T12:00:00.000Z'),
              label: 'Newest',
            }),
            await createSaleReturn({
              ownerId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              issuedAt: new Date('2026-10-18T12:00:00.000Z'),
              label: 'Older',
            }),
            await createSaleReturn({
              ownerId: merchant.id,
              branchId: branchB.id,
              branchName: branchB.name,
              issuedAt: new Date('2026-10-19T13:00:00.000Z'),
              label: 'Other branch',
            }),
            await createSaleReturn({
              ownerId: merchant.id,
              branchId: branchA.id,
              branchName: branchA.name,
              issuedAt: new Date('2026-09-30T23:59:59.999Z'),
              label: 'Outside dates',
            }),
          ];

          const foreignMerchant = await transaction.merchant.create({
            data: {
              name: `Foreign return report ${token}`,
              storefrontSlug: `foreign-return-report-${token}`,
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Foreign report test',
              ownerMobile: '01100000000',
            },
          });
          const foreignBranch = await transaction.branch.create({
            data: {
              merchantId: foreignMerchant.id,
              name: `Foreign ${token}`,
              createdBy: 'pos-return-report-test',
              updatedBy: 'pos-return-report-test',
            },
          });
          const foreignEmployee = await transaction.posEmployee.create({
            data: {
              merchantId: foreignMerchant.id,
              username: `foreign-return-report-${token}`,
              displayName: 'Foreign Return report cashier',
              passwordHash: 'database-test-only',
              role: 'cashier',
              permissions: ['sell'],
              createdBy: 'pos-return-report-test',
              updatedBy: 'pos-return-report-test',
            },
          });
          const foreign = await transaction.storefrontOrder.create({
            data: {
              merchantId: foreignMerchant.id,
              branchId: foreignBranch.id,
              branchName: foreignBranch.name,
              source: 'pos',
              fulfillmentType: 'takeaway',
              status: 'completed',
              total: '60.00',
              currency: 'EGP',
            },
          });
          const foreignLine = await transaction.storefrontOrderLine.create({
            data: {
              merchantId: foreignMerchant.id,
              orderId: foreign.id,
              productId: randomUUID(),
              productName: 'Foreign sandwich',
              quantity: 1,
              unitPrice: '60.00',
              lineTotal: '60.00',
            },
          });
          const foreignReturnId = randomUUID();
          await transaction.posOrderItemReturn.create({
            data: {
              id: foreignReturnId,
              merchantId: foreignMerchant.id,
              orderId: foreign.id,
              requestId: randomUUID(),
              fingerprint: 'b'.repeat(64),
              createdByEmployeeId: foreignEmployee.id,
              returnNumber: `RET-${foreignReturnId.slice(0, 12).toUpperCase()}`,
              reason: 'Foreign merchant return',
              amount: '60.00',
              currency: 'EGP',
              issuedAt: new Date('2026-10-19T14:00:00.000Z'),
              snapshot: { issuedBy: 'Foreign cashier' } as Prisma.InputJsonValue,
              lines: {
                create: {
                  productName: 'Foreign sandwich',
                  quantity: 1,
                  disposition: 'waste',
                  unitPrice: '60.00',
                  amount: '60.00',
                  orderLine: {
                    connect: {
                      id_orderId_merchantId: {
                        id: foreignLine.id,
                        orderId: foreign.id,
                        merchantId: foreignMerchant.id,
                      },
                    },
                  },
                },
              },
            },
          });

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
          const baseQuery = {
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-20T00:00:00.000Z',
            limit: 25,
          };
          const first = await service.listOwnerReports(merchant.id, {
            ...baseQuery,
            branchId: branchA.id,
            limit: 1,
          });
          assert.equal(first.items.length, 1);
          assert.equal(first.items[0]?.id, ownerRows[0]?.id);
          assert.ok(first.nextCursor);
          assert.equal('snapshot' in first.items[0]!, false);
          assert.equal(first.items[0]?.branchName, branchA.name);
          assert.equal(
            first.items[0]?.orderReference,
            `ORD-${ownerRows[0]?.orderId.slice(0, 8).toUpperCase()}`,
          );
          assert.equal(first.items[0]?.referenceValue, '60.00');
          assert.equal(first.items[0]?.issuedBy, 'Return report cashier');
          assert.equal(first.items[0]?.lines[0]?.disposition, 'waste');
          assert.equal(JSON.stringify(first).includes('must-not-be-returned'), false);
          const second = await service.listOwnerReports(merchant.id, {
            ...baseQuery,
            branchId: branchA.id,
            cursor: first.nextCursor,
            limit: 1,
          });
          assert.deepEqual(
            second.items.map((row) => row.id),
            [ownerRows[1]?.id],
          );
          assert.equal(second.nextCursor, null);

          const branchBPage = await service.listOwnerReports(merchant.id, {
            ...baseQuery,
            branchId: branchB.id,
          });
          assert.equal(branchBPage.items.length, 1);
          assert.equal(branchBPage.items[0]?.branchId, branchB.id);
          const allBranches = await service.listOwnerReports(merchant.id, baseQuery);
          assert.equal(allBranches.items.length, 3);
          assert.equal(
            allBranches.items.some((row) => row.id === foreignReturnId),
            false,
          );
          assert.equal(
            allBranches.items.some((row) => row.id === ownerRows[3]?.id),
            false,
          );
          await assert.rejects(
            service.listOwnerReports(merchant.id, {
              ...baseQuery,
              branchId: foreignBranch.id,
            }),
            NotFoundException,
          );
          await assert.rejects(
            service.listOwnerReports(merchant.id, {
              ...baseQuery,
              branchId: branchB.id,
              cursor: first.nextCursor!,
            }),
            BadRequestException,
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
