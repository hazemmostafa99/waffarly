import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const otherBranchId = '44444444-4444-4444-8444-444444444444';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const checkId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeReceipt({
  id,
  receiptNumber,
  orderReference,
  checkNumber,
  amount,
}: {
  id: string;
  receiptNumber: string;
  orderReference: string;
  checkNumber: number;
  amount: string;
}) {
  return {
    id,
    receiptNumber,
    issuedAt: '2026-10-17T08:01:00.000Z',
    orderId,
    checkId,
    orderReference,
    checkNumber,
    amount,
    currency: 'EGP',
  };
}

const recentReceipt = makeReceipt({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  receiptNumber: 'POS-RCPT-0001049',
  orderReference: 'ORD-1049',
  checkNumber: 2,
  amount: '110.00',
});
const olderReceipt = makeReceipt({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  receiptNumber: 'POS-RCPT-0001048',
  orderReference: 'ORD-1048',
  checkNumber: 1,
  amount: '85.00',
});

function makeReceiptDocument() {
  return {
    version: 1,
    id: recentReceipt.id,
    receiptNumber: recentReceipt.receiptNumber,
    issuedAt: recentReceipt.issuedAt,
    merchantName: 'Waffarly Cafe',
    branchName: 'Main branch',
    orderId,
    orderReference: recentReceipt.orderReference,
    orderCreatedAt: '2026-10-17T08:00:00.000Z',
    fulfillmentType: 'takeaway',
    tableCode: null,
    cashierName: 'Test cashier',
    registerName: 'Front register',
    currency: 'EGP',
    checkNumber: recentReceipt.checkNumber,
    splitMethod: 'whole',
    amount: recentReceipt.amount,
    items: [
      {
        name: 'Test coffee',
        variantName: null,
        selections: [],
        quantity: 1,
        unitPrice: recentReceipt.amount,
        total: recentReceipt.amount,
      },
    ],
    payments: [
      {
        method: 'cash',
        amount: recentReceipt.amount,
        receivedAmount: '110.00',
        changeAmount: '0.00',
      },
    ],
    paidAmount: recentReceipt.amount,
    cashReceivedAmount: recentReceipt.amount,
    changeAmount: '0.00',
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Test cashier',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [
          { id: branchId, name: 'Main branch', archivedAt: null },
          { id: otherBranchId, name: 'Airport branch', archivedAt: null },
        ],
      },
    }),
  );
});

test('receipt history supports branch scope, search, pagination and opening a saved receipt', async ({
  page,
}, testInfo) => {
  let listRequests = 0;
  let paymentRequests = 0;

  await page.route('**/pos/receipts?**', async (route) => {
    listRequests += 1;
    const url = new URL(route.request().url());
    const requestedBranch = url.searchParams.get('branchId');
    if (requestedBranch === otherBranchId) {
      await route.fulfill({
        json: { items: [olderReceipt], nextCursor: null },
      });
      return;
    }
    if (url.searchParams.get('cursor') === 'older-page') {
      await route.fulfill({ json: { items: [olderReceipt], nextCursor: null } });
      return;
    }
    await route.fulfill({
      json: { items: [recentReceipt], nextCursor: 'older-page' },
    });
  });
  await page.route(`**/pos/orders/${orderId}/checks/${checkId}/receipt`, (route) =>
    route.fulfill({ json: makeReceiptDocument() }),
  );
  await page.route('**/pos/orders/*/checks/*/payments', async (route) => {
    paymentRequests += 1;
    await route.fulfill({ status: 500, json: { message: 'Unexpected payment request' } });
  });

  await page.goto('/receipts');
  await expect(page.getByRole('heading', { name: 'Receipts', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toContainText(
    'ORD-1049',
  );
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toContainText(
    'EGP',
  );
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search receipt or order number' });
  await search.fill('ORD-1049');
  await expect(page.getByRole('article')).toHaveCount(1);
  await search.fill('does-not-exist');
  await expect(page.getByText('No matching receipts')).toBeVisible();
  await search.clear();

  await page.getByRole('button', { name: 'Load more receipts' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => listRequests).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('article')).toHaveCount(2);

  await page.getByLabel('Branch').selectOption(otherBranchId);
  await expect(page.getByRole('article', { name: olderReceipt.receiptNumber })).toBeVisible();
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toHaveCount(0);
  await page.getByLabel('Branch').selectOption(branchId);
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toBeVisible();

  await page
    .getByRole('article', { name: recentReceipt.receiptNumber })
    .getByRole('button', { name: 'View / print receipt' })
    .click();
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText('Test coffee');
  await page.getByRole('button', { name: 'Back to receipts' }).click();
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toBeVisible();
  expect(paymentRequests).toBe(0);

  if (process.env.POS_RECEIPTS_CAPTURE === '1') {
    await page.screenshot({
      path: testInfo.outputPath('receipt-history-dark.png'),
      fullPage: true,
    });
    await page.getByLabel('Theme').selectOption('light');
    await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'light');
    await page.screenshot({
      path: testInfo.outputPath('receipt-history-light.png'),
      fullPage: true,
    });
  }
  if ((page.viewportSize()?.width ?? 0) < 600) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
});

test('receipt errors do not look like an empty history and can be refreshed', async ({ page }) => {
  let shouldFail = true;
  await page.route('**/pos/receipts?**', async (route) => {
    if (shouldFail) {
      await route.fulfill({ status: 503, json: { message: 'Receipt service unavailable.' } });
      return;
    }
    await route.fulfill({ json: { items: [recentReceipt], nextCursor: null } });
  });

  await page.goto('/receipts');
  await expect(page.getByRole('alert')).toContainText('Receipt service unavailable.');
  await expect(page.getByText('No receipts yet')).toHaveCount(0);
  shouldFail = false;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toBeVisible();
});

test('a genuine empty branch history and an unassigned cashier have separate states', async ({
  page,
}) => {
  let branches = [{ id: branchId, name: 'Main branch', archivedAt: null }];
  let listRequests = 0;
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Test cashier',
        role: 'cashier',
        permissions: ['sell'],
        branches,
      },
    }),
  );
  await page.route('**/pos/receipts?**', (route) => {
    listRequests += 1;
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });

  await page.goto('/receipts');
  await expect(page.getByText('No receipts yet')).toBeVisible();
  const requestsWithBranch = listRequests;
  expect(requestsWithBranch).toBeGreaterThan(0);

  branches = [];
  await page.reload();
  await expect(page.getByText('No POS branches assigned')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  expect(listRequests).toBe(requestsWithBranch);
});

test('Arabic receipt history stays RTL and fits a phone viewport', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'ar');
    document.cookie = 'waffarly-locale=ar; Path=/';
  });
  await page.route('**/pos/receipts?**', (route) =>
    route.fulfill({ json: { items: [recentReceipt], nextCursor: null } }),
  );

  await page.goto('/receipts');
  await expect(page.getByRole('heading', { name: 'الإيصالات', exact: true })).toBeVisible();
  await expect(page.getByText('مستندات نقاط البيع')).toBeVisible();
  await expect(page.getByText(/الإيصالات المعروضة/)).toBeVisible();
  await expect(page.getByRole('article', { name: recentReceipt.receiptNumber })).toContainText(
    'ORD-1049',
  );
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  if (process.env.POS_RECEIPTS_CAPTURE === '1') {
    await page.screenshot({
      path: testInfo.outputPath('receipt-history-arabic.png'),
      fullPage: true,
    });
  }
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
