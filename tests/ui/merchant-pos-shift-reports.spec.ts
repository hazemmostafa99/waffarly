import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';

const report = {
  id: '22222222-2222-4222-8222-222222222222',
  shiftId: '33333333-3333-4333-8333-333333333333',
  branchId: '44444444-4444-4444-8444-444444444444',
  branchName: 'Central Branch',
  registerName: 'Front Counter',
  openedAt: '2026-10-19T08:00:00.000Z',
  closedAt: '2026-10-19T16:00:00.000Z',
  openedByName: 'Amira Hassan',
  operatorName: 'Omar Saleh',
  approvedByName: 'Sara Adel',
  currency: 'EGP',
  openingFloat: '500.00',
  cashSales: '1250.00',
  deliveryCashReceived: '75.00',
  deliveryHandover: {
    recipientEmployeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    recipientName: 'Hassan Followup',
    approvedByName: 'Delivery Supervisor',
    deliveries: [
      {
        orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        courierName: 'Courier Ali',
        status: 'out_for_delivery',
        customerDue: '300.00',
        courierCashHeld: '0.00',
      },
    ],
  },
  cashRefunds: '50.00',
  cashIn: '100.00',
  cashOut: '25.00',
  cashDrop: '75.00',
  expectedCash: '1775.00',
  countedCash: '1770.00',
  variance: '-5.00',
  terminalSales: '800.00',
  terminalRefunds: '0.00',
  reason: 'Small change discrepancy',
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
  await page.route('**/owner/inventory/branches**', (route) => {
    const branch = { id: report.branchId, name: 'Central Branch' };
    return route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith(branch.id)
        ? branch
        : { items: [branch], nextCursor: null },
    });
  });
}

for (const locale of ['en', 'ar']) {
  test(`owner can review bounded shift close reports (${locale})`, async ({ page }) => {
    await prepareOwner(page, locale);
    const reads: URL[] = [];
    await page.route('**/owner/pos/shifts/reports**', (route) => {
      reads.push(new URL(route.request().url()));
      return route.fulfill({ json: { items: [report], nextCursor: null } });
    });

    await page.goto('http://127.0.0.1:5274/pos-shift-reports');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const viewDetails = page.getByRole('button', {
      name: locale === 'ar' ? 'عرض التفاصيل' : 'View details',
      exact: true,
    });
    await expect(viewDetails).toBeVisible();
    await viewDetails.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Central Branch', { exact: true })).toBeVisible();
    await expect(
      dialog
        .getByText('Expected cash', { exact: true })
        .or(dialog.getByText('النقد المتوقع', { exact: true }))
        .locator('..'),
    ).toContainText('1775.00 EGP');
    await expect(
      dialog
        .getByText('Counted cash', { exact: true })
        .or(dialog.getByText('النقد المعدود', { exact: true }))
        .locator('..'),
    ).toContainText('1770.00 EGP');
    await expect(dialog.getByText('-5.00 EGP', { exact: true })).toBeVisible();
    await expect(
      dialog
        .getByText('Dropped to safe', { exact: true })
        .or(dialog.getByText('توريد للخزنة', { exact: true }))
        .locator('..'),
    ).toContainText('75.00 EGP');
    await expect(dialog.getByText('Sara Adel', { exact: true })).toBeVisible();
    await expect(
      dialog
        .getByText('Courier cash received', { exact: true })
        .or(dialog.getByText('نقد مستلم من الطيار', { exact: true }))
        .locator('..'),
    ).toContainText('75.00 EGP');
    await expect(dialog.getByText('Courier Ali', { exact: false })).toBeVisible();
    await expect(dialog.getByText('Delivery Supervisor', { exact: false })).toBeVisible();
    await page
      .getByRole('button', {
        name: locale === 'ar' ? 'إغلاق تفاصيل التقرير' : 'Close report details',
      })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(viewDetails).toBeFocused();
    await expect.poll(() => reads.length).toBe(1);
    expect(reads[0]!.searchParams.get('limit')).toBe('25');
    expect(reads[0]!.searchParams.has('from')).toBe(true);
    expect(reads[0]!.searchParams.has('to')).toBe(true);
    expect(reads[0]!.searchParams.has('merchantId')).toBe(false);
    const rangeMs =
      Date.parse(reads[0]!.searchParams.get('to')!) -
      Date.parse(reads[0]!.searchParams.get('from')!);
    expect(rangeMs).toBeGreaterThan(0);
    expect(rangeMs).toBeLessThanOrEqual(93 * 24 * 60 * 60 * 1000);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );

    await page.getByRole('button', { name: locale === 'ar' ? 'تحديث' : 'Refresh' }).click();
    await expect.poll(() => reads.length).toBe(2);
  });
}

test('custom shift filters apply together, reset pagination and survive reload', async ({
  page,
}) => {
  await prepareOwner(page);
  const reads: URL[] = [];
  await page.route('**/owner/pos/shifts/reports**', (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({ json: { items: [report], nextCursor: report.id } });
  });
  await page.goto('http://127.0.0.1:5274/pos-shift-reports');
  await expect(page.getByRole('button', { name: 'View details', exact: true })).toBeVisible();
  const period = page.getByRole('combobox', { name: 'Report period' });
  await period.selectOption('custom');
  await page.getByLabel('From date', { exact: true }).fill('2026-10-01');
  await page.getByLabel('To date', { exact: true }).fill('2026-10-20');
  expect(reads).toHaveLength(1);
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect.poll(() => reads.length).toBe(2);
  await expect(page).toHaveURL(/period=custom/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => reads.length).toBe(3);
  expect(reads[2]!.searchParams.get('cursor')).toBe(report.id);
  await period.selectOption('last7');
  await expect.poll(() => reads.length).toBe(4);
  expect(reads[3]!.searchParams.has('cursor')).toBe(false);
  await period.selectOption('custom');
  await page.getByLabel('From date', { exact: true }).fill('2026-06-01');
  await page.getByLabel('To date', { exact: true }).fill('2026-06-30');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect.poll(() => reads.length).toBe(5);
  await page.reload();
  await expect.poll(() => reads.length).toBe(6);
  await expect(page.getByLabel('From date', { exact: true })).toHaveValue('2026-06-01');
  await expect(page.getByLabel('To date', { exact: true })).toHaveValue('2026-06-30');
  await page.getByLabel('From date', { exact: true }).fill('2026-05-01');
  await page.getByLabel('To date', { exact: true }).fill('2026-10-26');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect(page.getByRole('alert')).toContainText('93');
  expect(reads).toHaveLength(6);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect.poll(() => reads.length).toBe(7);
  await expect(period).toHaveValue('last30');
  await page.getByRole('combobox', { name: 'Filter by branch' }).focus();
  await page.getByRole('option', { name: 'Central Branch' }).click();
  await expect.poll(() => reads.length).toBe(8);
  expect(reads[7]!.searchParams.get('branchId')).toBe(report.branchId);
});
