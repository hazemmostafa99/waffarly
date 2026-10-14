import { expect, test, type Page } from '@playwright/test';

async function mockSession(page: Page, initiallySignedIn = true) {
  let signedIn = initiallySignedIn;
  const protectedRequests: string[] = [];
  const profile = {
    username: 'owner',
    merchantName: 'Route Test Shop',
    ownerName: 'Mariam',
    ownerMobile: '01012345678',
    contactPhone: '0212345678',
    activity: 'other',
  };
  const handler = async (route: import('@playwright/test').Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/login')) signedIn = true;
    if (path.endsWith('/logout')) signedIn = false;
    if (path.endsWith('/me') && !signedIn) {
      await route.fulfill({ status: 401, json: { message: 'Sign in required.' } });
      return;
    }
    if (path.startsWith('/admin/') || path.startsWith('/owner/catalog/')) {
      protectedRequests.push(path);
    }
    const responses: Record<string, unknown> = {
      '/auth/admin/me': { username: 'admin' },
      '/auth/owner/me': profile,
      '/auth/owner/storefront': {
        templateId: null,
        accentColor: '#315b43',
        logoData: null,
        revision: 1,
        templates: [],
      },
      '/admin/merchants': [
        { ...profile, id: 'shop', name: profile.merchantName, firstMonthActivatedAt: null },
      ],
      '/admin/merchant-applications': [],
      '/admin/templates': [],
      '/admin/plans': [],
      '/admin/activities-modules': { activities: [], modules: [] },
      '/owner/catalog/media': [],
      '/owner/catalog/categories': [],
      '/owner/catalog/products': [],
    };
    await route.fulfill({ json: responses[path] ?? { authenticated: signedIn } });
  };
  await page.route('**/auth/**', handler);
  await page.route('**/admin/**', handler);
  await page.route('**/owner/catalog/**', handler);
  return protectedRequests;
}

async function merchantLink(page: Page, name: string) {
  const link = page
    .getByRole('navigation', { name: 'Merchant navigation' })
    .getByRole('link', { name, exact: true });
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await link.click();
}

test('admin routes survive refresh and browser history and restore business data', async ({
  page,
}) => {
  await mockSession(page);
  await page.goto('http://127.0.0.1:5273/plans');
  await expect(page.locator('h1')).toHaveText('Monthly plans');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Monthly plans');
  const nav = page.getByRole('navigation', { name: 'Platform administration' });
  await expect(nav.getByRole('link', { name: 'Businesses Onboarding' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
  await nav.getByRole('link', { name: 'Businesses Onboarding' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5273/');
  await expect(page.getByRole('heading', { name: 'Route Test Shop' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Monthly plans');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Route Test Shop' })).toBeVisible();
});

test('merchant routes keep owner settings and use browser history', async ({ page }) => {
  await mockSession(page);
  await page.goto('http://127.0.0.1:5274/settings');
  await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Route Test Shop' })).toBeVisible();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Settings');
  await merchantLink(page, 'Products');
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  await expect(page.locator('h1')).toHaveText('Products');
  await expect(page.locator('.merchant-nav-item.active')).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
  await page.goForward();
  await expect(page.locator('h1')).toHaveText('Products');
});

for (const [port, path, heading] of [
  [5273, '/plans', 'Monthly plans'],
  [5274, '/settings', 'Settings'],
] as const) {
  test(`${port} protects deep links, returns after login, and signs out`, async ({ page }) => {
    const protectedRequests = await mockSession(page, false);
    await page.goto(`http://127.0.0.1:${port}${path}`);
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/login`);
    expect(protectedRequests).toEqual([]);
    await page.getByLabel('Username', { exact: true }).fill('owner');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:${port}${path}`);
    await expect(page.locator('h1')).toHaveText(heading);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/login`);
    await page.goto(`http://127.0.0.1:${port}${path}`);
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/login`);
  });
}

test('every merchant section has a direct URL', async ({ page }) => {
  await mockSession(page);
  for (const [path, heading] of [
    ['/', 'Welcome, Mariam! 👋'],
    ['/orders', 'Orders'],
    ['/products', 'Products'],
    ['/categories', 'Categories'],
    ['/media', 'Media Library'],
    ['/customers', 'Customers'],
    ['/discounts', 'Discounts'],
    ['/branches', 'Branches'],
    ['/settings', 'Settings'],
  ]) {
    await page.goto(`http://127.0.0.1:5274${path}`);
    await expect(page.locator('h1')).toHaveText(heading!);
    await expect(page.locator('.merchant-nav-item.active')).toHaveCount(1);
  }
});

test('unknown dashboard URLs recover to the home route', async ({ page }) => {
  await mockSession(page);
  for (const port of [5273, 5274]) {
    await page.goto(`http://127.0.0.1:${port}/missing-page`);
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/`);
    await expect(page.locator('h1')).toBeVisible();
  }
});

test('POS remains accessible without unsupported authentication endpoints', async ({ page }) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/auth/pos/')) authRequests.push(request.url());
  });
  await page.goto('http://127.0.0.1:5275/');
  await expect(page.getByRole('heading', { name: 'POS Workspace' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'POS Workspace' })).toBeVisible();
  expect(authRequests).toEqual([]);
});
