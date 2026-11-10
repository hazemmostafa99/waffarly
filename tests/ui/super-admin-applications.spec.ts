import { expect, test } from '@playwright/test';

for (const locale of ['en', 'ar'] as const) {
  test(`application cards open review forms and update after a decision (${locale})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
    const applications = ['first', 'second'].map((id) => ({
      id,
      name: `${id} shop`,
      activity: 'restaurant',
      ownerName: 'Owner',
      contactPhone: '01012345678',
      ownerMobile: '01012345678',
      createdAt: '2026-11-11T10:00:00Z',
      approvedAt: null as string | null,
      rejectedAt: null as string | null,
      priorRejectedApplications: [],
    }));
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/auth/admin/me')) return route.fulfill({ json: { username: 'admin' } });
      if (path.endsWith('/admin/merchant-applications'))
        return route.fulfill({ json: applications });
      if (path.endsWith('/first/approve')) {
        expect(request.postDataJSON()).toEqual({
          username: 'new.owner',
          password: 'Strong-password_123!',
        });
        applications[0]!.approvedAt = '2026-11-11T11:00:00Z';
        return route.fulfill({ json: { id: 'merchant-first' } });
      }
      if (path.endsWith('/second/reject')) {
        expect(request.postDataJSON()).toEqual({ reason: 'Duplicate business' });
        applications[1]!.rejectedAt = '2026-11-11T11:00:00Z';
        return route.fulfill({ json: applications[1] });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:5273/');
    await page.locator('a[href="/applications"]').click();
    await expect(page).toHaveURL('http://127.0.0.1:5273/applications');
    await expect(page.locator('article.application')).toHaveCount(2);
    await page.goBack();
    await page.getByRole('link').filter({ hasText: 'first shop' }).click();
    await expect(page).toHaveURL(/\/applications\?application=first$/);
    await expect(page.getByRole('heading', { name: 'first shop', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'second shop', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (locale === 'ar') {
      await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
    }
    await page.reload();
    await page.locator('input[autocomplete="username"]').fill('new.owner');
    await page.locator('input[autocomplete="new-password"]').fill('Strong-password_123!');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('form').first().locator('button[type="submit"]').click();
    await expect(page.locator('.credential-panel')).toContainText('Strong-password_123!');
    await page.locator('.credential-panel button').click();
    await expect(page.getByText('Strong-password_123!')).toHaveCount(0);
    await page.goto('http://127.0.0.1:5273/merchants');
    await page.getByRole('link').filter({ hasText: 'second shop' }).click();
    await expect(page).toHaveURL(/application=second$/);
    await page.locator('textarea').fill('Duplicate business');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('form').nth(1).locator('button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: 'second shop', exact: true })).toHaveCount(0);
    await page.goto('http://127.0.0.1:5273/');
    await page.locator('a[href="/applications"]').click();
    await expect(page).toHaveURL('http://127.0.0.1:5273/applications');
    await expect(page.locator('article.application')).toHaveCount(0);
  });
}
