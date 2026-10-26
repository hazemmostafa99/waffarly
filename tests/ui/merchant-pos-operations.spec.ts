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

for (const locale of ['en', 'ar']) {
  test(`owner can review POS operations and filter its bounded query (${locale})`, async ({
    page,
  }) => {
    await prepareOwner(page, locale);
    const reads: URL[] = [];
    await page.route('**/owner/pos/reports/operations**', (route) => {
      reads.push(new URL(route.request().url()));
      const branch = new URL(route.request().url()).searchParams.get('branchId');
      return route.fulfill({ json: { ...report, branchId: branch } });
    });

    await page.goto('http://127.0.0.1:5274/pos-operations');
    const heading = locale === 'ar' ? 'تشغيل نقطة البيع' : 'POS operations';
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('115.00 EGP', { exact: true })).toBeVisible();
    await expect(page.getByText('25.00 EGP', { exact: true })).toBeVisible();
    await expect(page.getByText('120.00 EGP', { exact: true })).toBeVisible();
    await expect(page.getByText('117.50 EGP', { exact: true }).first()).toBeVisible();
    const activity = page.getByRole('table');
    await expect(activity).toContainText('Sam Lee');
    await expect(activity).toContainText(
      locale === 'ar' ? 'نشاط غير منسوب' : 'Unattributed activity',
    );
    await expect(activity).toContainText('75.00 EGP');
    await expect(activity).toContainText('30.00 EGP');
    await expect(page.getByText('50.00 EGP', { exact: true })).toBeVisible();
    await expect(page.getByText(locale === 'ar' ? '5 د' : '5 min', { exact: true })).toBeVisible();
    await expect(
      page.getByText(locale === 'ar' ? '15 د' : '15 min', { exact: true }),
    ).toBeVisible();
    await expect.poll(() => reads.length).toBe(1);
    expect(reads[0]!.searchParams.has('from')).toBe(true);
    expect(reads[0]!.searchParams.has('to')).toBe(true);
    expect(reads[0]!.searchParams.has('merchantId')).toBe(false);
    expect(
      Date.parse(reads[0]!.searchParams.get('to')!) -
        Date.parse(reads[0]!.searchParams.get('from')!),
    ).toBeLessThanOrEqual(93 * 24 * 60 * 60 * 1000);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );

    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: locale === 'ar' ? 'تنزيل CSV' : 'Download CSV' })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pos-operations-2026-10-01-2026-10-20.csv');
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('2026-10-01T00:00:00.000Z');
    expect(csv).toContain('2026-10-20T12:00:00.000Z');
    expect(csv).toContain('"115.00"');
    expect(csv).toContain('"117.50"');
    expect(csv).toContain('"50.00"');
    expect(csv).toContain('"30.00"');
    expect(csv).toContain('"Sam Lee"');
    expect(csv).toContain('"75.00"');
    expect(csv).toContain(locale === 'ar' ? 'نشاط الكاشيرين' : 'Cashier activity');
    expect(csv).not.toContain('employeeId');
    expect(csv).toContain(locale === 'ar' ? 'قيمة الطلبات' : 'Order value');
    expect(csv).not.toContain('merchantId');
    expect(csv).not.toContain('customer');

    const branchFilter = page.getByRole('combobox', {
      name: locale === 'ar' ? 'تصفية حسب الفرع' : 'Filter by branch',
    });
    await branchFilter.focus();
    await page.getByRole('option', { name: 'Central Branch' }).click();
    await expect.poll(() => reads.length).toBe(2);
    expect(reads[1]!.searchParams.get('branchId')).toBe(branchId);

    const fromInput = page.getByLabel(locale === 'ar' ? 'من (UTC)' : 'From (UTC)');
    await fromInput.fill('2026-06-01T00:00');
    await expect(page.getByRole('alert')).toContainText(locale === 'ar' ? '٩٣' : '93');
    expect(reads).toHaveLength(2);
    await expect(page.getByText('115.00 EGP', { exact: true })).toHaveCount(0);

    await fromInput.fill('2026-10-01T00:00');
    await expect(page.getByText('115.00 EGP', { exact: true })).toBeVisible();
    await expect.poll(() => reads.length).toBe(3);
    expect(reads[2]!.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
    await page.getByRole('button', { name: locale === 'ar' ? 'تحديث' : 'Refresh' }).click();
    await expect.poll(() => reads.length).toBe(4);
  });
}

test('failed POS operations report clears stale data and can be retried', async ({ page }) => {
  await prepareOwner(page);
  let calls = 0;
  await page.route('**/owner/pos/reports/operations**', (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 500, json: { message: 'Report temporarily unavailable.' } })
      : route.fulfill({ json: report });
  });
  await page.goto('http://127.0.0.1:5274/pos-operations');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  await expect(page.getByText('115.00 EGP', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('115.00 EGP', { exact: true })).toBeVisible();
  expect(calls).toBe(2);
});
