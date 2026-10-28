import { expect, test } from '@playwright/test';
import type {
  MonthlyPlanSummary,
  SubscriptionCommand,
  SubscriptionDetail,
  SubscriptionQuote,
} from '@waffarly/contracts';

const merchantId = '11111111-1111-4111-8111-111111111111';
const planId = '22222222-2222-4222-8222-222222222222';
const plan: MonthlyPlanSummary = {
  id: planId,
  name: 'Business plan',
  monthlyPrice: '250.00',
  currency: 'EGP',
  billingInterval: 'monthly',
  description: '',
  available: true,
  revision: 1,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
  terms: [
    { months: 3, price: '600.00' },
    { months: 6, price: '1000.00' },
    { months: 12, price: '1800.00' },
    { months: 24, price: '3000.00' },
  ],
};

test('creates independent duration prices and shows them in the plan catalog', async ({
  page,
}, testInfo) => {
  let saved: Record<string, unknown> | undefined;
  let plans: MonthlyPlanSummary[] = [];
  await page.route('**/auth/admin/me', (route) => route.fulfill({ json: { username: 'admin' } }));
  await page.route('**/admin/plans', async (route) => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      plans = [{ ...plan, ...saved } as MonthlyPlanSummary];
      await route.fulfill({ status: 201, json: plans[0] });
    } else await route.fulfill({ json: plans });
  });
  await page.goto('http://127.0.0.1:5283/plans/new');
  await page.getByLabel('Plan name', { exact: true }).fill('Independent prices');
  await page.getByLabel('Monthly price').fill('250.00');
  for (const [months, price] of [
    [3, '600.00'],
    [6, '1000.00'],
    [12, '1800.00'],
    [24, '3000.00'],
  ] as const)
    await page.getByLabel(`${months} months (EGP)`, { exact: true }).fill(price);
  await page.getByRole('button', { name: 'Create plan', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Independent prices', exact: true }),
  ).toBeVisible();
  expect(saved?.terms).toEqual(plan.terms);
  expect(saved?.monthlyPrice).toBe('250.00');
  await page.screenshot({ path: testInfo.outputPath('duration-prices.png'), fullPage: true });
});

test('reviews collection before activation and supports suspension, resumption and cancellation', async ({
  page,
}, testInfo) => {
  let state: SubscriptionDetail = {
    merchantId,
    merchantName: 'Subscription test shop',
    status: 'pending',
    revision: 1,
    cancelAtEnd: false,
    endsAt: null,
    assignedPlanId: null,
    assignedMonths: null,
    currentPeriod: null,
    periods: [],
    events: [],
    nextEventCursor: null,
    nextPeriodCursor: null,
  };
  const posted: SubscriptionCommand[] = [];
  await page.route('**/auth/admin/me', (route) => route.fulfill({ json: { username: 'admin' } }));
  await page.route('**/admin/plans', (route) => route.fulfill({ json: [plan] }));
  await page.route('**/admin/subscriptions**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/dashboard'))
      return route.fulfill({
        json: {
          counts: {
            pending: state.status === 'pending' ? 1 : 0,
            active: state.status === 'active' ? 1 : 0,
            suspended: state.status === 'suspended' ? 1 : 0,
            expired: 0,
            cancelled: state.status === 'cancelled' ? 1 : 0,
            legacy: 0,
          },
          expiringSoon: 0,
          collected: posted.some((p) => p.action === 'activate') ? '1000.00' : '0.00',
        },
      });
    if (url.pathname.endsWith('/quote')) {
      const body = route.request().postDataJSON();
      const quote: SubscriptionQuote = {
        action: body.action,
        subscriptionRevision: state.revision,
        planId,
        planName: plan.name,
        planRevision: 1,
        months: body.months,
        price: '1000.00',
        credit: '0.00',
        due: '1000.00',
        startsAt: '2026-10-28T10:00:00Z',
        endsAt: '2027-04-28T09:00:00Z',
      };
      return route.fulfill({ json: quote });
    }
    if (url.pathname.endsWith('/actions')) {
      const body = route.request().postDataJSON() as SubscriptionCommand;
      posted.push(body);
      state = { ...state, revision: state.revision + 1 };
      if (body.action === 'activate') {
        const period = {
          id: 'period-one',
          planId,
          planName: plan.name,
          months: 6 as const,
          price: '1000.00',
          collected: '1000.00',
          credit: '0.00',
          startsAt: '2026-10-28T10:00:00Z',
          endsAt: '2027-04-28T09:00:00Z',
          coverageEndsAt: '2027-04-28T09:00:00Z',
        };
        state = {
          ...state,
          status: 'active',
          currentPeriod: period,
          periods: [period],
          endsAt: period.endsAt,
        };
      }
      if (body.action === 'suspend') state.status = 'suspended';
      if (body.action === 'resume') state.status = 'active';
      if (body.action === 'cancel-at-end') state.cancelAtEnd = true;
      if (body.action === 'cancel') {
        state.status = 'cancelled';
        state.currentPeriod = null;
        state.cancelAtEnd = false;
        state.endsAt = '2026-10-28T10:00:00Z';
        state.periods = state.periods.map((p) => ({
          ...p,
          coverageEndsAt: '2026-10-28T10:00:00Z',
        }));
      }
      state.events = [
        {
          id: `event-${state.revision}`,
          action: body.action,
          administrator: 'admin',
          reason: body.reason,
          createdAt: '2026-10-28T10:00:00Z',
          collected: body.expectedDue ?? '0.00',
        },
        ...state.events,
      ];
      return route.fulfill({ json: state });
    }
    if (url.pathname.includes('/history/'))
      return route.fulfill({
        json: {
          items: url.pathname.endsWith('/periods') ? state.periods : state.events,
          nextCursor: null,
        },
      });
    if (url.pathname === `/admin/subscriptions/${merchantId}`)
      return route.fulfill({ json: state });
    return route.fulfill({ json: { items: [state], nextCursor: null } });
  });
  await page.goto(`http://127.0.0.1:5283/subscriptions?merchant=${merchantId}`);
  const editor = page.getByRole('region', { name: 'Manage subscription', exact: true });
  await editor.getByRole('combobox', { name: 'Action', exact: true }).selectOption('activate');
  await editor.getByRole('combobox', { name: 'Plan', exact: true }).selectOption(planId);
  await editor.getByRole('radio', { name: '6 months', exact: true }).check();
  await editor.getByLabel('Reason / collection reference').fill('External receipt 123');
  await expect(
    editor.getByRole('button', { name: 'Activate subscription', exact: true }),
  ).toHaveCount(0);
  await editor.getByRole('button', { name: 'Review price and dates', exact: true }).click();
  await expect(editor.getByRole('complementary', { name: 'Review and confirm' })).toContainText(
    '1,000.00',
  );
  await expect(
    editor.getByRole('button', { name: 'Activate subscription', exact: true }),
  ).toBeDisabled();
  await editor.getByLabel('I confirm the displayed amount was collected outside Waffarly.').check();
  await editor.getByRole('button', { name: 'Activate subscription', exact: true }).click();
  await expect(editor.getByRole('status')).toHaveText('Subscription updated.');
  expect(posted[0]).toMatchObject({
    action: 'activate',
    months: 6,
    planId,
    expectedDue: '1000.00',
    externalCollectionConfirmed: true,
    revision: 1,
    planRevision: 1,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  for (const [action, label] of [
    ['suspend', 'Suspend subscription'],
    ['resume', 'Resume subscription'],
    ['cancel-at-end', 'Cancel at period end'],
    ['cancel', 'Cancel immediately'],
  ] as const) {
    await editor.getByRole('combobox', { name: 'Action', exact: true }).selectOption(action);
    await editor.getByLabel('Reason / collection reference').fill(`Test ${action}`);
    await editor.getByRole('button', { name: label, exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Subscription updated.');
  }
  expect(posted.map((p) => p.action)).toEqual([
    'activate',
    'suspend',
    'resume',
    'cancel-at-end',
    'cancel',
  ]);
  await expect(editor.getByText('Cancelled subscription', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('subscription-management.png'),
    fullPage: true,
  });
});

test('supports Arabic labels and right-to-left duration editing', async ({ page }, testInfo) => {
  await page.route('**/auth/admin/me', (route) => route.fulfill({ json: { username: 'admin' } }));
  await page.route('**/admin/plans', (route) => route.fulfill({ json: [plan] }));
  await page.goto('http://127.0.0.1:5283/plans/new');
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('أسعار مدد الاشتراك', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '6 شهر (جنيه مصري)', exact: true }).fill('1000.00');
  await expect(page.getByRole('heading', { name: 'إنشاء الباقة', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('arabic-duration-editor.png'),
    fullPage: true,
  });
});

test('Arabic workspace prefills the assigned plan and resets collection review when duration changes', async ({
  page,
}, testInfo) => {
  const state: SubscriptionDetail = {
    merchantId,
    merchantName: 'مطعم التجربة',
    status: 'legacy',
    revision: 1,
    cancelAtEnd: false,
    endsAt: null,
    assignedPlanId: planId,
    assignedMonths: 3,
    currentPeriod: null,
    periods: [],
    events: [],
    nextPeriodCursor: null,
    nextEventCursor: null,
  };
  await page.route('**/auth/admin/me', (route) => route.fulfill({ json: { username: 'admin' } }));
  await page.route('**/admin/plans', (route) =>
    route.fulfill({ json: [{ ...plan, name: 'باقة المطعم الأساسية' }] }),
  );
  await page.route('**/admin/subscriptions**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/dashboard'))
      return route.fulfill({
        json: {
          counts: { active: 0, pending: 0, legacy: 1, expired: 0, suspended: 0, cancelled: 0 },
          expiringSoon: 0,
          collected: '0.00',
        },
      });
    if (path.endsWith('/quote')) {
      const input = route.request().postDataJSON();
      return route.fulfill({
        json: {
          action: input.action,
          subscriptionRevision: 1,
          planId,
          planName: 'باقة المطعم الأساسية',
          planRevision: 1,
          months: input.months,
          price: input.months === 3 ? '600.00' : '1000.00',
          credit: '0.00',
          due: input.months === 3 ? '600.00' : '1000.00',
          startsAt: '2026-10-28T10:00:00Z',
          endsAt: '2027-04-28T09:00:00Z',
        },
      });
    }
    if (path.includes('/history/')) return route.fulfill({ json: { items: [], nextCursor: null } });
    return route.fulfill({ json: state });
  });
  await page.goto(`http://127.0.0.1:5283/subscriptions?merchant=${merchantId}`);
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  const editor = page.getByRole('region', { name: 'إدارة الاشتراك', exact: true });
  await expect(editor.getByRole('combobox', { name: 'الإجراء', exact: true })).toHaveValue(
    'activate',
  );
  await expect(editor.getByRole('combobox', { name: 'الباقة', exact: true })).toHaveValue(planId);
  await expect(editor.getByRole('radio', { name: '3 شهر', exact: true })).toBeChecked();
  await editor.getByLabel('السبب / مرجع التحصيل', { exact: true }).fill('تحويل تجريبي 123');
  await editor.getByRole('button', { name: 'مراجعة السعر والتواريخ', exact: true }).click();
  const checkbox = editor.getByRole('checkbox', {
    name: 'أؤكد تحصيل المبلغ المعروض خارج وفرلي.',
    exact: true,
  });
  await checkbox.check();
  await expect(editor.getByRole('button', { name: 'تفعيل الاشتراك', exact: true })).toBeEnabled();
  await editor.getByRole('radio', { name: '6 شهر', exact: true }).check();
  await expect(checkbox).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'تفعيل الاشتراك', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'مراجعة السعر والتواريخ', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  const control = await checkbox.boundingBox();
  const copy = await editor.locator('.subscription-check span').boundingBox();
  expect(control).not.toBeNull();
  expect(copy).not.toBeNull();
  expect(Math.abs(control!.x - (copy!.x + copy!.width))).toBeLessThanOrEqual(12);
  expect(control!.width).toBeLessThanOrEqual(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('arabic-subscription-review.png'),
    fullPage: true,
  });
});

test('compact overview filters accounts and opens a focused workspace with a return path', async ({
  page,
}, testInfo) => {
  const state: SubscriptionDetail = {
    merchantId,
    merchantName: 'Overview test shop',
    status: 'legacy',
    revision: 1,
    cancelAtEnd: false,
    endsAt: null,
    assignedPlanId: planId,
    assignedMonths: 3,
    currentPeriod: null,
    periods: [],
    events: [],
    nextPeriodCursor: null,
    nextEventCursor: null,
  };
  const requestedStatuses: (string | null)[] = [];
  await page.route('**/auth/admin/me', (route) => route.fulfill({ json: { username: 'admin' } }));
  await page.route('**/admin/plans', (route) => route.fulfill({ json: [plan] }));
  await page.route('**/admin/subscriptions**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/dashboard'))
      return route.fulfill({
        json: {
          counts: { active: 8, pending: 2, legacy: 1, expired: 3, suspended: 1, cancelled: 0 },
          expiringSoon: 2,
          collected: '12500.00',
        },
      });
    if (url.pathname.includes('/history/'))
      return route.fulfill({ json: { items: [], nextCursor: null } });
    if (url.pathname.endsWith(merchantId)) return route.fulfill({ json: state });
    requestedStatuses.push(url.searchParams.get('status'));
    return route.fulfill({ json: { items: [state], nextCursor: null } });
  });
  await page.goto('http://127.0.0.1:5283/subscriptions');
  await expect(page.getByRole('heading', { name: 'All subscriptions', exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Filter by subscription access' })
    .getByRole('button', { name: 'Needs subscription review 1', exact: true })
    .click();
  await expect.poll(() => requestedStatuses.includes('legacy')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('subscription-overview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Manage subscription', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Manage subscription' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to subscriptions', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page).toHaveURL(/status=legacy/);
});
