import {
  expect,
  test,
  type Page,
  type Request,
  type Response as PlaywrightResponse,
} from '@playwright/test';

const databaseUrl = process.env.DATABASE_URL;

function isReceiptRead(url: string, orderId: string) {
  const path = new URL(url).pathname;
  return path.startsWith('/pos/orders/' + orderId + '/checks/') && path.endsWith('/receipt');
}

function sumEgp(values: string[]): string {
  const cents = values.reduce((sum, value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  }, 0n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

function isCheckPayment(url: string) {
  return /\/pos\/orders\/[^/]+\/checks\/[^/]+\/payments$/.test(new URL(url).pathname);
}

async function settleCashCheckAndReadReceipt(page: Page, orderId: string, amount: string) {
  const paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue(amount);
  const paymentResponse = page.waitForResponse((response) => isCheckPayment(response.url()));
  const receiptResponse = page.waitForResponse((response) =>
    isReceiptRead(response.url(), orderId),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  expect((await paymentResponse).status()).toBe(201);
  expect((await receiptResponse).ok()).toBe(true);
  const receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText(amount);
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
}

async function signInAsEmployee(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Business code', { exact: true }).fill('pos-live-e2e');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/auth/pos/login',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await loginResponse).ok()).toBe(true);
}

async function signOutEmployee(page: Page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('live POS sales cover splits, refunds, Kitchen and payment-gated handover against PostgreSQL', async ({
  page,
}) => {
  if (process.env.CI !== 'true' || !databaseUrl) {
    throw new Error('POS live E2E must run in CI with its disposable PostgreSQL database.');
  }
  if (new URL(databaseUrl).pathname.slice(1) !== 'waffarly_pos_e2e') {
    throw new Error('POS live E2E refuses to use a database other than waffarly_pos_e2e.');
  }

  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('/login');
  const appearanceReads: PlaywrightResponse[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/pos/appearance') appearanceReads.push(response);
  });
  const appearanceReadPromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/pos/appearance',
  );
  await page.getByLabel('Business code', { exact: true }).fill('pos-live-e2e');
  await page.getByLabel('Username', { exact: true }).fill('cashier');
  await page.getByLabel('Password', { exact: true }).fill('pos-live-e2e-only-password');

  const loginResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/auth/pos/login',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await loginResponse).ok()).toBe(true);
  const appearanceRead = await appearanceReadPromise;
  expect(appearanceRead.status()).toBe(200);
  expect(await appearanceRead.json()).toMatchObject({ accent: 'orange', revision: 1 });
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'orange');
  await expect.poll(() => appearanceReads.length).toBe(1);

  await page.goto('/shift');
  await expect(page.getByRole('heading', { name: 'Open register shift' })).toBeVisible();
  await page.getByLabel('Branch', { exact: true }).selectOption({ label: 'Live E2E branch' });
  await page.getByLabel('Register', { exact: true }).selectOption({ label: 'Live E2E register' });
  await page.getByLabel('Opening cash float (EGP)', { exact: true }).fill('100');
  const openedShiftResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/pos/shifts/open',
  );
  await page.getByRole('button', { name: 'Open shift', exact: true }).click();
  expect((await openedShiftResponse).ok()).toBe(true);

  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const takeawayOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const takeawayOrderResponse = await takeawayOrderResponsePromise;
  expect(takeawayOrderResponse.status()).toBe(201);
  const takeawayOrder = (await takeawayOrderResponse.json()) as { id: string };

  let confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  let paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog).toBeVisible();
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('42.50');
  const takeawayReceiptRead = page.waitForResponse((response) =>
    isReceiptRead(response.url(), takeawayOrder.id),
  );
  const takeawayPaymentResponse = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  expect((await takeawayPaymentResponse).status()).toBe(201);
  expect((await takeawayReceiptRead).ok()).toBe(true);
  let receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('42.50');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.reload();
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  const persistedTakeawayReceiptRead = page.waitForResponse((response) =>
    isReceiptRead(response.url(), takeawayOrder.id),
  );
  await confirmedPanel.getByRole('button', { name: /View \/ print receipt/ }).click();
  expect((await persistedTakeawayReceiptRead).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('42.50');
  await receiptDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New order', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dine in', exact: true }).click();
  const tableSelect = page.getByLabel('Table', { exact: true });
  const tableOption = tableSelect.locator('option').filter({ hasText: 'T01' });
  const tableId = await tableOption.getAttribute('value');
  expect(tableId).toBeTruthy();
  await tableSelect.selectOption(tableId!);
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const dineInOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const dineInOrderResponse = await dineInOrderResponsePromise;
  expect(dineInOrderResponse.status()).toBe(201);
  const dineInOrder = (await dineInOrderResponse.json()) as { id: string };
  await expect(page.getByTestId('confirmed-order-panel')).toContainText('Live POS E2E Item');

  await page.goto('/dining');
  await expect(page.getByRole('heading', { name: 'Tables & open sessions' })).toBeVisible();
  const sessions = page.locator('section[aria-labelledby="dining-sessions-title"]');
  const splitButton = sessions.getByRole('button', { name: 'Split check', exact: true });
  await expect(splitButton).toBeVisible();
  await splitButton.click();
  const splitDialog = page.getByRole('dialog', { name: /Split check.*T01/ });
  await splitDialog.getByRole('button', { name: 'Equal', exact: true }).click();
  await splitDialog.getByLabel('Number of checks', { exact: true }).fill('2');
  const splitResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + dineInOrder.id + '/split-checks' &&
      response.request().method() === 'POST',
  );
  await splitDialog.getByRole('button', { name: 'Save split', exact: true }).click();
  expect((await splitResponsePromise).status()).toBe(201);
  await expect(sessions).toContainText('Check 1');
  await expect(sessions).toContainText('Check 2');

  await sessions.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  const chooseCheck = paymentDialog.getByLabel('Choose check', { exact: true });
  const checkOptions = chooseCheck.locator('option');
  await expect(checkOptions).toHaveCount(2);
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('21.25');

  const firstSplitReceiptRead = page.waitForResponse((response) =>
    isReceiptRead(response.url(), dineInOrder.id),
  );
  const firstSplitPaymentResponse = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  expect((await firstSplitPaymentResponse).status()).toBe(201);
  expect((await firstSplitReceiptRead).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('21.25');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();

  const secondCheckId = await checkOptions.nth(1).getAttribute('value');
  expect(secondCheckId).toBeTruthy();
  await chooseCheck.selectOption(secondCheckId!);
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('21.25');
  const secondSplitReceiptRead = page.waitForResponse((response) =>
    isReceiptRead(response.url(), dineInOrder.id),
  );
  const secondSplitPaymentResponse = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  expect((await secondSplitPaymentResponse).status()).toBe(201);
  expect((await secondSplitReceiptRead).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('21.25');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.reload();
  await expect(sessions).toContainText('Check 1');
  await expect(sessions).toContainText('Check 2');
  const paymentStateRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + dineInOrder.id + '/payment-state',
  );
  await sessions.getByRole('button', { name: 'Take payment', exact: true }).click();
  expect((await paymentStateRead).ok()).toBe(true);
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  const persistedChecks = paymentDialog
    .getByLabel('Choose check', { exact: true })
    .locator('option');
  await expect(persistedChecks).toHaveCount(2);
  await expect(persistedChecks.nth(0)).toContainText('Settled');
  await expect(persistedChecks.nth(1)).toContainText('Settled');
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Dine in', exact: true }).click();
  const secondTableSelect = page.getByLabel('Table', { exact: true });
  const secondTableOption = secondTableSelect.locator('option').filter({ hasText: 'T02' });
  const secondTableId = await secondTableOption.getAttribute('value');
  expect(secondTableId).toBeTruthy();
  await secondTableSelect.selectOption(secondTableId!);
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  await page
    .getByRole('button', { name: 'Increase quantity: Live POS E2E Item', exact: true })
    .click();
  const itemSplitOrderPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const itemSplitOrderResponse = await itemSplitOrderPromise;
  expect(itemSplitOrderResponse.status()).toBe(201);
  const itemSplitOrder = (await itemSplitOrderResponse.json()) as {
    id: string;
    fulfillmentType: string;
    tableCode?: string | null;
    total: string;
    lines: Array<{ quantity: number }>;
  };
  expect(itemSplitOrder.fulfillmentType).toBe('dine_in');
  expect(itemSplitOrder.tableCode).toBe('T02');
  expect(itemSplitOrder.total).toBe('85.00');
  expect(itemSplitOrder.lines[0]?.quantity).toBe(2);

  await page.goto('/dining');
  const secondSessions = page.locator('section[aria-labelledby="dining-sessions-title"]');
  const secondTableSession = secondSessions.locator('article').filter({ hasText: 'Table T02' });
  await expect(secondTableSession).toBeVisible();
  await secondTableSession.getByRole('button', { name: 'Split check', exact: true }).click();
  const itemSplitDialog = page.getByRole('dialog', { name: /Split check.*T02/ });
  await itemSplitDialog.getByLabel('Number of checks', { exact: true }).fill('2');
  await itemSplitDialog.getByLabel(/Check 1.*Live POS E2E Item/).fill('1');
  await itemSplitDialog.getByLabel(/Check 2.*Live POS E2E Item/).fill('1');
  const itemSplitResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + itemSplitOrder.id + '/split-checks' &&
      response.request().method() === 'POST',
  );
  await itemSplitDialog.getByRole('button', { name: 'Save split', exact: true }).click();
  const itemSplitResponse = await itemSplitResponsePromise;
  expect(itemSplitResponse.status()).toBe(201);
  const itemSplit = (await itemSplitResponse.json()) as {
    checks: Array<{ amount: string; allocations: Array<{ quantity: number }> }>;
  };
  expect(itemSplit.checks.map((check) => check.amount)).toEqual(['42.50', '42.50']);
  expect(itemSplit.checks.map((check) => check.allocations[0]?.quantity)).toEqual([1, 1]);

  await secondTableSession.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await settleCashCheckAndReadReceipt(page, itemSplitOrder.id, '42.50');
  const itemCheckSelector = paymentDialog.getByLabel('Choose check', { exact: true });
  const itemCheckOptions = itemCheckSelector.locator('option');
  await expect(itemCheckOptions).toHaveCount(2);
  const secondItemCheckId = await itemCheckOptions.nth(1).getAttribute('value');
  expect(secondItemCheckId).toBeTruthy();
  await itemCheckSelector.selectOption(secondItemCheckId!);
  await settleCashCheckAndReadReceipt(page, itemSplitOrder.id, '42.50');
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Delivery', exact: true }).click();
  await page.getByLabel('Customer name', { exact: true }).fill('Live E2E delivery customer');
  await page.getByLabel('Phone number', { exact: true }).fill('01012345678');
  await page.getByLabel('Delivery address', { exact: true }).fill('12 Test Street, Cairo');
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const deliveryOrderPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const deliveryOrderResponse = await deliveryOrderPromise;
  expect(deliveryOrderResponse.status()).toBe(201);
  const deliveryOrder = (await deliveryOrderResponse.json()) as {
    id: string;
    fulfillmentType: string;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    kitchenTicket?: { dispatchMode: string } | null;
  };
  expect(deliveryOrder.fulfillmentType).toBe('delivery');
  expect(deliveryOrder.customerName).toBe('Live E2E delivery customer');
  expect(deliveryOrder.customerPhone).toBe('01012345678');
  expect(deliveryOrder.deliveryAddress).toBe('12 Test Street, Cairo');
  expect(deliveryOrder.kitchenTicket?.dispatchMode).toBe('automatic');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await settleCashCheckAndReadReceipt(page, deliveryOrder.id, '42.50');
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Dine in', exact: true }).click();
  const thirdTableSelect = page.getByLabel('Table', { exact: true });
  const thirdTableOption = thirdTableSelect.locator('option').filter({ hasText: 'T03' });
  const thirdTableId = await thirdTableOption.getAttribute('value');
  expect(thirdTableId).toBeTruthy();
  await thirdTableSelect.selectOption(thirdTableId!);
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const customSplitOrderPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const customSplitOrderResponse = await customSplitOrderPromise;
  expect(customSplitOrderResponse.status()).toBe(201);
  const customSplitOrder = (await customSplitOrderResponse.json()) as {
    id: string;
    fulfillmentType: string;
    tableCode?: string | null;
    total: string;
  };
  expect(customSplitOrder.fulfillmentType).toBe('dine_in');
  expect(customSplitOrder.tableCode).toBe('T03');
  expect(customSplitOrder.total).toBe('42.50');

  await page.goto('/dining');
  const thirdSessions = page.locator('section[aria-labelledby="dining-sessions-title"]');
  const thirdTableSession = thirdSessions.locator('article').filter({ hasText: 'Table T03' });
  await expect(thirdTableSession).toBeVisible();
  await thirdTableSession.getByRole('button', { name: 'Split check', exact: true }).click();
  const customSplitDialog = page.getByRole('dialog', { name: /Split check.*T03/ });
  await customSplitDialog.getByRole('button', { name: 'Custom amounts', exact: true }).click();
  await customSplitDialog.getByLabel(/Check 1.*amount/).fill('20.00');
  await customSplitDialog.getByLabel(/Check 2.*amount/).fill('22.50');
  const customSplitResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + customSplitOrder.id + '/split-checks' &&
      response.request().method() === 'POST',
  );
  await customSplitDialog.getByRole('button', { name: 'Save split', exact: true }).click();
  const customSplitResponse = await customSplitResponsePromise;
  expect(customSplitResponse.status()).toBe(201);
  const customSplit = (await customSplitResponse.json()) as {
    checks: Array<{ amount: string; splitMethod: string }>;
  };
  expect(customSplit.checks.map((check) => check.amount)).toEqual(['20.00', '22.50']);
  expect(customSplit.checks.map((check) => check.splitMethod)).toEqual(['custom', 'custom']);

  await thirdTableSession.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('20.00');
  await paymentDialog.getByLabel('Amount for payment 1').fill('5.00');
  await paymentDialog.getByLabel('Cash received for payment 1').fill('5.00');
  await paymentDialog.getByRole('button', { name: 'Add payment method', exact: true }).click();
  await paymentDialog.getByLabel('Amount for payment 2').fill('15.00');
  const mixedPaymentResponsePromise = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  const mixedReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), customSplitOrder.id),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  const mixedPaymentResponse = await mixedPaymentResponsePromise;
  expect(mixedPaymentResponse.status()).toBe(201);
  const mixedPayment = (await mixedPaymentResponse.json()) as {
    payments: Array<{ method: string; amount: string }>;
  };
  expect(mixedPayment.payments.map(({ method, amount }) => ({ method, amount }))).toEqual([
    { method: 'cash', amount: '5.00' },
    { method: 'terminal', amount: '15.00' },
  ]);
  expect((await mixedReceiptReadPromise).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('20.00');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();

  const customCheckSelector = paymentDialog.getByLabel('Choose check', { exact: true });
  const customCheckOptions = customCheckSelector.locator('option');
  await expect(customCheckOptions).toHaveCount(2);
  const secondCustomCheckId = await customCheckOptions.nth(1).getAttribute('value');
  expect(secondCustomCheckId).toBeTruthy();
  await customCheckSelector.selectOption(secondCustomCheckId!);
  await paymentDialog.getByLabel('Method for payment 1').selectOption('terminal');
  await expect(paymentDialog.getByLabel('Amount for payment 1')).toHaveValue('22.50');
  const terminalPaymentResponsePromise = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  const terminalReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), customSplitOrder.id),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  const terminalPaymentResponse = await terminalPaymentResponsePromise;
  expect(terminalPaymentResponse.status()).toBe(201);
  const terminalPayment = (await terminalPaymentResponse.json()) as {
    payments: Array<{ method: string; amount: string }>;
  };
  expect(terminalPayment.payments.map(({ method, amount }) => ({ method, amount }))).toEqual([
    { method: 'terminal', amount: '22.50' },
  ]);
  expect((await terminalReceiptReadPromise).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('22.50');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Takeaway', exact: true }).click();
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  let firstSaleRequestBody: unknown;
  let committedSaleId = '';
  let dropFirstSaleResponse = true;
  await page.route('**/pos/orders', async (route) => {
    if (dropFirstSaleResponse && route.request().method() === 'POST') {
      dropFirstSaleResponse = false;
      firstSaleRequestBody = route.request().postDataJSON();
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      const committedSale = (await committedResponse.json()) as { id: string };
      committedSaleId = committedSale.id;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved sale', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry saved sale', exact: true })).toBeVisible();
  const retriedSaleRequestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/pos/orders' && request.method() === 'POST',
  );
  const retriedSaleResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Retry saved sale', exact: true }).click();
  const retriedSaleRequest = await retriedSaleRequestPromise;
  expect(retriedSaleRequest.postDataJSON()).toEqual(firstSaleRequestBody);
  const retriedSaleResponse = await retriedSaleResponsePromise;
  expect(retriedSaleResponse.status()).toBe(201);
  const recoveredSale = (await retriedSaleResponse.json()) as { id: string };
  expect(recoveredSale.id).toBe(committedSaleId);
  await page.unroute('**/pos/orders');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  let firstPaymentRequestBody: unknown;
  let committedPaymentId = '';
  let dropFirstPaymentResponse = true;
  const paymentRoute = /\/pos\/orders\/[^/]+\/checks\/[^/]+\/payments$/;
  await page.route(paymentRoute, async (route) => {
    if (dropFirstPaymentResponse && route.request().method() === 'POST') {
      dropFirstPaymentResponse = false;
      firstPaymentRequestBody = route.request().postDataJSON();
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      const committedPayment = (await committedResponse.json()) as {
        payments: Array<{ id: string }>;
      };
      expect(committedPayment.payments).toHaveLength(1);
      committedPaymentId = committedPayment.payments[0]!.id;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  await expect(paymentDialog.getByRole('alert')).toContainText(
    'The payment result is not confirmed.',
  );
  await page.reload();
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(
    paymentDialog.getByRole('button', { name: 'Check saved result', exact: true }),
  ).toBeVisible();
  const retriedPaymentRequestPromise = page.waitForRequest(
    (request) => paymentRoute.test(new URL(request.url()).pathname) && request.method() === 'POST',
  );
  const retriedPaymentResponsePromise = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  const recoveredReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), recoveredSale.id),
  );
  await paymentDialog.getByRole('button', { name: 'Check saved result', exact: true }).click();
  const retriedPaymentRequest = await retriedPaymentRequestPromise;
  expect(retriedPaymentRequest.postDataJSON()).toEqual(firstPaymentRequestBody);
  const retriedPaymentResponse = await retriedPaymentResponsePromise;
  expect(retriedPaymentResponse.status()).toBe(201);
  const recoveredPayment = (await retriedPaymentResponse.json()) as {
    payments: Array<{ id: string; method: string; amount: string }>;
    check: { status: string; paidAmount: string; balanceDue: string };
  };
  expect(recoveredPayment.payments).toEqual([
    expect.objectContaining({ id: committedPaymentId, method: 'cash', amount: '42.50' }),
  ]);
  expect(recoveredPayment.check).toMatchObject({
    status: 'settled',
    paidAmount: '42.50',
    balanceDue: '0.00',
  });
  expect((await recoveredReceiptReadPromise).ok()).toBe(true);
  await page.unroute(paymentRoute);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('42.50');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  const recoveredPaymentStatePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + recoveredSale.id + '/payment-state',
  );
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  const recoveredPaymentStateResponse = await recoveredPaymentStatePromise;
  expect(recoveredPaymentStateResponse.ok()).toBe(true);
  const recoveredPaymentState = (await recoveredPaymentStateResponse.json()) as {
    checks: Array<{ id: string; status: string; payments: Array<{ id: string; amount: string }> }>;
  };
  expect(recoveredPaymentState.checks).toHaveLength(1);
  expect(recoveredPaymentState.checks[0]).toMatchObject({
    status: 'settled',
    payments: [{ id: committedPaymentId, amount: '42.50' }],
  });
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Done' })
    .click();

  await expect(confirmedPanel.getByRole('button', { name: /^Refund/ })).toBeVisible();
  await confirmedPanel.getByRole('button', { name: /^Refund/ }).click();
  let refundDialog = page.getByRole('dialog', { name: 'Refund payment' });
  await refundDialog.getByLabel(/Refund.*cash/i).fill('10.00');
  await refundDialog
    .getByLabel('Refund reason', { exact: true })
    .fill('Live E2E partial cash refund');
  await refundDialog.getByLabel('Supervisor username', { exact: true }).fill('supervisor');
  await refundDialog
    .getByLabel('Supervisor password', { exact: true })
    .fill('pos-live-e2e-only-supervisor-password');
  const refundRoute =
    '/pos/orders/' +
    recoveredSale.id +
    '/checks/' +
    recoveredPaymentState.checks[0]!.id +
    '/refunds';
  let refundWriteAttempts = 0;
  let firstRefundRequestId = '';
  let committedRefundId = '';
  await page.route(new RegExp(refundRoute + '$'), async (route) => {
    if (route.request().method() === 'POST') {
      refundWriteAttempts += 1;
      const requestBody = route.request().postDataJSON() as { requestId: string };
      firstRefundRequestId = requestBody.requestId;
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      const committedRefund = (await committedResponse.json()) as {
        refund: { id: string; requestId: string; amount: string };
      };
      committedRefundId = committedRefund.refund.id;
      expect(committedRefund.refund).toMatchObject({
        requestId: firstRefundRequestId,
        amount: '10.00',
      });
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await refundDialog.getByRole('button', { name: 'Record refund', exact: true }).click();
  await expect(refundDialog.getByRole('status')).toContainText('A refund request is saved.');
  const persistedWorkspace = await page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.getItem(localStorage.key(index) ?? ''),
    ).join('\n'),
  );
  expect(persistedWorkspace).not.toContain('pos-live-e2e-only-supervisor-password');
  const persistedRefundStatePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + recoveredSale.id + '/payment-state',
  );
  await page.reload();
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  const persistedRefundStateResponse = await persistedRefundStatePromise;
  expect(persistedRefundStateResponse.ok()).toBe(true);
  const persistedRefundState = (await persistedRefundStateResponse.json()) as {
    checks: Array<{
      payments: Array<{ amount: string; refundedAmount: string; refundableAmount: string }>;
      refunds: Array<{
        id: string;
        requestId: string;
        amount: string;
        reason: string;
        approvedBy: string | null;
        tenders: Array<{ method: string; amount: string }>;
      }>;
    }>;
  };
  expect(persistedRefundState.checks[0]).toMatchObject({
    payments: [{ amount: '42.50', refundedAmount: '10.00', refundableAmount: '32.50' }],
    refunds: [
      {
        id: committedRefundId,
        requestId: firstRefundRequestId,
        amount: '10.00',
        reason: 'Live E2E partial cash refund',
        approvedBy: 'Live E2E supervisor',
        tenders: [{ method: 'cash', amount: '10.00' }],
      },
    ],
  });
  await confirmedPanel.getByRole('button', { name: /^Refund/ }).click();
  refundDialog = page.getByRole('dialog', { name: 'Refund payment' });
  const refundReceiptListButton = refundDialog.getByRole('button', { name: /View refund receipt/ });
  await expect(refundReceiptListButton).toBeVisible();
  await expect(refundDialog.getByRole('button', { name: 'Retry saved refund' })).toHaveCount(0);
  await refundReceiptListButton.click();
  const refundReceiptDialog = page.getByRole('dialog', { name: 'Refund receipt' });
  await expect(refundReceiptDialog).toContainText('Live E2E supervisor');
  await expect(refundReceiptDialog).toContainText('10.00');
  await expect(refundReceiptDialog).toContainText('Live E2E partial cash refund');
  expect(refundWriteAttempts).toBe(1);
  expect(firstRefundRequestId).toBeTruthy();
  await refundReceiptDialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.unroute(new RegExp(refundRoute + '$'));
  const originalReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), recoveredSale.id),
  );
  await confirmedPanel.getByRole('button', { name: /View \/ print receipt/ }).click();
  expect((await originalReceiptReadPromise).ok()).toBe(true);
  const originalReceiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(originalReceiptDialog).toContainText('42.50');
  await originalReceiptDialog.getByRole('button', { name: 'Done', exact: true }).click();

  let negativeRefundWriteAttempts = 0;
  const countRefundWrite = (request: { url: () => string; method: () => string }) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === refundRoute) {
      negativeRefundWriteAttempts += 1;
    }
  };
  page.on('request', countRefundWrite);
  await confirmedPanel.getByRole('button', { name: /^Refund/ }).click();
  refundDialog = page.getByRole('dialog', { name: 'Refund payment' });
  await refundDialog.getByLabel(/Refund.*cash/i).fill('32.51');
  await refundDialog
    .getByLabel('Refund reason', { exact: true })
    .fill('Over-refund must be blocked');
  await refundDialog.getByLabel('Supervisor username', { exact: true }).fill('supervisor');
  await refundDialog
    .getByLabel('Supervisor password', { exact: true })
    .fill('pos-live-e2e-only-supervisor-password');
  await expect(
    refundDialog.getByRole('button', { name: 'Record refund', exact: true }),
  ).toBeDisabled();
  expect(negativeRefundWriteAttempts).toBe(0);

  await refundDialog.getByLabel(/Refund.*cash/i).fill('1.00');
  await refundDialog.getByLabel('Supervisor password', { exact: true }).fill('incorrect-password');
  const deniedRefundResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === refundRoute && response.request().method() === 'POST',
  );
  const postDenialStatePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + recoveredSale.id + '/payment-state' &&
      response.request().method() === 'GET',
  );
  await refundDialog.getByRole('button', { name: 'Record refund', exact: true }).click();
  expect((await deniedRefundResponsePromise).status()).toBe(401);
  const postDenialStateResponse = await postDenialStatePromise;
  expect(postDenialStateResponse.ok()).toBe(true);
  const postDenialState = (await postDenialStateResponse.json()) as {
    checks: Array<{
      payments: Array<{ refundedAmount: string; refundableAmount: string }>;
      refunds: Array<{ id: string; amount: string }>;
    }>;
  };
  expect(postDenialState.checks[0]).toMatchObject({
    payments: [{ refundedAmount: '10.00', refundableAmount: '32.50' }],
    refunds: [{ id: committedRefundId, amount: '10.00' }],
  });
  expect(negativeRefundWriteAttempts).toBe(1);
  await expect(refundDialog.getByRole('alert')).toContainText(
    'Supervisor approval credentials are invalid.',
  );
  const afterDeniedWorkspace = await page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.getItem(localStorage.key(index) ?? ''),
    ).join('\n'),
  );
  expect(afterDeniedWorkspace).not.toContain('incorrect-password');
  await refundDialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  page.off('request', countRefundWrite);

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Takeaway', exact: true }).click();
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const handoverOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const handoverOrderResponse = await handoverOrderResponsePromise;
  expect(handoverOrderResponse.status()).toBe(201);
  const handoverOrder = (await handoverOrderResponse.json()) as {
    id: string;
    fulfillmentType: string;
    kitchenTicket?: { dispatchMode: string } | null;
  };
  expect(handoverOrder.fulfillmentType).toBe('takeaway');
  expect(handoverOrder.kitchenTicket?.dispatchMode).toBe('automatic');

  await signOutEmployee(page);
  await signInAsEmployee(page, 'manager', 'pos-live-e2e-only-manager-password');
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  let handoverOrderCard = page
    .locator('article')
    .filter({ hasText: '#' + handoverOrder.id.slice(0, 6).toUpperCase() });
  await expect(handoverOrderCard).toBeVisible();
  let firstAcceptRequestBody: unknown;
  let dropFirstAcceptResponse = true;
  const acceptRoute = new RegExp('/pos/orders/' + handoverOrder.id + '/accept$');
  await page.route(acceptRoute, async (route) => {
    if (dropFirstAcceptResponse) {
      dropFirstAcceptResponse = false;
      firstAcceptRequestBody = route.request().postDataJSON();
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      const committedOrder = (await committedResponse.json()) as { id: string; status: string };
      expect(committedOrder).toMatchObject({ id: handoverOrder.id, status: 'accepted' });
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await handoverOrderCard.getByRole('button', { name: 'Accept order', exact: true }).click();
  await expect(
    handoverOrderCard.getByRole('button', { name: 'Retry saved action', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  handoverOrderCard = page
    .locator('article')
    .filter({ hasText: '#' + handoverOrder.id.slice(0, 6).toUpperCase() });
  await expect(handoverOrderCard).toContainText('accepted');
  const retriedAcceptRequestPromise = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/pos/orders/' + handoverOrder.id + '/accept' &&
      request.method() === 'POST',
  );
  const acceptOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + handoverOrder.id + '/accept',
  );
  await handoverOrderCard.getByRole('button', { name: 'Retry saved action', exact: true }).click();
  const retriedAcceptRequest = await retriedAcceptRequestPromise;
  expect(retriedAcceptRequest.postDataJSON()).toEqual(firstAcceptRequestBody);
  const acceptOrderResponse = await acceptOrderResponsePromise;
  expect(acceptOrderResponse.ok()).toBe(true);
  expect((await acceptOrderResponse.json()) as { id: string; status: string }).toMatchObject({
    id: handoverOrder.id,
    status: 'accepted',
  });
  await page.unroute(acceptRoute);
  const startPreparationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + handoverOrder.id + '/start-preparation',
  );
  await handoverOrderCard.getByRole('button', { name: 'Start preparation', exact: true }).click();
  const startPreparationResponse = await startPreparationResponsePromise;
  expect(startPreparationResponse.ok()).toBe(true);
  expect(((await startPreparationResponse.json()) as { status: string }).status).toBe('preparing');
  const readyItemPath = new RegExp('/pos/orders/' + handoverOrder.id + '/items/[^/]+/ready$');
  let firstReadyCommandBody: unknown;
  let dropFirstReadyResponse = true;
  await page.route(readyItemPath, async (route) => {
    if (dropFirstReadyResponse) {
      dropFirstReadyResponse = false;
      firstReadyCommandBody = route.request().postDataJSON();
      const committedReadyResponse = await route.fetch();
      expect(committedReadyResponse.ok()).toBe(true);
      expect((await committedReadyResponse.json()) as { id: string; status: string }).toMatchObject(
        {
          id: handoverOrder.id,
          status: 'ready',
        },
      );
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await handoverOrderCard
    .getByRole('button', { name: 'Mark Live POS E2E Item ready', exact: true })
    .click();
  await expect(
    handoverOrderCard.getByRole('button', { name: 'Retry saved action', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  handoverOrderCard = page
    .locator('article')
    .filter({ hasText: '#' + handoverOrder.id.slice(0, 6).toUpperCase() });
  await expect(handoverOrderCard).toContainText('Ready at');
  const retriedReadyRequestPromise = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname.startsWith('/pos/orders/' + handoverOrder.id + '/items/') &&
      new URL(request.url()).pathname.endsWith('/ready'),
  );
  const retriedReadyResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith('/pos/orders/' + handoverOrder.id + '/items/') &&
      new URL(response.url()).pathname.endsWith('/ready'),
  );
  await handoverOrderCard.getByRole('button', { name: 'Retry saved action', exact: true }).click();
  const retriedReadyRequest = await retriedReadyRequestPromise;
  expect(retriedReadyRequest.postDataJSON()).toEqual(firstReadyCommandBody);
  const retriedReadyResponse = await retriedReadyResponsePromise;
  expect(retriedReadyResponse.ok()).toBe(true);
  expect(((await retriedReadyResponse.json()) as { id: string; status: string }).status).toBe(
    'ready',
  );
  await page.unroute(readyItemPath);
  await expect(handoverOrderCard.getByRole('status')).toContainText(
    'Settle every check before handover.',
  );
  await expect(
    handoverOrderCard.getByRole('button', { name: 'Confirm handover', exact: true }),
  ).toBeDisabled();

  await signOutEmployee(page);
  await signInAsEmployee(page, 'cashier', 'pos-live-e2e-only-password');
  const draftOrderSubmissions: string[] = [];
  const trackDraftOrderSubmissions = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname === '/pos/orders' && request.method() === 'POST') {
      draftOrderSubmissions.push(url.pathname);
    }
  };
  page.on('request', trackDraftOrderSubmissions);
  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('42.50');
  const handoverReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), handoverOrder.id),
  );
  const handoverPaymentResponsePromise = page.waitForResponse((response) =>
    isCheckPayment(response.url()),
  );
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  expect((await handoverPaymentResponsePromise).status()).toBe(201);
  expect((await handoverReceiptReadPromise).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('42.50');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await paymentDialog.getByRole('button', { name: 'Done', exact: true }).click();

  await signOutEmployee(page);
  await signInAsEmployee(page, 'manager', 'pos-live-e2e-only-manager-password');
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  handoverOrderCard = page
    .locator('article')
    .filter({ hasText: '#' + handoverOrder.id.slice(0, 6).toUpperCase() });
  await expect(handoverOrderCard).toBeVisible();
  const handoverResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders/' + handoverOrder.id + '/handover',
  );
  await handoverOrderCard.getByRole('button', { name: 'Confirm handover', exact: true }).click();
  const handoverResponse = await handoverResponsePromise;
  expect(handoverResponse.ok()).toBe(true);
  expect(((await handoverResponse.json()) as { status: string }).status).toBe('completed');
  await expect(handoverOrderCard).toHaveCount(0);

  await signOutEmployee(page);
  await signInAsEmployee(page, 'cashier', 'pos-live-e2e-only-password');
  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const contentionOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const contentionOrderResponse = await contentionOrderResponsePromise;
  expect(contentionOrderResponse.status()).toBe(201);
  const contentionOrder = (await contentionOrderResponse.json()) as { id: string };

  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('42.50');
  const contentionPaymentPath = new RegExp(
    '/pos/orders/' + contentionOrder.id + '/checks/[^/]+/payments$',
  );
  let contentionStatuses: number[] = [];
  const contentionPaymentResponsePromise = page.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return (
      path.startsWith('/pos/orders/' + contentionOrder.id + '/checks/') &&
      path.endsWith('/payments')
    );
  });
  await page.route(contentionPaymentPath, async (route) => {
    const browserCommand = route.request().postDataJSON() as {
      requestId: string;
      revision: number;
      tenders: Array<Record<string, unknown>>;
    };
    const competingCommand = { ...browserCommand, requestId: globalThis.crypto.randomUUID() };
    expect(competingCommand.requestId).not.toBe(browserCommand.requestId);
    const competingResponsePromise = page.request.post(route.request().url(), {
      data: competingCommand,
    });
    const browserResponse = await route.fetch();
    const competingResponse = await competingResponsePromise;
    contentionStatuses = [browserResponse.status(), competingResponse.status()];
    await route.fulfill({ response: browserResponse });
  });
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  const contentionPaymentResponse = await contentionPaymentResponsePromise;
  expect(contentionStatuses.sort((left, right) => left - right)).toEqual([201, 409]);
  expect([201, 409]).toContain(contentionPaymentResponse.status());
  await page.unroute(contentionPaymentPath);

  const contentionStateResponse = await page.request.get(
    new URL(
      '/pos/orders/' + contentionOrder.id + '/payment-state',
      contentionPaymentResponse.url(),
    ).toString(),
  );
  expect(contentionStateResponse.ok()).toBe(true);
  const contentionState = (await contentionStateResponse.json()) as {
    checks: Array<{
      id: string;
      amount: string;
      balanceDue: string;
      paidAmount: string;
      payments: Array<{ amount: string; method: string }>;
      receipt: { id: string } | null;
      status: string;
    }>;
  };
  expect(contentionState.checks).toHaveLength(1);
  expect(contentionState.checks[0]).toMatchObject({
    amount: '42.50',
    balanceDue: '0.00',
    paidAmount: '42.50',
    status: 'settled',
    payments: [{ amount: '42.50', method: 'cash' }],
  });
  const contentionReceiptId = contentionState.checks[0]?.receipt?.id;
  expect(contentionReceiptId).toBeTruthy();
  const contentionReceiptResponse = await page.request.get(
    new URL(
      '/pos/orders/' + contentionOrder.id + '/checks/' + contentionState.checks[0]!.id + '/receipt',
      contentionPaymentResponse.url(),
    ).toString(),
  );
  expect(contentionReceiptResponse.ok()).toBe(true);
  expect((await contentionReceiptResponse.json()) as { id: string }).toMatchObject({
    id: contentionReceiptId,
  });

  await page.goto('/catalog');
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Start another order', exact: true }).click();
  await page.getByRole('button', { name: 'Takeaway', exact: true }).click();
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const reconnectOrderResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/pos/orders' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  const reconnectOrderResponse = await reconnectOrderResponsePromise;
  expect(reconnectOrderResponse.status()).toBe(201);
  const reconnectOrder = (await reconnectOrderResponse.json()) as { id: string };

  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(paymentDialog.getByLabel('Cash received for payment 1')).toHaveValue('42.50');
  const reconnectPaymentPath = new RegExp(
    '/pos/orders/' + reconnectOrder.id + '/checks/[^/]+/payments$',
  );
  let reconnectPaymentUrl = '';
  let reconnectFirstCommand: unknown;
  let reconnectAttempts = 0;
  await page.route(reconnectPaymentPath, async (route) => {
    reconnectAttempts += 1;
    reconnectPaymentUrl = route.request().url();
    if (reconnectAttempts === 1) {
      reconnectFirstCommand = route.request().postDataJSON();
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await paymentDialog.getByRole('button', { name: 'Settle check', exact: true }).click();
  await expect(paymentDialog.getByRole('alert')).toContainText(
    'The payment result is not confirmed.',
  );
  await expect(
    paymentDialog.getByRole('button', { name: 'Retry the same payment', exact: true }),
  ).toBeVisible();
  const beforeReconnectStateResponse = await page.request.get(
    new URL('/pos/orders/' + reconnectOrder.id + '/payment-state', reconnectPaymentUrl).toString(),
  );
  expect(beforeReconnectStateResponse.ok()).toBe(true);
  const beforeReconnectState = (await beforeReconnectStateResponse.json()) as {
    checks: Array<{ amount: string; balanceDue: string; paidAmount: string; payments: unknown[] }>;
  };
  expect(beforeReconnectState.checks).toHaveLength(1);
  expect(beforeReconnectState.checks[0]).toMatchObject({
    amount: '42.50',
    balanceDue: '42.50',
    paidAmount: '0.00',
    payments: [],
  });

  await page.reload();
  await expect(page).toHaveURL(/\/catalog$/);
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: 'Take payment', exact: true }).click();
  paymentDialog = page.getByRole('dialog', { name: 'Take payment' });
  const reconnectRetryRequestPromise = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname.startsWith('/pos/orders/' + reconnectOrder.id + '/checks/') &&
      new URL(request.url()).pathname.endsWith('/payments'),
  );
  const reconnectRetryResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith(
        '/pos/orders/' + reconnectOrder.id + '/checks/',
      ) && new URL(response.url()).pathname.endsWith('/payments'),
  );
  const reconnectReceiptReadPromise = page.waitForResponse((response) =>
    isReceiptRead(response.url(), reconnectOrder.id),
  );
  await paymentDialog.getByRole('button', { name: 'Check saved result', exact: true }).click();
  const reconnectRetryRequest = await reconnectRetryRequestPromise;
  expect(reconnectRetryRequest.postDataJSON()).toEqual(reconnectFirstCommand);
  const reconnectRetryResponse = await reconnectRetryResponsePromise;
  expect(reconnectRetryResponse.status()).toBe(201);
  expect(reconnectAttempts).toBe(2);
  expect((await reconnectReceiptReadPromise).ok()).toBe(true);
  receiptDialog = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receiptDialog).toContainText('Live POS E2E Item');
  await expect(receiptDialog).toContainText('42.50');
  await receiptDialog.getByRole('button', { name: 'Back to checkout', exact: true }).click();
  await page.unroute(reconnectPaymentPath);

  const afterReconnectStateResponse = await page.request.get(
    new URL('/pos/orders/' + reconnectOrder.id + '/payment-state', reconnectPaymentUrl).toString(),
  );
  expect(afterReconnectStateResponse.ok()).toBe(true);
  const afterReconnectState = (await afterReconnectStateResponse.json()) as {
    checks: Array<{
      balanceDue: string;
      paidAmount: string;
      payments: Array<{ amount: string; method: string }>;
      status: string;
    }>;
  };
  expect(afterReconnectState.checks).toHaveLength(1);
  expect(afterReconnectState.checks[0]).toMatchObject({
    balanceDue: '0.00',
    paidAmount: '42.50',
    status: 'settled',
    payments: [{ amount: '42.50', method: 'cash' }],
  });
  const committedReconnectCommand = retriedPaymentRequest.postDataJSON() as {
    requestId: string;
    revision: number;
    tenders: Array<{ method: 'cash'; amount: string; receivedAmount: string }>;
  };
  const changedPayloadReplay = await page.request.post(reconnectPaymentUrl, {
    data: {
      ...committedReconnectCommand,
      tenders: committedReconnectCommand.tenders.map((tender) => ({
        ...tender,
        amount: '42.49',
        receivedAmount: '42.49',
      })),
    },
  });
  expect(changedPayloadReplay.status()).toBe(409);
  const paymentStateAfterChangedReplay = await page.request.get(
    new URL('/pos/orders/' + reconnectOrder.id + '/payment-state', reconnectPaymentUrl).toString(),
  );
  expect(paymentStateAfterChangedReplay.ok()).toBe(true);
  const unchangedAfterReplay = (await paymentStateAfterChangedReplay.json()) as {
    checks: Array<{ paidAmount: string; payments: Array<{ amount: string }> }>;
  };
  expect(unchangedAfterReplay.checks).toHaveLength(1);
  expect(unchangedAfterReplay.checks[0]).toMatchObject({
    paidAmount: '42.50',
    payments: [{ amount: '42.50' }],
  });

  await signOutEmployee(page);
  await signInAsEmployee(page, 'manager', 'pos-live-e2e-only-manager-password');
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  const originalBranchSelect = page.getByLabel('Branch', { exact: true });
  const originalBranchId = await originalBranchSelect
    .locator('option')
    .filter({ hasText: 'Live E2E branch' })
    .getAttribute('value');
  expect(originalBranchId).toBeTruthy();
  const contentionOrderCard = page
    .locator('article')
    .filter({ hasText: '#' + contentionOrder.id.slice(0, 6).toUpperCase() });
  await expect(contentionOrderCard).toBeVisible();

  const originalBranchOrdersUrl = new URL('/pos/orders', reconnectPaymentUrl);
  originalBranchOrdersUrl.searchParams.set('branchId', originalBranchId!);
  originalBranchOrdersUrl.searchParams.set('limit', '25');
  const originalBranchOrdersResponse = await page.request.get(originalBranchOrdersUrl.toString());
  expect(originalBranchOrdersResponse.ok()).toBe(true);
  const originalBranchOrders = (await originalBranchOrdersResponse.json()) as {
    items: Array<{ id: string }>;
  };
  expect(originalBranchOrders.items.some((order) => order.id === contentionOrder.id)).toBe(true);

  const originalBranchSessionsUrl = new URL('/pos/dining/sessions', reconnectPaymentUrl);
  originalBranchSessionsUrl.searchParams.set('branchId', originalBranchId!);
  const originalBranchSessionsResponse = await page.request.get(
    originalBranchSessionsUrl.toString(),
  );
  expect(originalBranchSessionsResponse.ok()).toBe(true);
  const originalBranchSessions = (await originalBranchSessionsResponse.json()) as Array<{
    tableCode: string;
    orders: Array<{ id: string }>;
  }>;
  expect(
    originalBranchSessions.some(
      (session) =>
        session.tableCode === 'T01' && session.orders.some((order) => order.id === dineInOrder.id),
    ),
  ).toBe(true);

  const originalBranchPaymentStateUrl = new URL(
    '/pos/orders/' + reconnectOrder.id + '/payment-state',
    reconnectPaymentUrl,
  );
  const originalBranchPaymentStateResponse = await page.request.get(
    originalBranchPaymentStateUrl.toString(),
  );
  expect(originalBranchPaymentStateResponse.ok()).toBe(true);
  const originalBranchPaymentState = (await originalBranchPaymentStateResponse.json()) as {
    checks: Array<{ id: string; receipt: { id: string; receiptNumber: string } | null }>;
  };
  expect(originalBranchPaymentState.checks).toHaveLength(1);
  expect(originalBranchPaymentState.checks[0].receipt).not.toBeNull();
  const originalBranchCheckId = originalBranchPaymentState.checks[0].id;
  const originalBranchReceiptId = originalBranchPaymentState.checks[0].receipt!.id;
  const originalBranchReceiptNumber = originalBranchPaymentState.checks[0].receipt!.receiptNumber;

  await signOutEmployee(page);
  await signInAsEmployee(page, 'isolated-cashier', 'pos-live-e2e-isolated-password');
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Incoming orders', exact: true })).toBeVisible();
  const isolatedBranchSelect = page.getByLabel('Branch', { exact: true });
  await expect(isolatedBranchSelect.locator('option')).toHaveCount(1);
  await expect(isolatedBranchSelect.locator('option').first()).toHaveText(
    'Live E2E isolated branch',
  );
  const isolatedBranchId = await isolatedBranchSelect
    .locator('option')
    .first()
    .getAttribute('value');
  expect(isolatedBranchId).toBeTruthy();
  await expect(page.getByRole('status')).toContainText(
    'No incoming kitchen orders for this branch.',
  );
  const isolatedBranchOrdersUrl = new URL('/pos/orders', reconnectPaymentUrl);
  isolatedBranchOrdersUrl.searchParams.set('branchId', isolatedBranchId!);
  isolatedBranchOrdersUrl.searchParams.set('limit', '25');
  const isolatedBranchOrdersResponse = await page.request.get(isolatedBranchOrdersUrl.toString());
  expect(isolatedBranchOrdersResponse.ok()).toBe(true);
  expect(((await isolatedBranchOrdersResponse.json()) as { items: unknown[] }).items).toEqual([]);

  const crossBranchListResponse = await page.request.get(originalBranchOrdersUrl.toString());
  expect(crossBranchListResponse.status()).toBe(403);

  const crossBranchOrderDetailResponse = await page.request.get(
    new URL('/pos/orders/' + reconnectOrder.id, reconnectPaymentUrl).toString(),
  );
  expect(crossBranchOrderDetailResponse.status()).toBe(404);
  const crossBranchOrderDetailBody = await crossBranchOrderDetailResponse.text();
  expect(crossBranchOrderDetailBody).not.toContain('Live POS E2E Item');

  const crossBranchPaymentStateResponse = await page.request.get(
    originalBranchPaymentStateUrl.toString(),
  );
  expect(crossBranchPaymentStateResponse.status()).toBe(404);
  const crossBranchPaymentStateBody = await crossBranchPaymentStateResponse.text();
  expect(crossBranchPaymentStateBody).not.toContain('Live POS E2E Item');
  expect(crossBranchPaymentStateBody).not.toContain(originalBranchReceiptNumber);

  const crossBranchReceiptResponse = await page.request.get(
    new URL(
      '/pos/orders/' + reconnectOrder.id + '/checks/' + originalBranchCheckId + '/receipt',
      reconnectPaymentUrl,
    ).toString(),
  );
  expect(crossBranchReceiptResponse.status()).toBe(404);
  const crossBranchReceiptBody = await crossBranchReceiptResponse.text();
  expect(crossBranchReceiptBody).not.toContain('Live POS E2E Item');
  expect(crossBranchReceiptBody).not.toContain(originalBranchReceiptNumber);

  const isolatedBranchReceiptsUrl = new URL('/pos/receipts', reconnectPaymentUrl);
  isolatedBranchReceiptsUrl.searchParams.set('branchId', isolatedBranchId!);
  isolatedBranchReceiptsUrl.searchParams.set('limit', '25');
  const isolatedBranchReceiptsResponse = await page.request.get(
    isolatedBranchReceiptsUrl.toString(),
  );
  expect(isolatedBranchReceiptsResponse.ok()).toBe(true);
  expect(((await isolatedBranchReceiptsResponse.json()) as { items: unknown[] }).items).toEqual([]);

  const crossBranchReceiptsUrl = new URL('/pos/receipts', reconnectPaymentUrl);
  crossBranchReceiptsUrl.searchParams.set('branchId', originalBranchId!);
  crossBranchReceiptsUrl.searchParams.set('limit', '25');
  const crossBranchReceiptsResponse = await page.request.get(crossBranchReceiptsUrl.toString());
  expect(crossBranchReceiptsResponse.status()).toBe(403);

  const foreignReceiptCursorUrl = new URL(isolatedBranchReceiptsUrl);
  foreignReceiptCursorUrl.searchParams.set('cursor', originalBranchReceiptId);
  const foreignReceiptCursorResponse = await page.request.get(foreignReceiptCursorUrl.toString());
  expect(foreignReceiptCursorResponse.status()).toBe(400);

  const crossBranchCursorUrl = new URL(isolatedBranchOrdersUrl);
  crossBranchCursorUrl.searchParams.set('cursor', contentionOrder.id);
  const crossBranchCursorResponse = await page.request.get(crossBranchCursorUrl.toString());
  expect(crossBranchCursorResponse.status()).toBe(400);

  const isolatedBranchTablesUrl = new URL('/pos/dining/tables', reconnectPaymentUrl);
  isolatedBranchTablesUrl.searchParams.set('branchId', isolatedBranchId!);
  const isolatedBranchTablesResponse = await page.request.get(isolatedBranchTablesUrl.toString());
  expect(isolatedBranchTablesResponse.ok()).toBe(true);
  expect(await isolatedBranchTablesResponse.json()).toEqual([]);

  const isolatedBranchSessionsUrl = new URL('/pos/dining/sessions', reconnectPaymentUrl);
  isolatedBranchSessionsUrl.searchParams.set('branchId', isolatedBranchId!);
  const isolatedBranchSessionsResponse = await page.request.get(
    isolatedBranchSessionsUrl.toString(),
  );
  expect(isolatedBranchSessionsResponse.ok()).toBe(true);
  expect(await isolatedBranchSessionsResponse.json()).toEqual([]);

  const crossBranchTablesUrl = new URL('/pos/dining/tables', reconnectPaymentUrl);
  crossBranchTablesUrl.searchParams.set('branchId', originalBranchId!);
  const crossBranchTablesResponse = await page.request.get(crossBranchTablesUrl.toString());
  expect(crossBranchTablesResponse.status()).toBe(403);
  const crossBranchTablesBody = await crossBranchTablesResponse.text();
  expect(crossBranchTablesBody).not.toContain('T01');
  expect(crossBranchTablesBody).not.toContain('Live POS E2E Item');

  const crossBranchSessionsResponse = await page.request.get(originalBranchSessionsUrl.toString());
  expect(crossBranchSessionsResponse.status()).toBe(403);
  const crossBranchSessionsBody = await crossBranchSessionsResponse.text();
  expect(crossBranchSessionsBody).not.toContain('T01');
  expect(crossBranchSessionsBody).not.toContain('Live POS E2E Item');
  expect(crossBranchSessionsBody).not.toContain('Live E2E delivery customer');

  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'New order', exact: true })).toBeVisible();
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(0);

  await signOutEmployee(page);
  await signInAsEmployee(page, 'cashier', 'pos-live-e2e-only-password');
  await page.goto('/catalog');
  await expect(
    page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }),
  ).toBeVisible();
  const sellingBranchSelect = page.getByLabel('Branch', { exact: true });
  await sellingBranchSelect.selectOption({ label: 'Live E2E branch' });
  const selectedOriginalBranchId = await sellingBranchSelect.inputValue();
  expect(selectedOriginalBranchId).toBe(originalBranchId);
  await page.getByRole('button', { name: 'New order', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add item: Live POS E2E Item', exact: true }).click();
  const branchScopedDraftLine = page.locator('.pos-live-cart-line').first();
  await expect(branchScopedDraftLine).toContainText('Live POS E2E Item');
  await page.locator('.pos-item-note-editor summary').first().click();
  await page
    .getByRole('textbox', { name: 'Item note for Live POS E2E Item' })
    .fill('Branch A only');

  await sellingBranchSelect.selectOption({ label: 'Live E2E isolated branch' });
  expect(await sellingBranchSelect.inputValue()).toBe(isolatedBranchId);
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(0);
  await sellingBranchSelect.selectOption({ label: 'Live E2E branch' });
  expect(await sellingBranchSelect.inputValue()).toBe(originalBranchId);
  const restoredBranchScopedDraftLine = page.locator('.pos-live-cart-line').first();
  await expect(restoredBranchScopedDraftLine).toContainText('Live POS E2E Item');
  await expect(page.locator('.pos-item-note-editor summary').first()).toContainText(
    'Branch A only',
  );
  await page.reload();
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue(originalBranchId!);
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(1);
  await expect(page.locator('.pos-item-note-editor summary').first()).toContainText(
    'Branch A only',
  );

  await signOutEmployee(page);
  await signInAsEmployee(page, 'isolated-cashier', 'pos-live-e2e-isolated-password');
  await page.goto('/catalog');
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue(isolatedBranchId!);
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(0);
  const employeeReportResponse = await page.request.get(
    'http://127.0.0.1:4005/owner/pos/reports/operations',
  );
  expect(employeeReportResponse.status()).toBe(401);

  await signOutEmployee(page);
  await signInAsEmployee(page, 'cashier', 'pos-live-e2e-only-password');
  await page.goto('/catalog');
  const terminalBranchSelect = page.getByLabel('Branch', { exact: true });
  await terminalBranchSelect.selectOption(originalBranchId!);
  await page.getByRole('button', { name: /All orders/ }).click();
  await page.getByRole('button', { name: /^Confirmed orders/ }).click();
  const terminalOrderReference = `ORD-${customSplitOrder.id.slice(0, 8).toUpperCase()}`;
  await page.getByRole('textbox', { name: 'Search saved orders' }).fill(terminalOrderReference);
  await page
    .getByRole('button', { name: `Open confirmed order ${terminalOrderReference}` })
    .click();
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: /^Refund/ }).click();
  const terminalRefundDialog = page.getByRole('dialog', { name: 'Refund payment' });
  await terminalRefundDialog.getByLabel(/Refund.*terminal/i).fill('5.00');
  const terminalRefundReference = 'M9-23-TERMINAL-REFUND';
  await terminalRefundDialog
    .getByLabel('Terminal refund reference', { exact: true })
    .fill(terminalRefundReference);
  await terminalRefundDialog
    .getByLabel('Refund reason', { exact: true })
    .fill('Live E2E partial terminal refund');
  await terminalRefundDialog.getByLabel('Supervisor username', { exact: true }).fill('supervisor');
  await terminalRefundDialog
    .getByLabel('Supervisor password', { exact: true })
    .fill('pos-live-e2e-only-supervisor-password');

  const terminalRefundRoute =
    '/pos/orders/' + customSplitOrder.id + '/checks/' + secondCustomCheckId + '/refunds';
  let terminalRefundWriteAttempts = 0;
  let committedTerminalRefundId = '';
  type TerminalRefundRequest = {
    requestId: string;
    revision: number;
    branchId: string;
    refundShiftId: string;
    reason: string;
    allocations: Array<{ paymentId: string; amount: string; terminalReference?: string }>;
  };
  const terminalRefundRequests: {
    original: TerminalRefundRequest | null;
    retry: TerminalRefundRequest | null;
  } = { original: null, retry: null };
  const terminalRefundPath = new RegExp(terminalRefundRoute + '$');
  await page.route(terminalRefundPath, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    terminalRefundWriteAttempts += 1;
    if (terminalRefundWriteAttempts === 1) {
      terminalRefundRequests.original = route.request().postDataJSON() as TerminalRefundRequest;
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      const committedRefund = (await committedResponse.json()) as {
        refund: {
          id: string;
          requestId: string;
          amount: string;
          tenders: Array<{ method: string; amount: string; terminalReference: string | null }>;
        };
      };
      committedTerminalRefundId = committedRefund.refund.id;
      expect(committedRefund.refund).toMatchObject({
        requestId: terminalRefundRequests.original?.requestId,
        amount: '5.00',
        tenders: [
          { method: 'terminal', amount: '5.00', terminalReference: terminalRefundReference },
        ],
      });
      await route.abort('failed');
      return;
    }
    terminalRefundRequests.retry = route.request().postDataJSON() as TerminalRefundRequest;
    await route.continue();
  });

  await terminalRefundDialog.getByRole('button', { name: 'Record refund', exact: true }).click();
  await expect(terminalRefundDialog.getByRole('status')).toContainText(
    'A refund request is saved.',
  );
  const terminalRefundWorkspace = await page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.getItem(localStorage.key(index) ?? ''),
    ).join('\n'),
  );
  expect(terminalRefundWorkspace).not.toContain('pos-live-e2e-only-supervisor-password');
  await page.reload();
  await expect(page).toHaveURL(/\/catalog$/);
  confirmedPanel = page.getByTestId('confirmed-order-panel');
  await expect(confirmedPanel).toContainText('Live POS E2E Item');
  await confirmedPanel.getByRole('button', { name: /^Refund/ }).click();
  const recoveredTerminalRefundDialog = page.getByRole('dialog', { name: 'Refund payment' });
  await expect(recoveredTerminalRefundDialog.getByRole('status')).toContainText(
    'A refund request is saved.',
  );
  await expect(recoveredTerminalRefundDialog.getByLabel(/Refund.*terminal/i)).toHaveValue('5.00');
  await expect(
    recoveredTerminalRefundDialog.getByLabel('Terminal refund reference', { exact: true }),
  ).toHaveValue(terminalRefundReference);
  await recoveredTerminalRefundDialog
    .getByLabel('Supervisor username', { exact: true })
    .fill('supervisor');
  await recoveredTerminalRefundDialog
    .getByLabel('Supervisor password', { exact: true })
    .fill('pos-live-e2e-only-supervisor-password');
  const terminalRefundRetryResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === terminalRefundRoute &&
      response.request().method() === 'POST',
  );
  await recoveredTerminalRefundDialog
    .getByRole('button', { name: 'Retry saved refund', exact: true })
    .click();
  const terminalRefundRetryResponse = await terminalRefundRetryResponsePromise;
  expect(terminalRefundRetryResponse.ok()).toBe(true);
  expect(terminalRefundRequests.retry).toMatchObject({
    requestId: terminalRefundRequests.original?.requestId,
    revision: terminalRefundRequests.original?.revision,
    branchId: terminalRefundRequests.original?.branchId,
    refundShiftId: terminalRefundRequests.original?.refundShiftId,
    reason: terminalRefundRequests.original?.reason,
    allocations: terminalRefundRequests.original?.allocations,
  });
  const retriedTerminalRefund = (await terminalRefundRetryResponse.json()) as {
    refund: {
      id: string;
      requestId: string;
      amount: string;
      tenders: Array<{ method: string; amount: string; terminalReference: string | null }>;
    };
  };
  expect(retriedTerminalRefund.refund).toMatchObject({
    id: committedTerminalRefundId,
    requestId: terminalRefundRequests.original?.requestId,
    amount: '5.00',
    tenders: [{ method: 'terminal', amount: '5.00', terminalReference: terminalRefundReference }],
  });
  const terminalRefundReceipt = page.getByRole('dialog', { name: 'Refund receipt' });
  await expect(terminalRefundReceipt).toContainText('External terminal refund');
  await expect(terminalRefundReceipt).toContainText(terminalRefundReference);
  await expect(terminalRefundReceipt).toContainText('Live E2E supervisor');
  await terminalRefundReceipt.getByRole('button', { name: 'Done', exact: true }).click();
  await page.unroute(terminalRefundPath);

  const terminalPaymentStateResponse = await page.request.get(
    new URL(
      '/pos/orders/' + customSplitOrder.id + '/payment-state',
      terminalPaymentResponse.url(),
    ).toString(),
  );
  expect(terminalPaymentStateResponse.ok()).toBe(true);
  const terminalPaymentState = (await terminalPaymentStateResponse.json()) as {
    checks: Array<{
      id: string;
      payments: Array<{
        id: string;
        method: string;
        amount: string;
        refundedAmount: string;
        refundableAmount: string;
      }>;
      refunds: Array<{
        id: string;
        amount: string;
        tenders: Array<{ method: string; amount: string; terminalReference: string | null }>;
      }>;
    }>;
  };
  const terminalRefundedCheck = terminalPaymentState.checks.find(
    (check) => check.id === secondCustomCheckId,
  );
  expect(terminalRefundedCheck).toBeDefined();
  expect(terminalRefundedCheck?.payments).toEqual([
    expect.objectContaining({
      method: 'terminal',
      amount: '22.50',
      refundedAmount: '5.00',
      refundableAmount: '17.50',
    }),
  ]);
  expect(terminalRefundedCheck?.refunds).toEqual([
    expect.objectContaining({
      id: committedTerminalRefundId,
      amount: '5.00',
      tenders: [{ method: 'terminal', amount: '5.00', terminalReference: terminalRefundReference }],
    }),
  ]);
  const unchangedTerminalSaleReceiptResponse = await page.request.get(
    new URL(
      '/pos/orders/' + customSplitOrder.id + '/checks/' + secondCustomCheckId + '/receipt',
      terminalPaymentResponse.url(),
    ).toString(),
  );
  expect(unchangedTerminalSaleReceiptResponse.ok()).toBe(true);
  const unchangedTerminalSaleReceipt = (await unchangedTerminalSaleReceiptResponse.json()) as {
    amount: string;
    tenders: Array<{ method: string; amount: string }>;
  };
  expect(unchangedTerminalSaleReceipt).toMatchObject({
    amount: '22.50',
    tenders: [{ method: 'terminal', amount: '22.50' }],
  });
  expect(terminalRefundWriteAttempts).toBe(2);
  page.off('request', trackDraftOrderSubmissions);
  expect(draftOrderSubmissions).toEqual([]);
});

test('live owner POS operations report reconciles committed POS facts by branch', async ({
  page,
}) => {
  if (process.env.CI !== 'true' || !databaseUrl) {
    throw new Error('POS live E2E must run in CI with its disposable PostgreSQL database.');
  }
  if (new URL(databaseUrl).pathname.slice(1) !== 'waffarly_pos_e2e') {
    throw new Error('POS live E2E refuses to use a database other than waffarly_pos_e2e.');
  }

  const apiOrigin = 'http://127.0.0.1:4005';
  const loginResponse = await page.request.post(`${apiOrigin}/auth/owner/login`, {
    data: { username: 'owner', password: 'pos-live-e2e-only-owner-password' },
  });
  expect(loginResponse.ok()).toBe(true);

  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date();
  const reportUrl = new URL('/owner/pos/reports/operations', apiOrigin);
  reportUrl.searchParams.set('from', from.toISOString());
  reportUrl.searchParams.set('to', to.toISOString());

  const allBranchesResponse = await page.request.get(reportUrl.toString());
  expect(allBranchesResponse.status()).toBe(200);
  const allBranchesReport = (await allBranchesResponse.json()) as {
    branchId: string | null;
    orders: {
      placedCount: number;
      cancelledCount: number;
      acceptedCount: number;
      completedCount: number;
      paidCount: number;
      value: string;
      outstanding: string;
    };
    checks: { settledCount: number };
    collections: { cash: string; terminal: string; total: string };
    refunds: { cash: string; terminal: string; total: string };
    netCollected: string;
    cashierActivity: Array<{
      employeeId: string | null;
      employeeName: string | null;
      ordersOpened: number;
      cancelledOrders: number;
      orderValue: string;
      paymentCount: number;
      collections: { cash: string; terminal: string; total: string };
      refundCount: number;
      refunds: { cash: string; terminal: string; total: string };
      netCollected: string;
    }>;
  };
  expect(allBranchesReport.branchId).toBeNull();
  expect(allBranchesReport.orders.placedCount).toBeGreaterThan(0);
  expect(allBranchesReport.orders.value).not.toBe('0.00');
  expect(allBranchesReport.checks.settledCount).toBeGreaterThan(0);
  expect(Number(allBranchesReport.collections.cash)).toBeGreaterThan(0);
  expect(Number(allBranchesReport.refunds.cash)).toBeGreaterThan(0);
  expect(Number(allBranchesReport.refunds.terminal)).toBeGreaterThan(0);
  expect(
    allBranchesReport.cashierActivity.reduce((total, activity) => total + activity.ordersOpened, 0),
  ).toBe(allBranchesReport.orders.placedCount);
  expect(sumEgp(allBranchesReport.cashierActivity.map((activity) => activity.orderValue))).toBe(
    allBranchesReport.orders.value,
  );
  expect(
    sumEgp(allBranchesReport.cashierActivity.map((activity) => activity.collections.total)),
  ).toBe(allBranchesReport.collections.total);
  expect(sumEgp(allBranchesReport.cashierActivity.map((activity) => activity.refunds.total))).toBe(
    allBranchesReport.refunds.total,
  );
  expect(
    allBranchesReport.cashierActivity.some(
      (activity) => activity.employeeName === 'Live E2E cashier' && activity.ordersOpened > 0,
    ),
  ).toBe(true);
  expect(
    allBranchesReport.cashierActivity.some(
      (activity) => activity.employeeId !== null && activity.refundCount > 0,
    ),
  ).toBe(true);
  expect('merchantId' in allBranchesReport).toBe(false);
  expect(JSON.stringify(allBranchesReport)).not.toContain('Live POS E2E Item');

  const branchesResponse = await page.request.get(
    `${apiOrigin}/owner/inventory/branches?status=active&limit=25`,
  );
  expect(branchesResponse.ok()).toBe(true);
  const branches = (await branchesResponse.json()) as {
    items: Array<{ id: string; name: string }>;
  };
  const sourceBranch = branches.items.find((branch) => branch.name === 'Live E2E branch');
  const emptyBranch = branches.items.find((branch) => branch.name === 'Live E2E isolated branch');
  expect(sourceBranch).toBeDefined();
  expect(emptyBranch).toBeDefined();

  const sourceBranchUrl = new URL(reportUrl);
  sourceBranchUrl.searchParams.set('branchId', sourceBranch!.id);
  const sourceBranchResponse = await page.request.get(sourceBranchUrl.toString());
  expect(sourceBranchResponse.status()).toBe(200);
  const sourceBranchReport = (await sourceBranchResponse.json()) as typeof allBranchesReport;
  expect(sourceBranchReport.branchId).toBe(sourceBranch!.id);
  expect(sourceBranchReport.orders).toEqual(allBranchesReport.orders);
  expect(sourceBranchReport.checks).toEqual(allBranchesReport.checks);
  expect(sourceBranchReport.collections).toEqual(allBranchesReport.collections);
  expect(sourceBranchReport.refunds).toEqual(allBranchesReport.refunds);
  expect(sourceBranchReport.netCollected).toBe(allBranchesReport.netCollected);
  expect(sourceBranchReport.cashierActivity).toEqual(allBranchesReport.cashierActivity);

  const emptyBranchUrl = new URL(reportUrl);
  emptyBranchUrl.searchParams.set('branchId', emptyBranch!.id);
  const emptyBranchResponse = await page.request.get(emptyBranchUrl.toString());
  expect(emptyBranchResponse.status()).toBe(200);
  const emptyBranchReport = (await emptyBranchResponse.json()) as typeof allBranchesReport;
  expect(emptyBranchReport.orders.placedCount).toBe(0);
  expect(emptyBranchReport.orders.value).toBe('0.00');
  expect(emptyBranchReport.checks.settledCount).toBe(0);
  expect(emptyBranchReport.collections.total).toBe('0.00');
  expect(emptyBranchReport.refunds.total).toBe('0.00');
  expect(emptyBranchReport.netCollected).toBe('0.00');
  expect(emptyBranchReport.cashierActivity).toEqual([]);
});
