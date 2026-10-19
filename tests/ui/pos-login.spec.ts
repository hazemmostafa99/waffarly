import { expect, test, type Page } from '@playwright/test';

const session = {
  id: '22222222-2222-4222-8222-222222222222',
  merchantId: '11111111-1111-4111-8111-111111111111',
  username: 'cashier',
  displayName: 'Cashier Example',
  role: 'cashier',
  permissions: ['sell'],
  branches: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Main branch',
      archivedAt: null,
    },
  ],
};

async function prepareLogin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Sign in is required.' } }),
  );
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
}

test('signs in with the existing cashier credentials and preserves the redirect', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  let authenticated = false;
  let loginPayload: Record<string, unknown> | undefined;
  let completeLogin!: () => void;
  const loginResponse = new Promise<void>((resolve) => {
    completeLogin = resolve;
  });

  await page.route('**/auth/pos/me', (route) =>
    route.fulfill(
      authenticated
        ? { json: session }
        : { status: 401, json: { message: 'Sign in is required.' } },
    ),
  );
  await page.route('**/auth/pos/login', async (route) => {
    loginPayload = route.request().postDataJSON() as Record<string, unknown>;
    await loginResponse;
    authenticated = true;
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/pos/orders**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );

  await page.goto('/login');
  await page.getByLabel('Business code', { exact: true }).fill('test-cafe');
  await page.getByLabel('Username', { exact: true }).fill('cashier1');
  await page.getByLabel('Password', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled();
  completeLogin();

  await expect(page).toHaveURL(/\/$/);
  expect(loginPayload).toEqual({
    storefrontSlug: 'test-cafe',
    username: 'cashier1',
    password: 'local-test-password',
  });
});

test('shows invalid credentials without losing the entered business code or username', async ({
  page,
}) => {
  await prepareLogin(page);
  await page.route('**/auth/pos/login', (route) =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials.' } }),
  );

  await page.getByLabel('Business code', { exact: true }).fill('test-cafe');
  await page.getByLabel('Username', { exact: true }).fill('cashier1');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Invalid credentials.');
  await expect(page.getByLabel('Business code', { exact: true })).toHaveValue('test-cafe');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('cashier1');
});

test('allows retry after a failed saved-session check', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  let requests = 0;
  let sessionUnavailable = true;
  await page.route('**/auth/pos/me', (route) => {
    requests += 1;
    return sessionUnavailable
      ? route.fulfill({ status: 503, json: { message: 'Session service is unavailable.' } })
      : route.fulfill({ status: 401, json: { message: 'Sign in is required.' } });
  });

  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('Session service is unavailable.');
  sessionUnavailable = false;
  await page.getByRole('button', { name: 'Retry session check' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('supports light and dark themes, Arabic RTL, and password visibility', async ({ page }) => {
  await prepareLogin(page);

  await page.getByLabel('Business code', { exact: true }).fill('test-cafe');
  await page.getByLabel('Username', { exact: true }).fill('cashier1');
  const theme = page.locator('.pos-theme');
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(theme).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(theme).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', level: 1 })).toBeVisible();
  await expect(page.getByLabel('معرّف المتجر', { exact: true })).toBeVisible();
  await expect(page.getByLabel('معرّف المتجر', { exact: true })).toHaveValue('test-cafe');
  await expect(page.getByLabel('اسم المستخدم', { exact: true })).toHaveValue('cashier1');

  await page.getByLabel('كلمة المرور', { exact: true }).fill('test-password');
  const password = page.getByLabel('كلمة المرور', { exact: true });
  await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
  await expect(password).toHaveAttribute('type', 'password');

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalOverflow).toBe(true);
});

test('requires all credential fields before submitting', async ({ page }) => {
  await prepareLogin(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByLabel('Business code', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Business code', { exact: true })).toHaveAttribute('required', '');
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('required', '');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('required', '');
});

test('single sign-in card fits desktop, tablet and phone in both languages and themes', async ({
  page,
}, testInfo) => {
  await prepareLogin(page);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const language of ['en', 'ar']) {
      if ((await page.locator('html').getAttribute('lang')) !== language) {
        await page.getByRole('button', { name: /Change language|تغيير اللغة/ }).click();
      }
      for (const appearance of ['light', 'dark']) {
        await page.getByRole('combobox').selectOption(appearance);
        const region = page.locator('section[aria-labelledby="pos-login-title"]');
        const bounds = await region.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.width).toBeLessThanOrEqual(440);
        expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        const pageSize = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        }));
        expect(pageSize.width).toBeLessThanOrEqual(pageSize.clientWidth);
        expect(pageSize.height).toBeLessThanOrEqual(pageSize.clientHeight);
        await expect(
          page.getByRole('button', { name: /^(Sign in|تسجيل الدخول)$/ }),
        ).toBeInViewport();
        if (process.env.POS_LOGIN_CAPTURE === '1' && testInfo.project.name === 'desktop') {
          await page.screenshot({
            path: testInfo.outputPath(`login-${viewport.width}-${language}-${appearance}.png`),
          });
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByRole('button', { name: /^(Sign in|تسجيل الدخول)$/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /^(Sign in|تسجيل الدخول)$/ })).toBeInViewport();
});
