import { expect, test, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const checkId = '66666666-6666-4666-8666-666666666666';
const productId = '77777777-7777-4777-8777-777777777777';

function paymentState() {
  return {
    orderId,
    revision: 1,
    total: '34.86',
    currency: 'EGP',
    status: 'pending',
    checks: [
      {
        id: checkId,
        position: 0,
        amount: '34.86',
        paidAmount: '0.00',
        balanceDue: '34.86',
        revision: 1,
        status: 'open',
        settledAt: null,
        payments: [],
      },
    ],
  };
}

async function openCheckout(page: Page, interruptFirstPayment = false, mobile = false) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  const orderState = paymentState();
  let postCount = 0;
  const paymentRequests: Record<string, unknown>[] = [];
  const processedPayments = new Map<string, Record<string, unknown>>();

  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Cashier',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
  await page.route('**/pos/registers?**', (route) =>
    route.fulfill({ json: [{ id: registerId, branchId, name: 'Front register' }] }),
  );
  await page.route('**/pos/shifts/current?**', (route) =>
    route.fulfill({
      json: {
        id: '88888888-8888-4888-8888-888888888888',
        branchId,
        registerId,
        registerName: 'Front register',
        openedByEmployeeId: employeeId,
        openedByName: 'Cashier',
        openRequestId: '99999999-9999-4999-8999-999999999999',
        openingFloat: '100.00',
        currency: 'EGP',
        openedAt: '2026-10-17T08:00:00.000Z',
        status: 'open',
      },
    }),
  );
  await page.route('**/pos/dining/tables?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/pos/catalog**', (route) =>
    route.fulfill({
      json: {
        categories: { items: [], nextCursor: null },
        products: {
          items: [
            {
              id: productId,
              name: 'Test coffee',
              description: null,
              basePrice: '34.86',
              currency: 'EGP',
              sellingUnit: 'piece',
              images: [],
              categories: [],
              modifierGroups: [],
              variants: [],
            },
          ],
          nextCursor: null,
        },
      },
    }),
  );
  await page.route('**/pos/orders/quote', async (route) => {
    const input = route.request().postDataJSON() as {
      items: Array<{ lineId: string; quantity: number }>;
    };
    const line = input.items[0]!;
    await route.fulfill({
      json: {
        currency: 'EGP',
        subtotal: '34.86',
        total: '34.86',
        items: [
          {
            lineId: line.lineId,
            quantity: line.quantity,
            lineTotal: '34.86',
            quote: {
              productId,
              productRevision: 1,
              variantId: null,
              variantName: null,
              variantAttributes: [],
              currency: 'EGP',
              basePrice: '34.86',
              modifierTotal: '0.00',
              totalPrice: '34.86',
              selections: [],
            },
          },
        ],
      },
    });
  });
  await page.route('**/pos/orders', (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: orderId,
        status: 'pending',
        customerName: null,
        customerPhone: null,
        fulfillmentType: 'takeaway',
        deliveryAddress: null,
        currency: 'EGP',
        total: '34.86',
        createdAt: '2026-10-17T08:00:00.000Z',
        lines: [],
      },
    }),
  );
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ json: orderState }),
  );
  await page.route(`**/pos/orders/${orderId}/checks/${checkId}/payments`, async (route) => {
    postCount += 1;
    const request = route.request().postDataJSON() as Record<string, unknown>;
    paymentRequests.push(request);
    const body = request as { requestId: string; tenders: Array<{ amount: string }> };
    const savedResponse = processedPayments.get(body.requestId);
    if (savedResponse) {
      await route.fulfill({ status: 201, json: savedResponse });
      return;
    }
    const applied = body.tenders.reduce((sum, tender) => sum + Number(tender.amount), 0);
    const due = Math.max(0, 34.86 - applied).toFixed(2);
    const paid = (34.86 - Number(due)).toFixed(2);
    const payments = body.tenders.map((tender, index) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
      position: index,
      method: index === 0 ? 'cash' : 'terminal',
      amount: tender.amount,
      receivedAmount: tender.amount,
      changeAmount: '0.00',
      terminalReference: null,
      operatorEmployeeId: employeeId,
      createdAt: '2026-10-17T08:01:00.000Z',
    }));
    orderState.revision += 1;
    orderState.checks[0]!.paidAmount = paid;
    orderState.checks[0]!.balanceDue = due;
    orderState.checks[0]!.status = due === '0.00' ? 'settled' : 'open';
    orderState.checks[0]!.settledAt = due === '0.00' ? '2026-10-17T08:01:00.000Z' : null;
    orderState.checks[0]!.revision += 1;
    orderState.checks[0]!.payments.push(...payments);
    const response = {
      orderId,
      orderRevision: orderState.revision,
      check: {
        id: checkId,
        amount: '34.86',
        paidAmount: paid,
        balanceDue: due,
        revision: orderState.checks[0]!.revision,
        status: due === '0.00' ? 'settled' : 'open',
        settledAt: due === '0.00' ? '2026-10-17T08:01:00.000Z' : null,
      },
      payments,
    };
    processedPayments.set(body.requestId, response);
    if (interruptFirstPayment && postCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: 201, json: response });
  });

  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Add to order', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  await page.getByRole('button', { name: 'Take payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Take payment' })).toBeVisible();
  return {
    paymentRequests,
    processedPaymentCount: () => orderState.checks[0]!.payments.length,
  };
}

test('cashier records a split cash and terminal payment and sees the remaining balance', async ({
  page,
}) => {
  const { paymentRequests } = await openCheckout(page);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });

  await dialog.getByLabel('Amount for payment 1').fill('5.00');
  await dialog.getByLabel('Cash received for payment 1').fill('10.00');
  await dialog.getByRole('button', { name: 'Add payment method' }).click();
  await dialog.getByLabel('Amount for payment 2').fill('3.00');
  await expect(dialog.getByText('26.86', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Record partial payment' }).click();

  await expect(dialog.getByRole('status').filter({ hasText: 'Payment recorded' })).toBeVisible();
  await expect(dialog.getByText('26.86', { exact: false }).first()).toBeVisible();
  expect(paymentRequests).toHaveLength(1);
  expect(paymentRequests[0]).toMatchObject({
    revision: 1,
    tenders: [
      { method: 'cash', amount: '5.00', receivedAmount: '10.00' },
      { method: 'terminal', amount: '3.00' },
    ],
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('cashier retries an uncertain payment with the exact same command ID', async ({ page }) => {
  const { paymentRequests, processedPaymentCount } = await openCheckout(page, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByRole('button', { name: 'Settle check' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Retry this exact payment');
  await dialog.getByRole('button', { name: 'Retry the same payment' }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Payment recorded' })).toBeVisible();
  expect(paymentRequests).toHaveLength(2);
  expect(paymentRequests[1]!.requestId).toBe(paymentRequests[0]!.requestId);
  expect(paymentRequests[1]!.tenders).toEqual(paymentRequests[0]!.tenders);
  expect(processedPaymentCount()).toBe(1);
});

test('cashier recovers a committed payment after navigating and reloading', async ({ page }) => {
  const { paymentRequests, processedPaymentCount } = await openCheckout(page, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByRole('button', { name: 'Settle check' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Retry this exact payment');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();

  await page.getByRole('link', { name: 'Tables' }).click();
  await expect(page.getByRole('heading', { name: 'Tables & open sessions' })).toBeVisible();
  const recoveryNotice = page.locator('section[aria-label="Payments needing confirmation"]');
  await expect(recoveryNotice).toContainText('Order #55555555');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(recoveryNotice).toContainText('Order #55555555');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(paymentRequests).toHaveLength(1);

  await page.getByRole('button', { name: 'Change language' }).click();
  const arabicRecoveryNotice = page.locator('section[aria-label="دفعات تحتاج إلى تأكيد"]');
  await expect(arabicRecoveryNotice).toContainText('تحتاج الدفعات إلى تأكيد');
  await page.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }).first().click();
  const recoveredDialog = page.getByRole('dialog', { name: 'تحصيل مبلغ' });
  await expect(recoveredDialog.getByText('EGP 0.00')).toBeVisible();
  await expect(recoveredDialog.getByRole('status')).toContainText('على هذا الجهاز');
  await expect(
    recoveredDialog.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-payment-recovery-mobile.png' });
  await recoveredDialog.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }).click();
  await expect(
    recoveredDialog.getByRole('status').filter({ hasText: 'تم تسجيل الدفع' }),
  ).toBeVisible();
  await expect(arabicRecoveryNotice).toHaveCount(0);
  expect(paymentRequests).toHaveLength(2);
  expect(paymentRequests[1]!.requestId).toBe(paymentRequests[0]!.requestId);
  expect(paymentRequests[1]!.tenders).toEqual(paymentRequests[0]!.tenders);
  expect(processedPaymentCount()).toBe(1);
});

test('checkout keeps the due amount and primary action visible on a narrow screen', async ({
  page,
}) => {
  await openCheckout(page, false, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(dialog.getByText('Remaining balance')).toBeVisible();
  await expect(dialog.getByText('Balance after payment')).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-checkout-mobile.png' });
});
