import { expect, test, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';

const openShift = {
  id: '55555555-5555-4555-8555-555555555555',
  branchId,
  registerId,
  registerName: 'Front register',
  openedByEmployeeId: employeeId,
  openedByName: 'Sarah Ahmed',
  openRequestId: '66666666-6666-4666-8666-666666666666',
  openingFloat: '1250.50',
  currency: 'EGP',
  openedAt: '2026-10-17T08:00:00.000Z',
  status: 'open',
};

type ShiftPageOptions = {
  branches?: Array<{ id: string; name: string; archivedAt: null }>;
  registers?: Array<{ id: string; branchId: string; name: string }>;
  shift?: typeof openShift | null;
  failRegisters?: boolean;
  failCurrentShift?: boolean;
};

async function openShiftPage(page: Page, options: ShiftPageOptions = {}) {
  const branches = options.branches ?? [{ id: branchId, name: 'Main branch', archivedAt: null }];
  const registers = options.registers ?? [{ id: registerId, branchId, name: 'Front register' }];
  let failRegisters = options.failRegisters ?? false;
  let failCurrentShift = options.failCurrentShift ?? false;
  let registerRequests = 0;
  let currentShiftRequests = 0;

  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Sarah Ahmed',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches,
      },
    }),
  );
  await page.route('**/pos/registers**', (route) => {
    registerRequests += 1;
    return failRegisters
      ? route.fulfill({ status: 503, json: { message: 'Temporary register lookup failure' } })
      : route.fulfill({ json: registers });
  });
  await page.route('**/pos/shifts/current**', (route) => {
    currentShiftRequests += 1;
    return failCurrentShift
      ? route.fulfill({ status: 503, json: { message: 'Temporary shift lookup failure' } })
      : route.fulfill({ json: options.shift ?? null });
  });

  await page.goto('/shift');
  await expect(page.getByRole('heading', { name: 'Open register shift' })).toBeVisible();
  return {
    recoverRegisters: () => {
      failRegisters = false;
    },
    recoverCurrentShift: () => {
      failCurrentShift = false;
    },
    getRegisterRequests: () => registerRequests,
    getCurrentShiftRequests: () => currentShiftRequests,
  };
}

test('new shift form makes branch, register and opening float easy to scan', async ({ page }) => {
  await openShiftPage(page);

  const shiftRegion = page.getByRole('region', { name: 'Open register shift' });
  await expect(shiftRegion.getByRole('combobox').nth(0)).toHaveValue(branchId);
  await expect(shiftRegion.getByRole('combobox').nth(1)).toHaveValue(registerId);
  await expect(page.getByRole('heading', { name: 'Start a new shift' })).toBeVisible();
  await expect(page.getByLabel('Opening cash float (EGP)')).toHaveValue('');
  await page.getByLabel('Opening cash float (EGP)').fill('250.50');
  await expect(page.getByLabel('Opening cash float (EGP)')).toHaveValue('250.50');
  await expect(page.getByRole('button', { name: 'Open shift' })).toBeEnabled();
});

test('open shift shows register attribution and opening float in both themes', async ({ page }) => {
  await openShiftPage(page, { shift: openShift });

  const shiftCard = page.getByRole('article');
  await expect(shiftCard).toContainText('Register shift is open');
  await expect(shiftCard).toContainText('Front register');
  await expect(shiftCard).toContainText('Main branch');
  await expect(shiftCard).toContainText('Sarah Ahmed');
  await expect(shiftCard).toContainText('1,250.50');
  await expect(shiftCard).toContainText('Operators share this register shift');
  await expect(shiftCard).not.toHaveClass(/emerald/);

  const shiftRegion = page.getByRole('region', { name: 'Open register shift' });
  await expect(shiftRegion).toContainText(
    'Review the selected register and opening cash, or start a new shift.',
  );
  const topPadding = await shiftRegion.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingTop),
  );
  expect(topPadding).toBeGreaterThanOrEqual(28);

  const workspace = page.locator('.pos-theme');
  await expect(workspace).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Theme').selectOption('light');
  await expect(workspace).toHaveAttribute('data-theme', 'light');

  const dimensions = await shiftRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test('missing branch assignment has its own actionable empty state', async ({ page }) => {
  let registerRequests = 0;
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Sarah Ahmed',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [],
      },
    }),
  );
  await page.route('**/pos/registers**', (route) => {
    registerRequests += 1;
    return route.fulfill({ json: [] });
  });

  await page.goto('/shift');
  await expect(
    page.getByRole('heading', { name: 'No active branches are assigned to this account.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Ask the merchant owner to assign you to an active POS branch.'),
  ).toBeVisible();
  expect(registerRequests).toBe(0);
});

test('empty register list is distinct from missing branch assignment', async ({ page }) => {
  await openShiftPage(page, { registers: [] });

  await expect(
    page.getByRole('heading', { name: 'No active registers at this branch.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Ask the merchant owner to create a POS register before opening a shift.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No active branches are assigned to this account.' }),
  ).toHaveCount(0);
});

test('retry recovers the current shift query instead of retrying only the register list', async ({
  page,
}) => {
  const shiftPage = await openShiftPage(page, { failCurrentShift: true, shift: openShift });

  await expect(page.getByRole('alert')).toContainText('Temporary shift lookup failure');
  await expect(
    page.getByRole('heading', { name: 'Could not verify whether a shift is already open.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start a new shift' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open shift' })).toHaveCount(0);
  const requestCountBeforeRetry = shiftPage.getCurrentShiftRequests();
  shiftPage.recoverCurrentShift();
  await page.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByRole('article')).toContainText('Register shift is open');
  expect(shiftPage.getCurrentShiftRequests()).toBeGreaterThan(requestCountBeforeRetry);
});

test('register lookup errors are not shown as an empty branch and recover on retry', async ({
  page,
}) => {
  const shiftPage = await openShiftPage(page, { failRegisters: true });

  await expect(page.getByRole('alert')).toContainText('Temporary register lookup failure');
  await expect(
    page.getByRole('heading', { name: 'Could not verify register availability.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No active registers at this branch.' }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Start a new shift' })).toHaveCount(0);

  const requestCountBeforeRetry = shiftPage.getRegisterRequests();
  shiftPage.recoverRegisters();
  await page.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByRole('heading', { name: 'Start a new shift' })).toBeVisible();
  expect(shiftPage.getRegisterRequests()).toBeGreaterThan(requestCountBeforeRetry);
});

test('Arabic open-shift screen follows RTL and hides unreadable saved operator names', async ({
  page,
}) => {
  await openShiftPage(page, { shift: { ...openShift, openedByName: '????? ?????' } });
  await page.getByRole('button', { name: 'Change language' }).click();

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'فتح وردية الكاشير' })).toBeVisible();
  await expect(page.getByRole('article')).toContainText('اسم الكاشير غير متاح');
  await expect(page.getByRole('article')).toContainText('عهدة الكاشير الافتتاحية');
  const dimensions = await page
    .getByRole('region', { name: 'فتح وردية الكاشير' })
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
