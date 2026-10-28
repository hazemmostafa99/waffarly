import { expect, test, type Page } from '@playwright/test';
import type {
  MerchantAccountOverview,
  OwnerSubscriptionHistory,
  SubscriptionStatus,
} from '@waffarly/contracts';

const origin = 'http://127.0.0.1:5274';
const day = 86_400_000;
function sampleAccount(): MerchantAccountOverview {
  const now = Date.now();
  const period = {
    id: '22222222-2222-4222-8222-222222222222',
    planId: '33333333-3333-4333-8333-333333333333',
    planName: 'Growth / باقة النمو',
    months: 3 as const,
    price: '1600.00',
    collected: '1500.00',
    credit: '100.00',
    startsAt: new Date(now - 85 * day).toISOString(),
    endsAt: new Date(now + 5 * day).toISOString(),
    coverageEndsAt: new Date(now + 5 * day).toISOString(),
  };
  return {
    profile: {
      merchantId: '11111111-1111-4111-8111-111111111111',
      merchantName: 'Nile Kitchen / مطبخ النيل',
      activity: 'restaurant',
      username: 'nile.owner',
      ownerName: 'Mariam Ahmed',
      ownerMobile: '01012345678',
      contactPhone: '0212345678',
      storefrontSlug: `nile-kitchen-${'a'.repeat(75)}`,
      logoData: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: null,
      revision: 1,
    },
    subscription: {
      status: 'active',
      currency: 'EGP',
      cancelAtEnd: false,
      assignedPlanName: 'Current catalog name should not replace purchased name',
      assignedMonths: 3,
      currentPeriod: period,
      nextPeriod: null,
      latestPeriod: period,
      coverageEndsAt: period.coverageEndsAt,
      asOf: new Date(now).toISOString(),
    },
  };
}

async function mockAccount(page: Page, account = sampleAccount()) {
  const state = {
    account,
    failLoad: false,
    saveStatus: 200,
    historyCalls: [] as string[],
    writes: [] as Record<string, unknown>[],
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/owner/me')
      return route.fulfill({
        json: {
          ...state.account.profile,
          firstMonthActivatedAt: null,
          subscriptionStatus: state.account.subscription.status,
        },
      });
    if (url.pathname === '/owner/account') {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        state.writes.push(body);
        if (state.saveStatus !== 200)
          return route.fulfill({
            status: state.saveStatus,
            json: {
              message:
                state.saveStatus === 409
                  ? 'Account details have changed. Refresh and try again.'
                  : 'Could not save account.',
            },
          });
        state.account.profile = {
          ...state.account.profile,
          ...body,
          revision: body.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        return route.fulfill({ json: state.account.profile });
      }
      return route.fulfill({
        status: state.failLoad ? 503 : 200,
        json: state.failLoad ? { message: 'Could not load account.' } : state.account,
      });
    }
    if (url.pathname === '/owner/account/subscription/periods') {
      state.historyCalls.push(url.searchParams.get('cursor') ?? '');
      const cursor = '44444444-4444-4444-8444-444444444444';
      const history: OwnerSubscriptionHistory = {
        items: state.account.subscription.latestPeriod
          ? [
              {
                ...state.account.subscription.latestPeriod,
                id: url.searchParams.has('cursor')
                  ? cursor
                  : state.account.subscription.latestPeriod.id,
                planName: url.searchParams.has('cursor')
                  ? 'Older purchased plan'
                  : 'Latest purchased plan',
              },
            ]
          : [],
        nextCursor: url.searchParams.has('cursor') ? null : cursor,
      };
      return route.fulfill({ json: history });
    }
    if (url.pathname === '/auth/owner/storefront')
      return route.fulfill({
        json: {
          merchantId: account.profile.merchantId,
          storefrontSlug: account.profile.storefrontSlug,
          templateId: null,
          templates: [],
          accentColor: '#0f705a',
          logoData: null,
          revision: 0,
        },
      });
    if (url.pathname.startsWith('/owner/catalog/')) return route.fulfill({ json: [] });
    if (url.pathname === '/owner/orders') return route.fulfill({ json: [] });
    return route.continue();
  });
  return state;
}

async function fits(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('account shows purchased billing facts, storefront, WhatsApp and paged history in English and Arabic', async ({
  page,
}, testInfo) => {
  const state = await mockAccount(page);
  await page.goto(`${origin}/account`);
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  const account = page.getByTestId('merchant-account');
  await expect(account).toContainText('Growth / باقة النمو');
  await expect(account).toContainText('1,600.00 EGP');
  await expect(account).toContainText('1,500.00 EGP');
  await expect(account).toContainText('100.00 EGP');
  await expect(account).not.toContainText('Current catalog name should not replace purchased name');
  await expect(
    account.getByRole('link', { name: 'Renew or change plan on WhatsApp' }),
  ).toHaveAttribute('href', 'https://wa.me/201044280822');
  await expect(account.getByRole('link', { name: 'Open store', exact: true })).toHaveAttribute(
    'href',
    `http://localhost:3000/s/${state.account.profile.storefrontSlug}`,
  );
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('account-en.png'), fullPage: true });
  await page.getByRole('button', { name: 'View history', exact: true }).click();
  await expect(account).toContainText('Latest purchased plan');
  expect(state.historyCalls).toEqual(['']);
  await page.getByRole('button', { name: 'Load older periods' }).click();
  await expect(account).toContainText('Older purchased plan');
  expect(state.historyCalls).toEqual(['', '44444444-4444-4444-8444-444444444444']);
  await expect(page.getByRole('button', { name: 'Load older periods' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
  await expect(account).toContainText('1,600.00 ج.م');
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath('account-ar.png'), fullPage: true });
  await page.getByRole('button', { name: 'تعديل البيانات', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'تعديل بيانات الحساب' });
  await expect(dialog.getByLabel('اسم النشاط', { exact: true })).toHaveValue(
    state.account.profile.merchantName,
  );
  await fits(page);
  await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
});

test('copy actions put the actual storefront link and account reference on the clipboard', async ({
  page,
  context,
}) => {
  const state = await mockAccount(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto(`${origin}/account`);
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByText('Copied to clipboard.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `http://localhost:3000/s/${state.account.profile.storefrontSlug}`,
  );
  await page.getByRole('button', { name: 'Copy reference', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    state.account.profile.merchantId,
  );
});

test('profile edits persist, update the header, and survive reload without changing the slug', async ({
  page,
}) => {
  const state = await mockAccount(page);
  const slug = state.account.profile.storefrontSlug;
  await page.goto(`${origin}/account`);
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit account details' });
  await dialog.getByLabel('Business name', { exact: true }).fill('Updated Nile Kitchen');
  await dialog.getByLabel('Owner name', { exact: true }).fill('Updated Owner');
  await dialog.getByLabel('Business phone', { exact: true }).fill('0212340000');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Account details saved.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open my account' })).toHaveAttribute(
    'title',
    'Updated Owner',
  );
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    merchantName: 'Updated Nile Kitchen',
    ownerName: 'Updated Owner',
    contactPhone: '0212340000',
    revision: 1,
  });
  expect(state.writes[0]).not.toHaveProperty('merchantId');
  expect(state.writes[0]).not.toHaveProperty('storefrontSlug');
  await page.reload();
  await expect(page.getByTestId('merchant-account')).toContainText('Updated Nile Kitchen');
  await expect(page.getByTestId('merchant-account')).toContainText(slug);
  await expect(page.getByRole('link', { name: 'Open my account' })).toHaveAttribute(
    'title',
    'Updated Owner',
  );
});

test('save failures keep the draft and conflicts require refreshing before another edit', async ({
  page,
}) => {
  const state = await mockAccount(page);
  state.saveStatus = 503;
  await page.goto(`${origin}/account`);
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Business name', { exact: true }).fill('Unsaved draft');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save account.');
  await expect(dialog.getByLabel('Business name', { exact: true })).toHaveValue('Unsaved draft');
  await expect(page.getByText('Account details saved.', { exact: true })).toHaveCount(0);
  state.saveStatus = 409;
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'These details changed in another session.',
  );
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Refresh account' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('merchant-account')).toContainText(
    state.account.profile.merchantName,
  );
});

test('load errors recover and settings link to the persisted profile', async ({ page }) => {
  const state = await mockAccount(page);
  state.failLoad = true;
  await page.goto(`${origin}/account`);
  await expect(page.getByRole('alert')).toContainText('Could not load account.');
  state.failLoad = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('merchant-account')).toBeVisible();
  await page.goto(`${origin}/settings`);
  await expect(page.getByText('ahmed@waffarly.com')).toHaveCount(0);
  await page.getByRole('link', { name: 'Manage account' }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
});

for (const [status, label] of [
  ['pending', 'Awaiting activation'],
  ['expired', 'Subscription expired'],
  ['suspended', 'Subscription suspended'],
  ['cancelled', 'Subscription cancelled'],
  ['legacy', 'Subscription under review'],
] as const satisfies ReadonlyArray<readonly [SubscriptionStatus, string]>) {
  test(`account handles ${status} without reporting a false active subscription`, async ({
    page,
  }) => {
    const account = sampleAccount();
    account.subscription.status = status;
    if (status === 'pending' || status === 'legacy') {
      account.subscription.currentPeriod = null;
      account.subscription.latestPeriod = null;
      account.subscription.coverageEndsAt = null;
      account.subscription.assignedPlanName = null;
      account.subscription.assignedMonths = null;
    }
    if (status === 'expired' || status === 'cancelled') account.subscription.currentPeriod = null;
    await mockAccount(page, account);
    await page.goto(`${origin}/account`);
    await expect(page.getByTestId('merchant-account')).toContainText(label);
    await expect(page.getByText('Subscription active', { exact: true })).toHaveCount(0);
    const edit = page.getByRole('button', { name: 'Edit details', exact: true });
    if (status === 'legacy') {
      await expect(edit).toBeEnabled();
      await expect(page.getByTestId('merchant-account')).toContainText(
        'no expiry or payment amount has been assumed',
      );
      await expect(page.getByTestId('merchant-account')).not.toContainText('EGP');
    } else await expect(edit).toBeDisabled();
    await fits(page);
  });
}

test('a page left open across expiry refreshes the authoritative subscription state', async ({
  page,
}) => {
  await page.clock.install();
  const account = sampleAccount();
  const end = new Date(Date.now() + 30_000).toISOString();
  account.subscription.currentPeriod!.coverageEndsAt = end;
  account.subscription.currentPeriod!.endsAt = end;
  account.subscription.coverageEndsAt = end;
  const state = await mockAccount(page, account);
  await page.goto(`${origin}/account`);
  await expect(page.getByTestId('merchant-account')).toContainText('Subscription active');
  state.account.subscription.status = 'expired';
  state.account.subscription.currentPeriod = null;
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('merchant-account')).toContainText('Subscription expired');
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeDisabled();
});

test('prepaid renewal and cancellation show the full paid coverage separately from the current period', async ({
  page,
}) => {
  const account = sampleAccount();
  const current = account.subscription.currentPeriod!;
  account.subscription.nextPeriod = {
    ...current,
    id: '55555555-5555-4555-8555-555555555555',
    planName: 'Next annual plan',
    months: 12,
    startsAt: current.coverageEndsAt,
    endsAt: new Date(Date.now() + 370 * day).toISOString(),
    coverageEndsAt: new Date(Date.now() + 370 * day).toISOString(),
  };
  account.subscription.coverageEndsAt = account.subscription.nextPeriod.coverageEndsAt;
  account.subscription.cancelAtEnd = true;
  await mockAccount(page, account);
  await page.goto(`${origin}/account`);
  const view = page.getByTestId('merchant-account');
  await expect(view).toContainText('Prepaid next period');
  await expect(view).toContainText('Next annual plan');
  await expect(view).toContainText('Cancellation is scheduled at the end of paid coverage.');
  await expect(view).not.toContainText('Your subscription ends soon.');
  await fits(page);
});
