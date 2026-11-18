import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const courierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

for (const locale of ['en', 'ar'] as const) {
  test(`owner sees courier performance per dispatch attempt (${locale})`, async ({ page }) => {
    const ar = locale === 'ar';
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
    await page.route('**/owner/catalog/**', (route) => route.fulfill({ json: [] }));
    await page.route('**/owner/inventory/branches**', (route) =>
      route.fulfill({ json: { items: [], nextCursor: null } }),
    );
    await page.route('**/owner/delivery-couriers**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/performance')) {
        return route.fulfill({
          json: {
            periodStart: '2026-10-18T00:00:00.000Z',
            generatedAt: '2026-11-17T00:00:00.000Z',
            items: [
              {
                courierId,
                courierName: 'Ahmed Courier',
                active: true,
                attemptCount: 4,
                deliveredCount: 3,
                failedCount: 1,
                activeAttemptCount: 0,
                successRate: 75,
                averageDeliveryMinutes: 23.5,
              },
            ],
          },
        });
      }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });

    await page.goto('http://127.0.0.1:5274/delivery-couriers');
    await expect(
      page.getByRole('heading', {
        name: ar ? 'أداء الطيارين · آخر ٣٠ يومًا' : 'Courier performance · last 30 days',
      }),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: ar ? 'أداء الطيارين' : 'Courier performance' }))
      .toBeVisible();
    await expect(page.getByText('Ahmed Courier', { exact: true })).toBeVisible();
    await expect(page.getByText('75%', { exact: true })).toBeVisible();
    await expect(page.getByText(ar ? '23.5 دقيقة' : '23.5 min', { exact: true })).toBeVisible();
  });
}
