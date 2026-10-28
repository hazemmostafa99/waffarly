import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';

const report = {
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-20T12:00:00.000Z',
  branchId: null,
  orders: {
    placedCount: 5,
    cancelledCount: 1,
    acceptedCount: 3,
    completedCount: 2,
    paidCount: 2,
    value: '115.00',
    outstanding: '25.00',
  },
  checks: { settledCount: 4 },
  collections: { cash: '100.00', terminal: '20.00', total: '120.00' },
  refunds: { cash: '2.50', terminal: '0.00', total: '2.50' },
  netCollected: '117.50',
  deliveryCash: { customerCollections: '50.00', drawerReceipts: '30.00' },
  preparation: { acceptedToStartSeconds: 300, startToReadySeconds: 900 },
  cashierActivity: [
    {
      employeeId: '44444444-4444-4444-8444-444444444444',
      employeeName: 'Sam Lee',
      deliveryCashReceived: '30.00',
      ordersOpened: 3,
      cancelledOrders: 1,
      orderValue: '75.00',
      paymentCount: 4,
      collections: { cash: '100.00', terminal: '20.00', total: '120.00' },
      refundCount: 1,
      refunds: { cash: '2.50', terminal: '0.00', total: '2.50' },
      netCollected: '117.50',
    },
    {
      employeeId: null,
      employeeName: null,
      ordersOpened: 2,
      cancelledOrders: 0,
      orderValue: '40.00',
      paymentCount: 0,
      collections: { cash: '0.00', terminal: '0.00', total: '0.00' },
      refundCount: 0,
      refunds: { cash: '0.00', terminal: '0.00', total: '0.00' },
      netCollected: '0.00',
    },
  ],
};

async function prepareOwner(page: import('@playwright/test').Page, locale = 'en') {
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00.000Z'));
  await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'owner',
        merchantId,
        merchantName: 'Restaurant',
        activity: 'restaurant',
        ownerName: 'Owner',
        ownerMobile: '01000000000',
        contactPhone: '01000000000',
        firstMonthActivatedAt: '2026-10-01T00:00:00Z',
      },
    }),
  );
  await page.route('**/owner/inventory/branches*', (route) =>
    route.fulfill({
      json: { items: [{ id: branchId, name: 'Central Branch' }], nextCursor: null },
    }),
  );
}

test.use({ timezoneId: 'Africa/Cairo' });

for (const locale of ['en', 'ar']) {
  test(`owner can review a compact POS report and filter its bounded query (${locale})`, async ({
    page,
  }, testInfo) => {
    await prepareOwner(page, locale);
    const reads: URL[] = [];
    await page.route('**/owner/pos/reports/operations**', (route) => {
      const query = new URL(route.request().url());
      reads.push(query);
      return route.fulfill({
        json: {
          ...report,
          from: query.searchParams.get('from'),
          to: query.searchParams.get('to'),
          branchId: query.searchParams.get('branchId'),
        },
      });
    });
    const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
    const money = (amount: string) => `${amount} ${text('EGP', 'ج.م')}`;

    await page.goto('http://127.0.0.1:5274/pos-operations');
    await expect(
      page.getByRole('heading', { level: 1, name: text('POS operations', 'تشغيل نقطة البيع') }),
    ).toBeVisible();
    const overview = page.locator('.pos-operations-summary');
    await expect(overview.locator('dt')).toHaveCount(4);
    await expect(overview).toContainText(money('117.5'));
    await expect(overview).toContainText(money('25'));
    await expect(overview).toContainText(text('15 min', '15 د'));
    await expect(page.getByText(money('115'), { exact: true })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
    await page.screenshot({
      path: testInfo.outputPath(`pos-overview-${locale}.png`),
      fullPage: true,
    });

    // Keyboard navigation follows the visual direction and keeps one selected tab.
    await page
      .getByRole('tab', { name: text('Orders', 'الطلبات'), exact: true })
      .press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight');
    await expect(
      page.getByRole('tab', { name: text('Collections', 'التحصيل'), exact: true }),
    ).toBeFocused();
    const collections = page.getByRole('tabpanel');
    await expect(collections).toContainText(money('120'));
    await expect(collections).toContainText(money('50'));
    await expect(collections).toContainText(money('30'));
    await page.screenshot({
      path: testInfo.outputPath(`pos-collections-${locale}.png`),
      fullPage: true,
    });
    await expect(
      collections.getByText(text('Cash refunds', 'استرداد نقدي'), { exact: true }),
    ).not.toBeVisible();
    await collections.locator('summary').click();
    await expect(
      collections.getByText(text('Cash refunds', 'استرداد نقدي'), { exact: true }),
    ).toBeVisible();
    await expect(collections.locator('.pos-operations-refunds')).toContainText(money('2.5'));

    await page.getByRole('tab', { name: text('Kitchen', 'المطبخ'), exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText(text('5 min', '5 د'));
    await page.getByRole('tab', { name: text('Cashiers', 'الكاشيرين'), exact: true }).click();
    const activity = page.getByRole('table');
    await expect(activity).toContainText('Sam Lee');
    await expect(activity).toContainText(text('Unattributed activity', 'نشاط غير منسوب'));
    await expect(activity).toContainText(money('75'));
    await expect(activity).toContainText(money('30'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );

    await expect.poll(() => reads.length).toBe(1);
    expect(reads[0]!.searchParams.get('from')).toBe('2026-10-26T21:00:00.000Z');
    expect(reads[0]!.searchParams.get('to')).toBe('2026-10-27T21:00:00.000Z');
    expect(reads[0]!.searchParams.has('merchantId')).toBe(false);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: text('Download CSV', 'تنزيل CSV') }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pos-operations-2026-10-26-2026-10-27.csv');
    const csv = await readFile((await download.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    for (const amount of ['115.00', '117.50', '50.00', '30.00', '75.00'])
      expect(csv).toContain(`"${amount}"`);
    expect(csv).toContain('Sam Lee');
    expect(csv).toContain(text('Cashier activity', 'نشاط الكاشيرين'));
    expect(csv).not.toContain('employeeId');
    expect(csv).not.toContain('merchantId');

    const branchFilter = page.getByRole('combobox', {
      name: text('Filter by branch', 'تصفية حسب الفرع'),
    });
    await branchFilter.focus();
    await page.getByRole('option', { name: 'Central Branch' }).click();
    await expect.poll(() => reads.length).toBe(2);
    expect(reads[1]!.searchParams.get('branchId')).toBe(branchId);

    // Editing custom dates never sends partial filters or replaces the applied report.
    await page
      .getByRole('combobox', { name: text('Period', 'الفترة'), exact: true })
      .selectOption('custom');
    await page.getByLabel(text('From', 'من'), { exact: true }).fill('2026-06-01T00:00');
    await page.getByRole('button', { name: text('Apply', 'تطبيق'), exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('93');
    expect(reads).toHaveLength(2);
    await expect(overview).toContainText(money('117.5'));
    await page.getByLabel(text('From', 'من'), { exact: true }).fill('2026-10-01T00:00');
    await page.getByLabel(text('To', 'إلى'), { exact: true }).fill('2026-11-01T00:00');
    await page.getByRole('button', { name: text('Apply', 'تطبيق'), exact: true }).click();
    await expect.poll(() => reads.length).toBe(3);
    // Cairo changes offset during this range; both endpoints must convert separately.
    expect(reads[2]!.searchParams.get('from')).toBe('2026-09-30T21:00:00.000Z');
    expect(reads[2]!.searchParams.get('to')).toBe('2026-10-31T22:00:00.000Z');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: text('Refresh', 'تحديث'), exact: true }).click();
    await expect.poll(() => reads.length).toBe(4);
    await expect(activity).toContainText('Sam Lee');
  });
}

test('period shortcuts use local calendar boundaries', async ({ page }) => {
  await prepareOwner(page);
  const reads: URL[] = [];
  await page.route('**/owner/pos/reports/operations**', (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({ json: report });
  });
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect.poll(() => reads.length).toBe(1);
  for (const [period, from, to] of [
    ['yesterday', '2026-10-25T21:00:00.000Z', '2026-10-26T21:00:00.000Z'],
    ['last7', '2026-10-20T21:00:00.000Z', '2026-10-27T21:00:00.000Z'],
    ['month', '2026-09-30T21:00:00.000Z', '2026-10-27T21:00:00.000Z'],
  ]) {
    const previousCount = reads.length;
    await page.getByRole('combobox', { name: 'Period', exact: true }).selectOption(period!);
    await expect.poll(() => reads.length).toBe(previousCount + 1);
    expect(reads.at(-1)!.searchParams.get('from')).toBe(from);
    expect(reads.at(-1)!.searchParams.get('to')).toBe(to);
  }
});

test('today covers the local calendar day when daylight saving skips midnight', async ({
  page,
}) => {
  await prepareOwner(page);
  await page.clock.setFixedTime(new Date('2026-04-24T10:00:00.000Z'));
  const reads: URL[] = [];
  await page.route('**/owner/pos/reports/operations**', (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({ json: report });
  });
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect.poll(() => reads.length).toBe(1);
  expect(reads[0]!.searchParams.get('from')).toBe('2026-04-23T22:00:00.000Z');
  expect(reads[0]!.searchParams.get('to')).toBe('2026-04-24T21:00:00.000Z');
});

test('zero refunds stay compact and missing kitchen data is distinguished from short preparation', async ({
  page,
}) => {
  await prepareOwner(page);
  await page.route('**/owner/pos/reports/operations**', (route) =>
    route.fulfill({
      json: {
        ...report,
        refunds: { cash: '0.00', terminal: '0.00', total: '0.00' },
        orders: { ...report.orders, outstanding: '0.00' },
        preparation: { acceptedToStartSeconds: null, startToReadySeconds: 25 },
        cashierActivity: [],
      },
    }),
  );
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect(page.locator('.pos-operations-summary')).toContainText('Less than a minute');
  await expect(page.locator('.pos-operations-summary .is-warning')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Collections', exact: true }).click();
  const refunds = page.locator('.pos-operations-refunds');
  await expect(refunds.locator('summary')).toContainText('No refunds in this period');
  await expect(refunds.getByText('Cash refunds', { exact: true })).not.toBeVisible();
  await refunds.locator('summary').click();
  await expect(refunds.getByText('Cash refunds', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Kitchen', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('No completed samples');
  await expect(page.getByRole('tabpanel')).toContainText('Less than a minute');
  await page.getByRole('tab', { name: 'Cashiers', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('No cashier activity in this period.');
});

test('failed POS operations refresh clears stale data and can be retried', async ({ page }) => {
  await prepareOwner(page);
  let calls = 0;
  await page.route('**/owner/pos/reports/operations**', (route) => {
    calls += 1;
    return calls === 2
      ? route.fulfill({ status: 500, json: { message: 'Report temporarily unavailable.' } })
      : route.fulfill({ json: report });
  });
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect(page.locator('.pos-operations-summary')).toContainText('117.5 EGP');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  await expect(page.locator('.pos-operations-summary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.pos-operations-summary')).toContainText('117.5 EGP');
  expect(calls).toBe(3);
});

test('POS sidebar links stay grouped and accessible on navigation', async ({ page }, testInfo) => {
  await prepareOwner(page);
  await page.route('**/owner/pos/reports/operations**', (route) => route.fulfill({ json: report }));
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect(page.locator('.pos-operations-summary')).toBeVisible();
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const group = page.locator('.merchant-pos-navigation');
  await expect(group).toHaveAttribute('open', '');
  await expect(group.getByRole('link', { name: 'POS Registers', exact: true })).toBeVisible();
  await expect(group.getByRole('link', { name: 'POS Operations', exact: true })).toBeVisible();
  await group.locator('summary').click();
  await expect(group.getByRole('link', { name: 'POS Operations', exact: true })).not.toBeVisible();
  await group.locator('summary').press('Enter');
  await expect(group.getByRole('link', { name: 'POS Operations', exact: true })).toBeVisible();
});
