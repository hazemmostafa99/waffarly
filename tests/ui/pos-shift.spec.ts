import { expect, test, type Page } from '@playwright/test';
import type { PosShiftLiveSummary } from '@waffarly/contracts';

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

const reconciliation = {
  shiftId: openShift.id,
  branchId,
  registerId,
  registerName: openShift.registerName,
  currency: 'EGP',
  unsettledCheckCount: 0,
  unsettledBalance: '0.00',
  manualMovements: [],
};

async function openCashManagementPage(
  page: Page,
  options: { unsettledCheckCount?: number; pendingDeliveryCount?: number } = {},
) {
  let activeShift: typeof openShift | null = openShift;
  let latestClose: Record<string, unknown> | null = null;
  let expectedCash = 1550.5;
  let currentReconciliation: PosShiftLiveSummary = {
    ...reconciliation,
    unsettledCheckCount: options.unsettledCheckCount ?? 0,
    unsettledBalance: options.unsettledCheckCount ? '85.00' : '0.00',
    pendingDeliveryCount: options.pendingDeliveryCount ?? 0,
    pendingDeliveryBalance: options.pendingDeliveryCount ? '180.00' : '0.00',
  };
  const movementRequests: Array<Record<string, unknown>> = [];
  const closeRequests: Array<Record<string, unknown>> = [];

  await page.route('**/pos/cash/**', (route) =>
    route.fulfill({
      json: {
        items: route.request().url().includes('/safes')
          ? [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', branchId, name: 'Main safe' }]
          : [],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Sarah Ahmed',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
  await page.route('**/pos/registers**', (route) =>
    route.fulfill({ json: [{ id: registerId, branchId, name: 'Front register' }] }),
  );
  await page.route('**/pos/shifts/current**', (route) => route.fulfill({ json: activeShift }));
  await page.route('**/pos/shifts/delivery-handover-recipients**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            username: 'manager',
            displayName: 'Branch manager',
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/pos/shifts/${openShift.id}/reconciliation`, (route) =>
    route.fulfill({ json: currentReconciliation }),
  );
  await page.route('**/pos/shifts/latest-close**', (route) => route.fulfill({ json: latestClose }));
  await page.route(`**/pos/shifts/${openShift.id}/close-preview`, async (route) => {
    const body = route.request().postDataJSON() as {
      countedCash: string;
      reason?: string;
      deliveryHandover?: { recipientUsername: string };
    };
    const hasVariance = Number(body.countedCash) !== expectedCash;
    await route.fulfill({
      json: {
        unsettledCheckCount: currentReconciliation.unsettledCheckCount,
        requiresReason: hasVariance && !body.reason,
        requiresSupervisorApproval: hasVariance || (options.pendingDeliveryCount ?? 0) > 0,
        pendingDeliveryCount: options.pendingDeliveryCount ?? 0,
        requiresDeliveryHandover: (options.pendingDeliveryCount ?? 0) > 0 && !body.deliveryHandover,
      },
    });
  });
  await page.route(`**/pos/shifts/${openShift.id}/cash-movements`, async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    movementRequests.push(body);
    const amount = Number(body.amount);
    expectedCash += body.kind === 'cash_in' ? amount : -amount;
    const movement = {
      id: '77777777-7777-4777-8777-777777777777',
      requestId: body.requestId,
      kind: body.kind,
      amount: body.amount,
      dropReference: typeof body.dropReference === 'string' ? body.dropReference : null,
      reason: body.reason,
      createdAt: '2026-10-19T12:00:00.000Z',
      operatorName: 'Sarah Ahmed',
      approvedByName: body.approval ? 'Supervisor' : null,
    };
    currentReconciliation = {
      ...currentReconciliation,
      manualMovements: [...currentReconciliation.manualMovements, movement],
    };
    await route.fulfill({
      json: { shiftId: openShift.id, reconciliation: currentReconciliation, movement },
    });
  });
  await page.route(`**/pos/shifts/${openShift.id}/close`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    closeRequests.push(body);
    const counted = Number(body.countedCash);
    const expected = expectedCash;
    const report = {
      ...currentReconciliation,
      openingFloat: '1250.50',
      cashSales: '300.00',
      cashRefunds: '0.00',
      cashIn: '0.00',
      cashOut: '0.00',
      cashDrop: '0.00',
      expectedCash: expected.toFixed(2),
      terminalSales: '125.00',
      terminalRefunds: '0.00',
      id: '88888888-8888-4888-8888-888888888888',
      requestId: body.requestId,
      closedAt: '2026-10-19T16:00:00.000Z',
      countedCash: Number(body.countedCash).toFixed(2),
      variance: (counted - expected).toFixed(2),
      operatorName: 'Sarah Ahmed',
      approvedByName: body.approval ? 'Supervisor' : null,
      reason: typeof body.reason === 'string' ? body.reason : null,
    };
    latestClose = report;
    activeShift = null;
    await route.fulfill({ json: report });
  });

  await page.goto('/shift');
  await expect(page.getByRole('heading', { name: 'Open register shift' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Close register shift' })).toBeVisible();
  return { movementRequests, closeRequests };
}

async function openShiftPage(page: Page, options: ShiftPageOptions = {}) {
  const branches = options.branches ?? [{ id: branchId, name: 'Main branch', archivedAt: null }];
  const registers = options.registers ?? [{ id: registerId, branchId, name: 'Front register' }];
  let failRegisters = options.failRegisters ?? false;
  let failCurrentShift = options.failCurrentShift ?? false;
  let registerRequests = 0;
  let currentShiftRequests = 0;

  await page.route('**/pos/cash/**', (route) =>
    route.fulfill({
      json: {
        items: route.request().url().includes('/safes')
          ? [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', branchId, name: 'Main safe' }]
          : [],
        nextCursor: null,
      },
    }),
  );
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

const closedCustody = {
  id: '99999999-9999-4999-8999-999999999999',
  branchId,
  branchName: 'Main branch',
  registerId,
  registerName: 'Front register',
  cashierName: 'Previous cashier',
  status: 'closed',
  openedAt: '2026-10-27T07:00:00Z',
  closedAt: '2026-10-27T15:00:00Z',
  expectedCash: '500.00',
  countedCash: '500.00',
  variance: '0.00',
  remainingCash: '500.00',
  pendingAmount: '0.00',
  receivedInSafe: '0.00',
  carriedForward: '0.00',
  legacyDropAmount: '0.00',
};

test('cashier hands remaining closed-shift custody to a named safe', async ({ page }) => {
  await openCashManagementPage(page);
  let handed = false;
  const commands: Record<string, unknown>[] = [];
  await page.route('**/pos/cash/drawers**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...closedCustody,
            remainingCash: handed ? '0.00' : '500.00',
            pendingAmount: handed ? '500.00' : '0.00',
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/pos/cash/shifts/${closedCustody.id}/transfers`, (route) => {
    commands.push(route.request().postDataJSON() as Record<string, unknown>);
    handed = true;
    return route.fulfill({ json: { id: 'new-transfer' } });
  });
  await page.reload();
  const custody = page.getByRole('region', { name: 'Cash custody after shift close', exact: true });
  await custody.getByRole('button', { name: 'Transfer to safe', exact: true }).click();
  await custody.getByLabel('Receiving safe').selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await custody.getByLabel('Handoff reference').fill('AFTER-CLOSE-1');
  await custody.getByLabel('Reason', { exact: true }).fill('End of shift handoff');
  await custody.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toMatchObject({
    safeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    amount: '500.00',
    reference: 'AFTER-CLOSE-1',
  });
  await expect(custody.getByRole('button', { name: 'Transfer to safe', exact: true })).toHaveCount(
    0,
  );
  await expect(custody).toContainText('Awaiting safe receipt');
});

test('next cashier explicitly accepts previous-shift float when opening', async ({ page }) => {
  await openShiftPage(page);
  const commands: Record<string, unknown>[] = [];
  await page.route('**/pos/cash/carryover**', (route) =>
    route.fulfill({ json: { items: [closedCustody], nextCursor: null } }),
  );
  await page.route('**/pos/shifts/open', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    commands.push(body);
    return route.fulfill({
      json: { ...openShift, openRequestId: body.requestId, openingFloat: body.openingFloat },
    });
  });
  await page.reload();
  await page.getByLabel('Opening cash source').selectOption(closedCustody.id);
  await page.getByLabel('Opening cash float (EGP)').fill('500.00');
  await page
    .getByRole('checkbox', {
      name: 'I physically received and counted the opening amount from this previous shift.',
    })
    .check();
  await page.getByRole('button', { name: 'Open shift', exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toMatchObject({
    sourceShiftId: closedCustody.id,
    openingFloat: '500.00',
    registerId,
  });
});

test('rejected saved delivery handover unlocks the recipient without losing the cash count', async ({
  page,
}) => {
  const requests = await openCashManagementPage(page, { pendingDeliveryCount: 1 });
  const rejectedRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await page.evaluate(
    ({ merchantId, employeeId, branchId, registerId, shiftId, requestId }) => {
      const key = Object.keys(localStorage).find(
        (key) =>
          key.startsWith('waffarly:pos:workspace:v1:') &&
          key.includes(merchantId) &&
          key.includes(employeeId),
      );
      if (!key) throw new Error('Expected cashier workspace');
      const data = JSON.parse(localStorage.getItem(key)!);
      data.workspace.pendingShiftClose = {
        branchId,
        registerId,
        shiftId,
        request: {
          requestId,
          countedCash: '1550.50',
          deliveryHandover: { recipientUsername: 'essam' },
        },
      };
      localStorage.setItem(key, JSON.stringify(data));
    },
    {
      merchantId,
      employeeId,
      branchId,
      registerId,
      shiftId: openShift.id,
      requestId: rejectedRequestId,
    },
  );
  await page.route(`**/pos/shifts/${openShift.id}/close`, (route) => {
    const body = route.request().postDataJSON();
    return body.deliveryHandover?.recipientUsername === 'essam'
      ? route.fulfill({
          status: 403,
          json: {
            message: 'Choose a different active cashier or supervisor assigned to this branch.',
          },
        })
      : route.fallback();
  });
  await page.reload();
  const closeForm = page.locator('form').filter({ has: page.getByLabel('Counted cash (EGP)') });
  const recipient = closeForm.getByLabel('Receiving employee username');
  await expect(recipient).toBeDisabled();
  await expect(recipient).toHaveValue('essam');
  await closeForm.getByLabel('Supervisor username').fill('manager');
  await closeForm.getByLabel('Supervisor password').fill('local-test-password');
  await closeForm.getByRole('button', { name: 'Retry shift close', exact: true }).click();
  await expect(recipient).toBeEnabled();
  await expect(closeForm.getByLabel('Counted cash (EGP)')).toHaveValue('1550.50');
  await expect(recipient.locator('option')).toHaveCount(2);
  await recipient.selectOption('manager');
  await closeForm.getByLabel('Supervisor password').fill('local-test-password');
  await closeForm.getByRole('button', { name: 'Close shift and save report', exact: true }).click();
  await expect.poll(() => requests.closeRequests.length).toBe(1);
  expect(requests.closeRequests[0]).toMatchObject({
    countedCash: '1550.50',
    deliveryHandover: { recipientUsername: 'manager' },
  });
  expect(requests.closeRequests[0]!.requestId).not.toBe(rejectedRequestId);
  await expect(page.getByRole('heading', { name: 'Last shift close' })).toBeVisible();
});

test('a lost close response preserves the exact delivery handover after reload', async ({
  page,
}) => {
  const requests = await openCashManagementPage(page, { pendingDeliveryCount: 1 });
  const attempts: Record<string, unknown>[] = [];
  await page.route(`**/pos/shifts/${openShift.id}/close`, (route) => {
    attempts.push(route.request().postDataJSON());
    return attempts.length === 1 ? route.abort('failed') : route.fallback();
  });
  let closeForm = page.locator('form').filter({ has: page.getByLabel('Counted cash (EGP)') });
  await closeForm.getByLabel('Counted cash (EGP)').fill('1550.50');
  await closeForm.getByLabel('Receiving employee username').selectOption('manager');
  await closeForm.getByLabel('Supervisor username').fill('manager');
  await closeForm.getByLabel('Supervisor password').fill('local-test-password');
  await closeForm.getByRole('button', { name: 'Close shift and save report', exact: true }).click();
  await expect.poll(() => attempts.length).toBe(1);
  await expect(closeForm.getByLabel('Receiving employee username')).toBeDisabled();
  await page.reload();
  closeForm = page.locator('form').filter({ has: page.getByLabel('Counted cash (EGP)') });
  await expect(closeForm.getByLabel('Receiving employee username')).toHaveValue('manager');
  await expect(closeForm.getByLabel('Counted cash (EGP)')).toHaveValue('1550.50');
  await closeForm.getByLabel('Supervisor username').fill('manager');
  await closeForm.getByLabel('Supervisor password').fill('local-test-password');
  await closeForm.getByRole('button', { name: 'Retry shift close', exact: true }).click();
  await expect.poll(() => requests.closeRequests.length).toBe(1);
  expect(attempts[1]).toEqual(attempts[0]);
});

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
  await page.route('**/pos/cash/**', (route) =>
    route.fulfill({
      json: {
        items: route.request().url().includes('/safes')
          ? [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', branchId, name: 'Main safe' }]
          : [],
        nextCursor: null,
      },
    }),
  );
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

test('blind count hides totals and an unpaid check blocks shift closing', async ({ page }) => {
  const requests = await openCashManagementPage(page, { unsettledCheckCount: 1 });
  const reconciliationCard = page.locator('main');
  await expect(
    page.getByText('Count the cash physically present. Expected cash appears after closing.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blind cash count' })).toHaveCount(0);
  const refreshedStatus = page.waitForRequest(`**/pos/shifts/${openShift.id}/reconciliation`);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await refreshedStatus;
  await expect(reconciliationCard).not.toContainText('1,550.50');
  await expect(page.getByLabel('Counted cash (EGP)')).toHaveValue('');
  await expect(reconciliationCard).toContainText('85.00');
  await expect(page.getByRole('button', { name: 'Close shift and save report' })).toBeDisabled();
  await expect(page.getByText('Shift close is blocked:', { exact: false })).toBeVisible();
  expect(requests.closeRequests).toHaveLength(0);
});

test('cash movement requires supervisor credentials and updates drawer reconciliation once', async ({
  page,
}) => {
  const requests = await openCashManagementPage(page);
  const movementForm = page.locator('form').filter({ has: page.getByLabel('Amount (EGP)') });
  await movementForm.getByLabel('Movement type').selectOption('cash_in');
  await movementForm.getByLabel('Amount (EGP)').fill('25.00');
  await movementForm.getByLabel('Reason', { exact: true }).fill('Change fund top-up');
  await movementForm.getByLabel('Supervisor username').fill('supervisor');
  await movementForm.getByLabel('Supervisor password').fill('local-test-password');
  await movementForm.getByRole('button', { name: 'Record movement' }).click();

  await expect.poll(() => requests.movementRequests.length).toBe(1);
  expect(requests.movementRequests[0]).toMatchObject({
    kind: 'cash_in',
    amount: '25.00',
    reason: 'Change fund top-up',
    approval: { username: 'supervisor', password: 'local-test-password' },
  });
  await expect(page.locator('main')).not.toContainText('1,575.50');
  await page.getByText('Manual cash movements').click();
  await expect(page.getByText(/Change fund top-up/)).toBeVisible();
  await expect(movementForm.getByLabel('Supervisor password')).toHaveValue('');
});

test('cash drop requires a safe reference and is recorded separately from paid-out cash', async ({
  page,
}) => {
  const requests = await openCashManagementPage(page);
  const movementForm = page.locator('form').filter({ has: page.getByLabel('Amount (EGP)') });
  await movementForm.getByLabel('Movement type').selectOption('cash_drop');
  await movementForm
    .getByLabel('Receiving safe')
    .selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await movementForm.getByLabel('Amount (EGP)').fill('200.00');
  await movementForm.getByLabel('Reason', { exact: true }).fill('Mid-shift secure drop');
  await movementForm.getByRole('button', { name: 'Record movement' }).click();
  expect(
    await movementForm
      .getByLabel('Safe bag / drop reference')
      .evaluate((input: HTMLInputElement) => !input.checkValidity()),
  ).toBe(true);
  expect(requests.movementRequests).toHaveLength(0);

  await movementForm.getByLabel('Safe bag / drop reference').fill('SAFE-BAG-1042');
  await movementForm.getByLabel('Supervisor username').fill('supervisor');
  await movementForm.getByLabel('Supervisor password').fill('local-test-password');
  await movementForm.getByRole('button', { name: 'Record movement' }).click();
  await expect.poll(() => requests.movementRequests.length).toBe(1);
  expect(requests.movementRequests[0]).toMatchObject({
    kind: 'cash_drop',
    amount: '200.00',
    reason: 'Mid-shift secure drop',
    dropReference: 'SAFE-BAG-1042',
    safeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  const reconciliationCard = page.locator('main');
  await reconciliationCard.getByText('Manual cash movements').click();
  await expect(reconciliationCard).toContainText('Cash dropped to safe');
  await expect(reconciliationCard).toContainText('SAFE-BAG-1042');
});

test('cashier closes a balanced shift and sees the saved close report', async ({ page }) => {
  const requests = await openCashManagementPage(page);
  await page.getByLabel('Counted cash (EGP)').fill('1550.50');
  await page.getByRole('button', { name: 'Close shift and save report' }).click();

  await expect.poll(() => requests.closeRequests.length).toBe(1);
  expect(requests.closeRequests[0]).toMatchObject({ countedCash: '1550.50' });
  await expect(page.getByRole('heading', { name: 'Last shift close' })).toBeVisible();
  await expect(page.getByText('1,550.50').last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Register shift is open' })).toHaveCount(0);
});

test('cash variance requires a reason and supervisor approval before closing', async ({ page }) => {
  const requests = await openCashManagementPage(page);
  const closeForm = page.locator('form').filter({ has: page.getByLabel('Counted cash (EGP)') });
  await closeForm.getByLabel('Counted cash (EGP)').fill('1500.00');
  await closeForm.getByLabel('Variance reason').fill('Short by 50.50 after recount');
  await closeForm.getByRole('button', { name: 'Close shift and save report' }).click();
  await expect(closeForm.getByLabel('Supervisor username')).toBeVisible();
  await closeForm.getByLabel('Supervisor username').fill('supervisor');
  await closeForm.getByLabel('Supervisor password').fill('local-test-password');
  await closeForm.getByRole('button', { name: 'Close shift and save report' }).click();

  await expect.poll(() => requests.closeRequests.length).toBe(1);
  expect(requests.closeRequests[0]).toMatchObject({
    countedCash: '1500.00',
    reason: 'Short by 50.50 after recount',
    approval: { username: 'supervisor', password: 'local-test-password' },
  });
  await expect(page.getByRole('heading', { name: 'Last shift close' })).toBeVisible();
  await expect(page.getByLabel('Supervisor password')).toHaveCount(0);
});

for (const locale of ['en', 'ar'] as const) {
  test(`blind count preview reveals the reason and supervisor requirements together (${locale})`, async ({
    page,
  }) => {
    const requests = await openCashManagementPage(page);
    if (locale === 'ar') await page.getByRole('button', { name: 'Change language' }).click();
    const labels =
      locale === 'ar'
        ? {
            count: 'النقد المعدود (جنيه)',
            reason: 'سبب الفرق',
            close: 'إغلاق الوردية وحفظ التقرير',
            username: 'اسم مستخدم المشرف',
            password: 'كلمة مرور المشرف',
            reasonError: 'أدخل سبب فرق النقد قبل إغلاق الوردية.',
            approvalError: 'يلزم اعتماد المشرف لفرق النقد.',
            saved: 'آخر إغلاق للوردية',
          }
        : {
            count: 'Counted cash (EGP)',
            reason: 'Variance reason',
            close: 'Close shift and save report',
            username: 'Supervisor username',
            password: 'Supervisor password',
            reasonError: 'Enter a reason for the cash variance before closing.',
            approvalError: 'Supervisor approval is required for a cash variance.',
            saved: 'Last shift close',
          };
    const closeForm = page.locator('form').filter({ has: page.getByLabel(labels.count) });
    await closeForm.getByLabel(labels.count).fill('2500');
    await closeForm.getByRole('button', { name: labels.close }).click();

    await expect(page.getByRole('alert')).toHaveText(labels.reasonError);
    await expect(closeForm.getByLabel(labels.username)).toBeVisible();
    await expect(closeForm.getByLabel(labels.password)).toBeVisible();
    await expect(closeForm.getByLabel(labels.count)).toHaveValue('2500');
    expect(requests.closeRequests).toHaveLength(0);

    await closeForm.getByLabel(labels.reason).fill('Count confirmed after a recount');
    await closeForm.getByRole('button', { name: labels.close }).click();
    await expect(page.getByRole('alert')).toHaveText(labels.approvalError);
    expect(requests.closeRequests).toHaveLength(0);

    await closeForm.getByLabel(labels.username).fill('supervisor');
    await closeForm.getByLabel(labels.password).fill('local-test-password');
    await closeForm.getByRole('button', { name: labels.close }).click();
    await expect(page.getByRole('heading', { name: labels.saved })).toBeVisible();
    expect(requests.closeRequests).toHaveLength(1);
    expect(requests.closeRequests[0]).toMatchObject({
      countedCash: '2500',
      reason: 'Count confirmed after a recount',
      approval: { username: 'supervisor', password: 'local-test-password' },
    });
  });
}
