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

for (const locale of ['en', 'ar']) {
  test(`owner can review bounded shift close reports (${locale})`, async ({ page }) => {
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
    const reads: URL[] = [];
    await page.route('**/owner/pos/shifts/reports**', (route) => {
      reads.push(new URL(route.request().url()));
      return route.fulfill({ json: { items: [report], nextCursor: null } });
    });

    await page.goto('http://127.0.0.1:5274/pos-shift-reports');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Front Counter', { exact: true })).toBeVisible();
    await expect(page.getByText('Central Branch', { exact: true })).toBeVisible();
    await expect(
      page.getByText(`${locale === 'ar' ? 'المتوقع' : 'Expected'}: 1775.00 EGP`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${locale === 'ar' ? 'الفرق' : 'Variance'}: -5.00 EGP`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${locale === 'ar' ? 'وُرّد للخزنة' : 'Dropped to safe'}: 75.00 EGP`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Sara Adel', { exact: true })).toBeVisible();
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
