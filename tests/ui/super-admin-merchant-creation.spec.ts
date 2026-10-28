import { expect, test, type Page } from '@playwright/test';

const password = 'Strong-password_123!';
const merchant = {
  id: 'new-merchant',
  name: 'متجر النيل',
  businessCode: 'NILE01',
  activity: 'restaurant',
  contactPhone: '01156734038',
  ownerName: 'مالك المتجر',
  ownerMobile: '01156734038',
  username: 'nile.owner',
  firstMonthActivatedAt: '2026-10-28T12:00:00Z',
  createdAt: '2026-10-28T12:00:00Z',
  subscriptionStatus: 'active',
};
const plan = {
  id: 'plan-1',
  name: 'Standard',
  monthlyPrice: '300.00',
  currency: 'EGP',
  billingInterval: 'monthly',
  terms: [],
  available: true,
  revision: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

async function mockApi(page: Page, fail = false, status: 'active' | 'pending' = 'active') {
  let created = false;
  const result = {
    ...merchant,
    subscriptionStatus: status,
    firstMonthActivatedAt: status === 'active' ? merchant.firstMonthActivatedAt : null,
  };
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue();
    const pathname = new URL(request.url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith('/auth/admin/me')) data = { username: 'admin' };
    else if (pathname.endsWith('/admin/plans')) data = [plan];
    else if (pathname.endsWith('/admin/merchants') && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body.password).toBe(password);
      expect(body.subscription).toEqual({ planId: plan.id, months: 1 });
      if (fail)
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid credentials.' }),
        });
      created = true;
      data = result;
    } else if (pathname.endsWith('/admin/merchants')) data = created ? [result] : [];
    else if (pathname.endsWith('/admin/subscriptions/dashboard'))
      data = {
        counts: { active: 0, pending: 0, suspended: 0, expired: 0, cancelled: 0, legacy: 0 },
        expiringSoon: 0,
        collected: '0.00',
      };
    else if (pathname.includes('/admin/subscriptions'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not found.' }),
      });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}

async function createBusiness(page: Page) {
  await page.goto('http://127.0.0.1:5273/merchants/new');
  await page.locator('#subscription-plan').selectOption('plan-1');
  await page.locator('#business-name').fill(merchant.name);
  await page.locator('#business-contact').fill(merchant.contactPhone);
  await page.locator('#owner-name').fill(merchant.ownerName);
  await page.locator('#owner-mobile').fill(merchant.ownerMobile);
  await page.locator('#owner-username').fill(merchant.username);
  await page.locator('#owner-password').fill(password);
  await page.locator('form button[type="submit"]').click();
}

for (const locale of ['en', 'ar'] as const) {
  test(`creating a merchant opens a one-time modal (${locale})`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
    await mockApi(page, false, locale === 'ar' ? 'pending' : 'active');
    await createBusiness(page);

    await expect(page).toHaveURL('http://127.0.0.1:5273/merchants');
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(merchant.name);
    await expect(modal).toContainText(merchant.username);
    await expect(modal).toContainText(password);
    await expect(modal).toContainText(merchant.ownerMobile);
    await expect(modal).toContainText(locale === 'ar' ? 'بانتظار التفعيل' : 'Active subscription');
    const values = modal.locator('dd bdi');
    await expect(values.nth(0)).toHaveAttribute('dir', 'auto');
    for (const index of [1, 2, 3]) await expect(values.nth(index)).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('tbody tr').first()).toContainText(merchant.name);
    expect(
      await page.evaluate(() => JSON.stringify([history.state, localStorage, sessionStorage])),
    ).not.toContain(password);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await modal.getByRole('button', { name: locale === 'ar' ? 'تم' : 'Done', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByText(password)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tbody tr').first()).toContainText(merchant.name);

    await createBusiness(page);
    const reopened = page.getByRole('dialog');
    await expect(reopened).toBeVisible();
    if (locale === 'en') {
      await reopened.getByRole('link', { name: 'View business' }).click();
      await expect(page).toHaveURL('http://127.0.0.1:5273/merchants/new-merchant');
    } else {
      await reopened.getByRole('link', { name: 'إدارة الاشتراك' }).click();
      await expect(page).toHaveURL('http://127.0.0.1:5273/subscriptions?merchant=new-merchant');
    }
    await expect(page.getByText(password)).toHaveCount(0);

    await createBusiness(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(password)).toHaveCount(0);

    await createBusiness(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(password)).toHaveCount(0);
  });

  test(`failed creation stays on the form without a modal (${locale})`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
    await mockApi(page, true);
    await createBusiness(page);
    await expect(page).toHaveURL('http://127.0.0.1:5273/merchants/new');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#business-name')).toHaveValue(merchant.name);
  });
}
