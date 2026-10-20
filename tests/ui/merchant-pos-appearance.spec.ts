import { expect, test } from '@playwright/test';

test('merchant POS accent saves to the merchant and remains after reload', async ({ page }) => {
  let accent = 'orange';
  let revision = 1;
  let updates = 0;

  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({ json: { username: 'owner', merchantName: 'Waffarly', ownerName: 'Owner' } }),
  );
  await page.route('**/owner/pos/registers?**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/owner/inventory/branches?**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/owner/merchant/pos-appearance', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { accent: string; revision: number };
      expect(body.revision).toBe(revision);
      accent = body.accent;
      revision += 1;
      updates += 1;
    }
    await route.fulfill({
      json: { accent, revision, updatedAt: '2026-10-20T08:00:00.000Z' },
    });
  });

  await page.goto('http://127.0.0.1:5274/pos-registers');
  await expect(page.getByRole('heading', { name: 'POS appearance' })).toBeVisible();
  const settings = page.getByTestId('merchant-pos-appearance');
  await expect(settings.getByRole('button', { name: 'orange accent' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await settings.getByRole('button', { name: 'teal accent' }).click();
  await expect(settings.getByRole('status')).toContainText('saved for this merchant');
  await expect(settings.getByRole('button', { name: 'teal accent' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(updates).toBe(1);

  await page.reload();
  await expect(
    page.getByTestId('merchant-pos-appearance').getByRole('button', { name: 'teal accent' }),
  ).toHaveAttribute('aria-pressed', 'true');
});
