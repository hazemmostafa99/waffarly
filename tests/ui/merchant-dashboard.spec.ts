import { expect, test } from '@playwright/test';

const sampleOrders = [
  ['ORD-10027', 'Sarah Ahmed', '01010000001', '10000.00', 'pickup', 'Sandwich'],
  ['ORD-10028', 'Mona Ali', '01010000002', '5000.00', 'delivery', 'Coffee'],
  ['ORD-10029', 'Omar Samy', '01010000003', '4000.00', 'pickup', 'Waffle'],
  ['ORD-10030', 'Nour Adel', '01010000004', '3000.00', 'delivery', 'Cake'],
  ['ORD-10031', 'Laila Hassan', '01010000005', '2320.50', 'pickup', 'Tea'],
].map(([id, customerName, customerPhone, total, fulfillmentType, productName], index) => ({
  id,
  status: 'pending',
  customerName,
  customerPhone,
  fulfillmentType,
  deliveryAddress: null,
  currency: 'EGP',
  total,
  createdAt: new Date(Date.now() - index * 60_000).toISOString(),
  lines: [
    {
      id: `line-${index + 1}`,
      productName,
      variantName: null,
      variantAttributes: [],
      basePrice: total,
      modifierTotal: '0.00',
      quantity: 1,
      unitPrice: total,
      lineTotal: total,
      selections: [],
    },
  ],
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'ahmed',
        merchantName: 'Waffarly',
        ownerName: 'أحمد علي',
        ownerMobile: '01012345678',
        contactPhone: '0212345678',
        activity: 'restaurant',
      },
    }),
  );
  await page.route('**/owner/catalog/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/owner/orders', (route) => route.fulfill({ json: sampleOrders }));
});

test('Arabic dashboard matches the reference and stays within the viewport', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'ar'));
  await page.goto('http://127.0.0.1:5274/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.merchant-content')).toHaveCSS('direction', 'rtl');
  await expect(page.getByRole('heading', { name: 'مرحباً أحمد!' })).toBeVisible();
  await expect(page.locator('.dashboard-stat')).toHaveCount(4);
  await expect(page.locator('.dashboard-stat').first()).toContainText('EGP 24,320.50');
  await expect(page.locator('.dashboard-order-table tbody tr')).toHaveCount(5);
  await expect(page.locator('.dashboard-branches h2')).toBeVisible();
  await expect(page.locator('.dashboard-bestsellers h2')).toBeVisible();
  await expect(page.locator('.dashboard-quick-actions h2')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  const sidebar = page.locator('.merchant-sidebar');
  if (testInfo.project.name === 'desktop') {
    const sidebarBox = await sidebar.boundingBox();
    const contentBox = await page.locator('.merchant-content').boundingBox();
    expect(sidebarBox!.x).toBeGreaterThan(contentBox!.x);
    const ordersBox = await page.locator('.dashboard-orders').boundingBox();
    const salesBox = await page.locator('.dashboard-sales').boundingBox();
    expect(ordersBox!.x).toBeGreaterThan(salesBox!.x);
    await page.setViewportSize({ width: 970, height: 742 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(970);
  }
  await page.screenshot({
    path: testInfo.outputPath('dashboard-reference-arabic.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'تغيير اللغة' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Latest Orders' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
});

test('dashboard search, chart periods, utilities, and quick actions work', async ({ page }) => {
  await page.goto('http://127.0.0.1:5274/');
  const search = page.getByRole('textbox', { name: 'Search catalog' });
  await search.fill('10027');
  await expect(page.locator('.dashboard-order-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.dashboard-order-table')).toContainText('Sarah Ahmed');
  await search.fill('no matching customer');
  await expect(page.getByText('No matching orders.')).toBeVisible();
  await search.fill('');
  await expect(page.locator('.dashboard-order-table tbody tr')).toHaveCount(5);
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('monthly');
  await expect(page.locator('.dashboard-chart')).toContainText('Week 1');
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('weekly');
  await expect(page.locator('.dashboard-chart')).toContainText('Sat');
  const currentPoints = await page.locator('.dashboard-chart polyline').getAttribute('points');
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('monthly');
  await expect(page.locator('.dashboard-stat').first()).toContainText('EGP 24,320.50');
  await expect(page.locator('.dashboard-chart polyline')).not.toHaveAttribute(
    'points',
    currentPoints!,
  );
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No new notifications.');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Need a hand?');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  await expect(
    page.getByRole('heading', { name: 'Products', level: 1, exact: true }),
  ).toBeVisible();
});
