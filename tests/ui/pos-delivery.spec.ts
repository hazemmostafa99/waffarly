import { expect, test, type Page } from '@playwright/test';
import type { PosDeliverySummary } from '@waffarly/contracts';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const shiftId = '55555555-5555-4555-8555-555555555555';
const orderId = '66666666-6666-4666-8666-666666666666';
const paymentId = '77777777-7777-4777-8777-777777777777';
const checkId = '88888888-8888-4888-8888-888888888888';
const shift = {
  id: shiftId,
  branchId,
  registerId,
  registerName: 'Front drawer',
  openingFloat: '50.00',
  currency: 'EGP',
  openedAt: '2026-10-26T08:00:00Z',
  openedByEmployeeId: employeeId,
  openedByName: 'Mona',
  openRequestId: '99999999-9999-4999-8999-999999999999',
  status: 'open',
};

async function session(page: Page) {
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'mona',
        displayName: 'Mona',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [{ id: branchId, name: 'Main', archivedAt: null }],
      },
    }),
  );
  await page.route('**/pos/appearance', (route) =>
    route.fulfill({ json: { accent: 'orange', revision: 1 } }),
  );
  await page.route('**/pos/registers**', (route) =>
    route.fulfill({ json: [{ id: registerId, branchId, name: 'Front drawer' }] }),
  );
  await page.route('**/pos/shifts/current**', (route) => route.fulfill({ json: shift }));
}

function row(): PosDeliverySummary {
  return {
    orderId,
    branchId,
    sourceShiftId: shiftId,
    followupShiftId: shiftId,
    revision: 1,
    orderRevision: 1,
    orderStatus: 'completed',
    courierName: 'Courier Ali',
    status: 'delivered',
    dispatchedAt: '2026-10-26T08:00:00Z',
    deliveredAt: '2026-10-26T08:30:00Z',
    failureReason: null,
    custodianName: 'Mona',
    custodianEmployeeId: employeeId,
    customerDue: '100.00',
    courierCashHeld: '200.00',
    checks: [{ id: checkId, position: 0, balanceDue: '100.00' }],
    courierPayments: [{ id: paymentId, amount: '200.00', remaining: '200.00' }],
    remittances: [],
  };
}

for (const locale of ['en', 'ar'] as const) {
  test(`delivery distinguishes customer balance and courier custody (${locale})`, async ({
    page,
  }) => {
    await session(page);
    await page.route('**/pos/deliveries/ready?**', (route) =>
      route.fulfill({ json: { items: [], nextCursor: null } }),
    );
    await page.route('**/pos/deliveries?**', (route) =>
      route.fulfill({ json: { items: [row()], nextCursor: null } }),
    );
    await page.goto('/deliveries');
    if (locale === 'ar') await page.getByRole('button', { name: 'Change language' }).click();
    await expect(
      page.getByRole('heading', {
        name: locale === 'ar' ? 'متابعة الدليفري' : 'Delivery follow-up',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(locale === 'ar' ? 'لسه مطلوب من العميل' : 'Customer still owes', {
        exact: false,
      }),
    ).toContainText('100.00');
    await expect(
      page.getByText(locale === 'ar' ? 'كاش لسه مع الطيار' : 'Cash still with courier', {
        exact: false,
      }),
    ).toContainText('200.00');
    await expect(
      page.getByRole('button', {
        name: locale === 'ar' ? 'تأكيد الكاش اللي استلمته فعلًا' : 'Confirm cash actually received',
      }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('partial courier receipt survives lost response and reload with the identical command', async ({
  page,
}) => {
  await session(page);
  let delivery = row();
  const requests: unknown[] = [];
  await page.route('**/pos/deliveries/ready?**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/pos/deliveries?**', (route) =>
    route.fulfill({ json: { items: [delivery], nextCursor: null } }),
  );
  await page.route(`**/pos/deliveries/${orderId}/requests/**`, (route) =>
    route.fulfill({ json: { committed: true } }),
  );
  await page.route(`**/pos/deliveries/${orderId}/actions`, async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      delivery = {
        ...delivery,
        revision: 2,
        courierCashHeld: '125.00',
        courierPayments: [{ id: paymentId, amount: '200.00', remaining: '125.00' }],
      };
      await route.abort('failed');
    } else await route.fulfill({ json: delivery });
  });
  await page.goto('/deliveries');
  await page.getByLabel('Amount (EGP)', { exact: true }).fill('75.00');
  await page.getByRole('button', { name: 'Confirm cash actually received', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry the exact saved action', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Retry the exact saved action', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry the exact saved action', exact: true }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0]).toMatchObject({
    action: 'remit',
    amount: '75.00',
    receivingShiftId: shiftId,
    paymentId,
  });
});

test('shift hands pending deliveries to a named recipient without counting them as drawer cash', async ({
  page,
}) => {
  await session(page);
  let active: typeof shift | null = shift;
  let report: Record<string, unknown> | null = null;
  const commands: Array<Record<string, unknown>> = [];
  await page.route('**/pos/shifts/current**', (route) => route.fulfill({ json: active }));
  await page.route('**/pos/shifts/latest-close**', (route) => route.fulfill({ json: report }));
  await page.route(`**/pos/shifts/${shiftId}/reconciliation`, (route) =>
    route.fulfill({
      json: {
        shiftId,
        branchId,
        registerId,
        registerName: 'Front drawer',
        currency: 'EGP',
        unsettledCheckCount: 0,
        unsettledBalance: '0.00',
        manualMovements: [],
        pendingDeliveryCount: 1,
        pendingDeliveryBalance: '300.00',
      },
    }),
  );
  await page.route(`**/pos/shifts/${shiftId}/close-preview`, (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        unsettledCheckCount: 0,
        requiresReason: false,
        requiresSupervisorApproval: true,
        pendingDeliveryCount: 1,
        requiresDeliveryHandover: !body.deliveryHandover,
      },
    });
  });
  await page.route(`**/pos/shifts/${shiftId}/close`, (route) => {
    const body = route.request().postDataJSON();
    commands.push(body);
    active = null;
    report = {
      ...shift,
      shiftId,
      closedAt: '2026-10-26T09:00:00Z',
      operatorName: 'Mona',
      expectedCash: '50.00',
      countedCash: body.countedCash,
      variance: '0.00',
      cashDrop: '0.00',
      deliveryCashReceived: '0.00',
      deliveryHandover: {
        recipientEmployeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        recipientName: 'Ahmed',
        approvedByName: 'Supervisor',
        deliveries: [
          {
            orderId,
            courierName: 'Courier Ali',
            status: 'out_for_delivery',
            customerDue: '300.00',
            courierCashHeld: '0.00',
          },
        ],
      },
    };
    return route.fulfill({ json: report });
  });
  await page.goto('/shift');
  const form = page.locator('form').filter({ has: page.getByLabel('Counted cash (EGP)') });
  await form.getByLabel('Counted cash (EGP)').fill('50.00');
  await form.getByLabel('Receiving employee username').fill('ahmed');
  await form.getByLabel('Supervisor username').fill('supervisor');
  await form.getByLabel('Supervisor password').fill('test-supervisor-secret');
  await form.getByRole('button', { name: 'Close shift and save report' }).click();
  await expect(page.getByRole('heading', { name: 'Last shift close' })).toBeVisible();
  expect(commands[0]).toMatchObject({
    countedCash: '50.00',
    deliveryHandover: { recipientUsername: 'ahmed' },
    approval: { username: 'supervisor', password: 'test-supervisor-secret' },
  });
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('test-supervisor-secret');
  await expect(page.getByText('Delivery handover: Ahmed', { exact: true })).toBeVisible();
});

test('a rejected courier receipt is dismissed through the server before its recovery is cleared', async ({
  page,
}) => {
  await session(page);
  let saved: { requestId: string } | null = null;
  const abandoned: string[] = [];
  await page.route('**/pos/deliveries/ready?**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/pos/deliveries?**', (route) =>
    route.fulfill({ json: { items: [row()], nextCursor: null } }),
  );
  await page.route(`**/pos/deliveries/${orderId}/actions`, (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({
      status: 409,
      json: { message: 'The delivery changed. Refresh and retry.' },
    });
  });
  await page.route(`**/pos/deliveries/${orderId}/requests/*`, (route) =>
    route.fulfill({ json: { committed: false } }),
  );
  await page.route(`**/pos/deliveries/${orderId}/requests/*/abandon`, (route) => {
    abandoned.push(route.request().url());
    return route.fulfill({ json: { committed: false, discarded: true } });
  });
  await page.goto('/deliveries');
  await page.getByLabel('Amount (EGP)', { exact: true }).fill('75.00');
  await page.getByRole('button', { name: 'Confirm cash actually received', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Dismiss rejected action and review current details',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry the exact saved action', exact: true }),
  ).toHaveCount(0);
  expect(abandoned).toHaveLength(1);
  expect(abandoned[0]).toContain(`/requests/${saved!.requestId}/abandon`);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(saved!.requestId);
});
