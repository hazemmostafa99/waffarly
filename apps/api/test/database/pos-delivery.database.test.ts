import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, createPostgresAdapter } from '@waffarly/database';
import { resolvePosEmployeePermissions, type PosEmployeeSession } from '@waffarly/contracts';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PosDeliveryService } from '../../src/modules/orders/pos-delivery.service.js';
import { PosOrdersService } from '../../src/modules/orders/pos-orders.service.js';
import { PosDiningService } from '../../src/modules/orders/pos-dining.service.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { ShiftsService } from '../../src/modules/shifts/shifts.service.js';
import { PosOperationsReportService } from '../../src/modules/reports/pos-operations-report.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'carries COD across closed shifts, separates courier collection from drawer receipt, and preserves audit and exact replay',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl);
    const db = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const token = randomUUID();
    const merchant = await db.merchant.create({
      data: {
        name: `Delivery test ${token}`,
        storefrontSlug: `delivery-${token}`,
        activity: 'restaurant',
        contactPhone: '01000000000',
        ownerName: 'Test',
        ownerMobile: '01000000000',
      },
    });
    const merchantId = merchant.id;
    try {
      const branch = await db.branch.create({
        data: { merchantId, name: `Branch ${token}`, createdBy: 'test', updatedBy: 'test' },
      });
      const employee = async (
        name: string,
        role: 'cashier' | 'supervisor',
      ): Promise<PosEmployeeSession> => {
        const row = await db.posEmployee.create({
          data: {
            merchantId,
            username: `${name}-${token}`,
            displayName: name,
            passwordHash: 'test-only',
            role,
            permissions: [],
            createdBy: 'test',
            updatedBy: 'test',
            branches: {
              create: {
                createdBy: 'test',
                branch: { connect: { id_merchantId: { id: branch.id, merchantId } } },
              },
            },
          },
        });
        return {
          id: row.id,
          merchantId,
          username: row.username,
          displayName: row.displayName,
          role,
          permissions: resolvePosEmployeePermissions(role, []),
          branches: [{ id: branch.id, name: branch.name, archivedAt: null }],
        };
      };
      const ahmed = await employee('Ahmed', 'cashier');
      const mona = await employee('Mona', 'cashier');
      const supervisor = await employee('Supervisor', 'supervisor');
      const shifts = new ShiftsService(db as unknown as PrismaService);
      const delivery = new PosDeliveryService(db as unknown as PrismaService, shifts);
      const orders = new PosOrdersService(
        db as unknown as PrismaService,
        {} as never,
        {} as never,
        {} as never,
        shifts,
        new PosDiningService(db as unknown as PrismaService),
        new PaymentsService(shifts),
      );
      const register = await shifts.createRegister(merchantId, 'test', {
        branchId: branch.id,
        name: 'Delivery drawer',
      });
      const first = await shifts.openShift(ahmed, {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '50.00',
      });
      const createOrder = async (
        fulfillmentType: 'delivery' | 'takeaway' = 'delivery',
        sourceShiftId = first.id,
      ) => {
        const order = await db.storefrontOrder.create({
          data: {
            merchantId,
            branchId: branch.id,
            posShiftId: sourceShiftId,
            createdByPosEmployeeId: ahmed.id,
            source: 'pos',
            fulfillmentType,
            status: 'ready',
            readyAt: new Date(),
            total: '300.00',
            customerName: 'Test customer',
            customerPhone: '01000000000',
            deliveryAddress: fulfillmentType === 'delivery' ? 'Test street building 1' : null,
          },
        });
        await db.storefrontOrderLine.create({
          data: {
            orderId: order.id,
            merchantId,
            productId: randomUUID(),
            productName: 'Delivery meal',
            unitPrice: '300.00',
            lineTotal: '300.00',
            quantity: 1,
            stockHandling: 'direct_sale',
          },
        });
        const check = await db.posOrderCheck.create({
          data: {
            merchantId,
            orderId: order.id,
            position: 0,
            amount: '300.00',
            splitMethod: 'whole',
          },
        });
        return { ...order, checks: [check] };
      };
      const order = await createOrder();
      const normal = await createOrder('takeaway');
      await assert.rejects(
        delivery.command(ahmed, normal.id, {
          action: 'dispatch',
          revision: normal.revision,
          requestId: randomUUID(),
          courierName: 'Courier',
        }),
      );
      const dispatch = {
        action: 'dispatch' as const,
        revision: order.revision,
        requestId: randomUUID(),
        courierName: 'Courier Ali',
      };
      let current = await delivery.command(ahmed, order.id, dispatch);
      assert.deepEqual(await delivery.command(ahmed, order.id, dispatch), current);
      const sideRegister = await shifts.createRegister(merchantId, 'test', {
        branchId: branch.id,
        name: 'Other drawer',
      });
      const sideShift = await shifts.openShift(ahmed, {
        registerId: sideRegister.id,
        requestId: randomUUID(),
        openingFloat: '0.00',
      });
      await assert.rejects(
        delivery.command(ahmed, order.id, {
          action: 'claim',
          requestId: randomUUID(),
          revision: current.revision,
          receivingShiftId: sideShift.id,
        }),
        ConflictException,
      );
      await assert.rejects(
        orders.recordCheckPayment(ahmed, order.id, order.checks[0]!.id, {
          requestId: randomUUID(),
          revision: current.orderRevision,
          receivingShiftId: sideShift.id,
          tenders: [{ method: 'cash', amount: '1.00', receivedAmount: '1.00' }],
        }),
        ConflictException,
      );
      assert.equal((await delivery.summary(ahmed, order.id)).customerDue, '300.00');
      await shifts.closeShift(ahmed, sideShift.id, {
        requestId: randomUUID(),
        countedCash: '0.00',
      });
      await assert.rejects(
        shifts.closeShift(
          ahmed,
          first.id,
          {
            requestId: randomUUID(),
            countedCash: '50.00',
            deliveryHandover: { recipientUsername: mona.username },
          },
          supervisor.id,
        ),
        ConflictException,
      );
      await db.posOrderCheck.update({
        where: { id: normal.checks[0]!.id },
        data: { cancelledAt: new Date() },
      });
      await db.storefrontOrder.update({
        where: { id: normal.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
      const live = await shifts.getReconciliation(ahmed, first.id);
      assert.equal(live.pendingDeliveryCount, 1);
      assert.equal(live.unsettledCheckCount, 0);
      assert.equal('expectedCash' in live, false);
      await assert.rejects(
        shifts.closeShift(ahmed, first.id, { requestId: randomUUID(), countedCash: '50.00' }),
        ForbiddenException,
      );
      await assert.rejects(
        shifts.closeShift(
          ahmed,
          first.id,
          {
            requestId: randomUUID(),
            countedCash: '50.00',
            deliveryHandover: { recipientUsername: ahmed.username },
          },
          supervisor.id,
        ),
        ForbiddenException,
      );
      const close = {
        requestId: randomUUID(),
        countedCash: '50.00',
        deliveryHandover: { recipientUsername: mona.username },
      };
      const firstReport = await shifts.closeShift(ahmed, first.id, close, supervisor.id);
      assert.equal(firstReport.expectedCash, '50.00');
      assert.equal(firstReport.variance, '0.00');
      assert.equal(firstReport.deliveryHandover?.deliveries[0]?.customerDue, '300.00');
      assert.equal(firstReport.deliveryHandover?.recipientName, 'Mona');
      assert.equal(
        (await shifts.closeShift(ahmed, first.id, close, supervisor.id)).id,
        firstReport.id,
      );
      const second = await shifts.openShift(mona, {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '20.00',
      });
      current = await delivery.summary(mona, order.id);
      await assert.rejects(
        delivery.command(ahmed, order.id, {
          action: 'claim',
          revision: current.revision,
          requestId: randomUUID(),
          receivingShiftId: second.id,
        }),
        ForbiddenException,
      );
      current = await delivery.command(mona, order.id, {
        action: 'claim',
        revision: current.revision,
        requestId: randomUUID(),
        receivingShiftId: second.id,
      });
      // Delivery can complete before money returns. No stock movement or fake payment.
      current = await delivery.command(mona, order.id, {
        action: 'delivered',
        revision: current.revision,
        requestId: randomUUID(),
      });
      assert.equal(current.orderStatus, 'completed');
      assert.equal(current.customerDue, '300.00');
      const customerPayment = {
        requestId: randomUUID(),
        revision: current.orderRevision,
        cashCustody: 'courier' as const,
        tenders: [{ method: 'cash' as const, amount: '200.00', receivedAmount: '200.00' }],
      };
      const paid = await orders.recordCheckPayment(
        mona,
        order.id,
        order.checks[0]!.id,
        customerPayment,
      );
      assert.deepEqual(
        await orders.recordCheckPayment(mona, order.id, order.checks[0]!.id, customerPayment),
        paid,
      );
      assert.equal(await db.posShiftCashMovement.count({ where: { merchantId } }), 0);
      current = await delivery.summary(mona, order.id);
      assert.equal(current.customerDue, '100.00');
      assert.equal(current.courierCashHeld, '200.00');
      const remit = {
        action: 'remit' as const,
        requestId: randomUUID(),
        revision: current.revision,
        receivingShiftId: second.id,
        paymentId: paid.payments[0]!.id,
        amount: '75.00',
      };
      current = await delivery.command(mona, order.id, remit);
      assert.deepEqual(await delivery.command(mona, order.id, remit), current);
      assert.equal(current.courierCashHeld, '125.00');
      const discardedRemit = {
        ...remit,
        requestId: randomUUID(),
        revision: current.revision,
        amount: '126.00',
      };
      await assert.rejects(delivery.command(mona, order.id, discardedRemit), ConflictException);
      assert.deepEqual(await delivery.abandonRequest(mona, order.id, discardedRemit.requestId), {
        committed: false,
        discarded: true,
      });
      await assert.rejects(
        delivery.command(mona, order.id, { ...discardedRemit, amount: '25.00' }),
        ConflictException,
      );
      await assert.rejects(
        delivery.command(mona, order.id, {
          ...remit,
          requestId: randomUUID(),
          revision: current.revision,
          amount: '126.00',
        }),
        ConflictException,
      );
      const competitors = await Promise.allSettled(
        [1, 2].map(() =>
          delivery.command(mona, order.id, {
            ...remit,
            requestId: randomUUID(),
            revision: current.revision,
            amount: '100.00',
          }),
        ),
      );
      assert.equal(competitors.filter((r) => r.status === 'fulfilled').length, 1);
      current = await delivery.summary(mona, order.id);
      assert.equal(current.courierCashHeld, '25.00');
      await delivery.command(mona, order.id, {
        ...remit,
        requestId: randomUUID(),
        revision: current.revision,
        amount: '25.00',
      });
      current = await delivery.summary(mona, order.id);
      // Remaining customer payment is physically received in the NEW drawer.
      await orders.recordCheckPayment(mona, order.id, order.checks[0]!.id, {
        requestId: randomUUID(),
        revision: current.orderRevision,
        receivingShiftId: second.id,
        tenders: [{ method: 'cash', amount: '100.00', receivedAmount: '100.00' }],
      });
      assert.equal((await delivery.list(mona, { branchId: branch.id })).items.length, 0);
      assert.equal(await db.posOrderPayment.count({ where: { merchantId, orderId: order.id } }), 2);
      assert.equal(await db.posCheckReceipt.count({ where: { merchantId, orderId: order.id } }), 1);
      const secondReport = await shifts.closeShift(mona, second.id, {
        requestId: randomUUID(),
        countedCash: '320.00',
      });
      assert.equal(secondReport.cashSales, '100.00');
      assert.equal(secondReport.deliveryCashReceived, '200.00');
      assert.equal(secondReport.expectedCash, '320.00');
      assert.deepEqual(await shifts.getCloseReport(ahmed, first.id), firstReport);
      const report = await new PosOperationsReportService(db as unknown as PrismaService).get(
        merchantId,
        {
          from: new Date(Date.now() - 86400000).toISOString(),
          to: new Date(Date.now() + 86400000).toISOString(),
          branchId: branch.id,
        },
      );
      assert.equal(report.collections.cash, '300.00');
      assert.equal(report.deliveryCash?.customerCollections, '200.00');
      assert.equal(report.deliveryCash?.drawerReceipts, '200.00');
      assert.equal(report.netCollected, '300.00');
      assert.equal(
        report.cashierActivity.find((row) => row.employeeId === mona.id)?.deliveryCashReceived,
        '200.00',
      );
      assert.equal(
        (await delivery.list(mona, { branchId: branch.id, includeResolved: 'true' })).items[0]
          ?.remittances?.length,
        3,
      );

      // A failed delivery retains both customer settlement and actual courier custody.
      const third = await shifts.openShift(mona, {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '0.00',
      });
      const failedOrder = await createOrder('delivery', third.id);
      let failed = await delivery.command(mona, failedOrder.id, {
        action: 'dispatch',
        requestId: randomUUID(),
        revision: failedOrder.revision,
        courierName: 'First courier',
      });
      await orders.recordCheckPayment(mona, failedOrder.id, failedOrder.checks[0]!.id, {
        requestId: randomUUID(),
        revision: failed.orderRevision,
        receivingShiftId: third.id,
        tenders: [{ method: 'cash', amount: '100.00', receivedAmount: '100.00' }],
      });
      failed = await delivery.summary(mona, failedOrder.id);
      const heldPayment = await orders.recordCheckPayment(
        mona,
        failedOrder.id,
        failedOrder.checks[0]!.id,
        {
          requestId: randomUUID(),
          revision: failed.orderRevision,
          cashCustody: 'courier',
          tenders: [{ method: 'cash', amount: '200.00', receivedAmount: '200.00' }],
        },
      );
      failed = await delivery.summary(mona, failedOrder.id);
      failed = await delivery.command(mona, failedOrder.id, {
        action: 'failed',
        requestId: randomUUID(),
        revision: failed.revision,
        reason: 'Customer requested another delivery time',
      });
      assert.equal(failed.customerDue, '0.00');
      assert.equal(failed.courierCashHeld, '200.00');
      await assert.rejects(
        delivery.command(mona, failedOrder.id, {
          action: 'dispatch',
          requestId: randomUUID(),
          revision: failed.revision,
          courierName: 'Replacement',
        }),
        ConflictException,
      );
      await assert.rejects(
        orders.recordCheckRefund(supervisor, failedOrder.id, failedOrder.checks[0]!.id, {
          requestId: randomUUID(),
          revision: failed.orderRevision,
          branchId: branch.id,
          refundShiftId: third.id,
          reason: 'Refund before courier remittance',
          allocations: [{ paymentId: heldPayment.payments[0]!.id, amount: '10.00' }],
        }),
        ConflictException,
      );
      const failedRemit = {
        action: 'remit' as const,
        requestId: randomUUID(),
        revision: failed.revision,
        receivingShiftId: third.id,
        paymentId: heldPayment.payments[0]!.id,
        amount: '200.00',
      };
      // An exception after inserting the drawer receipt must roll it back as well.
      const failingDb = {
        storefrontOrderAction: db.storefrontOrderAction,
        $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
          db.$transaction((tx) =>
            callback(
              new Proxy(tx, {
                get(target, property) {
                  if (property === 'posDeliveryRemittance')
                    return {
                      create: async (
                        args: Parameters<typeof tx.posDeliveryRemittance.create>[0],
                      ) => {
                        await tx.posDeliveryRemittance.create(args);
                        throw new Error('Injected remittance failure');
                      },
                    };
                  return Reflect.get(target, property);
                },
              }),
            ),
          ),
      };
      await assert.rejects(
        new PosDeliveryService(failingDb as unknown as PrismaService, shifts).command(
          mona,
          failedOrder.id,
          failedRemit,
        ),
        /Injected remittance failure/,
      );
      assert.equal(
        await db.posDeliveryRemittance.count({ where: { merchantId, orderId: failedOrder.id } }),
        0,
      );
      assert.equal((await delivery.summary(mona, failedOrder.id)).courierCashHeld, '200.00');
      failed = await delivery.command(mona, failedOrder.id, failedRemit);
      failed = await delivery.command(mona, failedOrder.id, {
        action: 'dispatch',
        requestId: randomUUID(),
        revision: failed.revision,
        courierName: 'Replacement',
      });
      await delivery.command(mona, failedOrder.id, {
        action: 'delivered',
        requestId: randomUUID(),
        revision: failed.revision,
      });
      assert.equal(
        (
          await shifts.closeShift(mona, third.id, {
            requestId: randomUUID(),
            countedCash: '300.00',
          })
        ).expectedCash,
        '300.00',
      );

      // Closing and receiving courier cash contend on the same receiving shift.
      const fourth = await shifts.openShift(mona, {
        registerId: register.id,
        requestId: randomUUID(),
        openingFloat: '0.00',
      });
      const raceOrder = await createOrder('delivery', fourth.id);
      let racing = await delivery.command(mona, raceOrder.id, {
        action: 'dispatch',
        requestId: randomUUID(),
        revision: raceOrder.revision,
        courierName: 'Race courier',
      });
      const racePayment = await orders.recordCheckPayment(
        mona,
        raceOrder.id,
        raceOrder.checks[0]!.id,
        {
          requestId: randomUUID(),
          revision: racing.orderRevision,
          cashCustody: 'courier',
          tenders: [{ method: 'cash', amount: '300.00', receivedAmount: '300.00' }],
        },
      );
      racing = await delivery.summary(mona, raceOrder.id);
      racing = await delivery.command(mona, raceOrder.id, {
        action: 'delivered',
        requestId: randomUUID(),
        revision: racing.revision,
      });
      const race = await Promise.allSettled([
        shifts.closeShift(
          ahmed,
          fourth.id,
          {
            requestId: randomUUID(),
            countedCash: '0.00',
            reason: 'Close/remit race',
            deliveryHandover: { recipientUsername: mona.username },
          },
          supervisor.id,
        ),
        delivery.command(mona, raceOrder.id, {
          action: 'remit',
          requestId: randomUUID(),
          revision: racing.revision,
          receivingShiftId: fourth.id,
          paymentId: racePayment.payments[0]!.id,
          amount: '300.00',
        }),
      ]);
      assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
      if (race[0]!.status === 'fulfilled') {
        assert.equal(race[0]!.value.expectedCash, '0.00');
        assert.equal(race[0]!.value.deliveryHandover?.deliveries[0]?.courierCashHeld, '300.00');
      } else {
        assert.equal(
          (
            await shifts.closeShift(mona, fourth.id, {
              requestId: randomUUID(),
              countedCash: '300.00',
            })
          ).expectedCash,
          '300.00',
        );
      }
      assert.equal(
        await db.posOrderPayment.count({ where: { merchantId, orderId: raceOrder.id } }),
        1,
      );
      await assert.rejects(delivery.summary({ ...mona, merchantId: randomUUID() }, order.id));
      await assert.rejects(
        delivery.list({ ...mona, merchantId: randomUUID(), branches: [] }, { branchId: branch.id }),
        ForbiddenException,
      );
      await assert.rejects(
        delivery.summary({ ...mona, branches: [] }, order.id),
        ForbiddenException,
      );
      assert.equal(await db.stockMovementBatch.count({ where: { merchantId } }), 0);
    } finally {
      await db.$transaction(async (tx) => {
        await tx.posShiftCloseReport.deleteMany({ where: { merchantId } });
        await tx.posDeliveryRemittance.deleteMany({ where: { merchantId } });
        await tx.posDelivery.deleteMany({ where: { merchantId } });
        await tx.posShiftCashMovement.deleteMany({ where: { merchantId } });
        await tx.posCheckReceipt.deleteMany({ where: { merchantId } });
        await tx.posOrderPayment.deleteMany({ where: { merchantId } });
        await tx.posOrderCheck.deleteMany({ where: { merchantId } });
        await tx.storefrontOrderAction.deleteMany({ where: { merchantId } });
        await tx.storefrontOrder.deleteMany({ where: { merchantId } });
        await tx.posShift.deleteMany({ where: { merchantId } });
        await tx.posRegister.deleteMany({ where: { merchantId } });
        await tx.posEmployeeBranch.deleteMany({ where: { merchantId } });
        await tx.posEmployee.deleteMany({ where: { merchantId } });
        await tx.branch.deleteMany({ where: { merchantId } });
        await tx.merchant.delete({ where: { id: merchantId } });
      });
      await db.$disconnect();
    }
  },
);
