import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const firstReturn = {
  id: '33333333-3333-4333-8333-333333333333',
  returnNumber: 'RET-RETURN001',
  orderId: '44444444-4444-4444-8444-444444444444',
  orderReference: 'ORD-44444444',
  branchId,
  branchName: 'Central Branch',
  fulfillmentType: 'takeaway',
  issuedAt: '2026-10-19T12:00:00.000Z',
  reason: 'Customer returned a damaged item',
  referenceValue: '60.00',
  currency: 'EGP',
  issuedBy: 'Amira Hassan',
  approvedBy: 'Omar Saleh',
  lines: [
    {
      productName: 'Test sandwich',
      variantName: 'Large',
      quantity: 1,
      disposition: 'waste',
      referenceValue: '60.00',
    },
  ],
};
const secondReturn = {
  ...firstReturn,
  id: '55555555-5555-4555-8555-555555555555',
  returnNumber: 'RET-RETURN002',
};

for (const locale of ['en', 'ar']) {
  test(`owner can review paged return and waste records (${locale})`, async ({ page }) => {
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
    const reads: URL[] = [];
    let failNextRead = false;
    await page.route('**/owner/pos/returns/reports**', (route) => {
      const url = new URL(route.request().url());
      reads.push(url);
      if (failNextRead) {
        failNextRead = false;
        return route.fulfill({ status: 500, json: { message: 'Report temporarily unavailable.' } });
      }
      return route.fulfill({
        json: url.searchParams.has('cursor')
          ? { items: [secondReturn], nextCursor: null }
          : { items: [firstReturn], nextCursor: firstReturn.id },
      });
    });

    await page.goto('http://127.0.0.1:5274/pos-item-returns');
    const heading = locale === 'ar' ? 'مرتجعات وهالك نقطة البيع' : 'POS returns & waste';
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('RET-RETURN001', { exact: true })).toBeVisible();
    await expect(page.getByText(/Central Branch/)).toBeVisible();
    await expect(page.getByText('Test sandwich · Large', { exact: true })).toBeVisible();
    await expect(page.getByText('Customer returned a damaged item', { exact: true })).toBeVisible();
    await page.getByText('Omar Saleh', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText('Amira Hassan', { exact: true })).toBeVisible();
    await expect(page.getByText('Omar Saleh', { exact: true })).toBeVisible();
    await expect(page.getByText('60.00 EGP', { exact: true })).toBeVisible();
    await expect(
      page.getByText(locale === 'ar' ? 'ليست مبلغًا مستردًا' : 'Not a refund', { exact: true }),
    ).toBeVisible();
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

    await page
      .getByRole('button', { name: locale === 'ar' ? 'التالي' : 'Next', exact: true })
      .click();
    await expect(page.getByText('RET-RETURN002', { exact: true })).toBeVisible();
    await expect.poll(() => reads.length).toBe(2);
    expect(reads[1]!.searchParams.get('cursor')).toBe(firstReturn.id);
    await page
      .getByRole('button', { name: locale === 'ar' ? 'السابق' : 'Previous', exact: true })
      .click();
    await expect(page.getByText('RET-RETURN001', { exact: true })).toBeVisible();

    await page
      .getByRole('button', { name: locale === 'ar' ? 'تحديث' : 'Refresh', exact: true })
      .click();
    await expect.poll(() => reads.length).toBe(4);
    expect(reads[3]!.searchParams.has('cursor')).toBe(false);

    failNextRead = true;
    await page
      .getByRole('button', { name: locale === 'ar' ? 'تحديث' : 'Refresh', exact: true })
      .click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('RET-RETURN001', { exact: true })).toHaveCount(0);
    await expect.poll(() => reads.length).toBe(5);
  });
}

test('failed lazy report download shows a recoverable reload action', async ({ page }) => {
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
  await page.route('**/owner/pos/returns/reports**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  let chunkRequests = 0;
  let blockChunk = true;
  await page.route('**/assets/ItemReturnReportsPage-*.js', (route) => {
    chunkRequests += 1;
    return blockChunk ? route.abort() : route.continue();
  });

  await page.goto('http://127.0.0.1:5274/pos-item-returns');
  await expect(
    page.getByRole('alert').getByRole('heading', { name: 'This page could not be loaded' }),
  ).toBeVisible();
  blockChunk = false;
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'POS returns & waste' })).toBeVisible();
  expect(chunkRequests).toBeGreaterThanOrEqual(2);
});
