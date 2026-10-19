import { expect, test, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';
const checkId = '66666666-6666-4666-8666-666666666666';
const productId = '77777777-7777-4777-8777-777777777777';
const largeVariantId = '88888888-8888-4888-8888-888888888881';
const sauceGroupId = '99999999-9999-4999-8999-999999999991';
const extrasGroupId = '99999999-9999-4999-8999-999999999992';
const classicSauceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const spicySauceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const extraCheeseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function testCatalogProduct(configurable = false) {
  if (!configurable) {
    return {
      id: productId,
      name: 'Test coffee',
      description: null,
      basePrice: '34.86',
      currency: 'EGP' as const,
      sellingUnit: 'piece' as const,
      images: [],
      categories: [],
      modifierGroups: [],
      variants: [],
    };
  }
  return {
    id: productId,
    name: 'Test burger',
    description: null,
    basePrice: '34.86',
    currency: 'EGP' as const,
    sellingUnit: 'piece' as const,
    images: [],
    categories: [],
    modifierGroups: [
      {
        id: sauceGroupId,
        modifierGroupId: sauceGroupId,
        variantOverrides: [],
        name: 'Sauce',
        description: null,
        selectionMode: 'single' as const,
        minSelections: 1,
        maxSelections: 1,
        position: 0,
        options: [
          {
            id: classicSauceId,
            name: 'Classic sauce',
            priceAdjustment: '0.00',
            defaultSelected: true,
            maxQuantity: 1,
            variantOverrides: [],
            position: 0,
          },
          {
            id: spicySauceId,
            name: 'Spicy mayo',
            priceAdjustment: '2.50',
            defaultSelected: false,
            maxQuantity: 1,
            variantOverrides: [],
            position: 1,
          },
        ],
      },
      {
        id: extrasGroupId,
        modifierGroupId: extrasGroupId,
        variantOverrides: [],
        name: 'Extras',
        description: null,
        selectionMode: 'multiple' as const,
        minSelections: 0,
        maxSelections: 2,
        position: 1,
        options: [
          {
            id: extraCheeseId,
            name: 'Extra cheese',
            priceAdjustment: '10.00',
            defaultSelected: false,
            maxQuantity: 2,
            variantOverrides: [],
            position: 0,
          },
        ],
      },
    ],
    variants: [
      {
        id: productId,
        name: 'Regular',
        price: '34.86',
        availability: 'available' as const,
        position: 0,
        attributes: [],
      },
      {
        id: largeVariantId,
        name: 'Large',
        price: '49.86',
        availability: 'available' as const,
        position: 1,
        attributes: [],
      },
    ],
  };
}

async function showOrder(page: Page) {
  const navigation = page.getByTestId('pos-mobile-navigation');
  if (await navigation.isVisible())
    await navigation.getByRole('button', { name: /^View order/ }).click();
}

async function showMenu(page: Page) {
  const navigation = page.getByTestId('pos-mobile-navigation');
  if (await navigation.isVisible())
    await navigation.getByRole('button', { name: 'Menu', exact: true }).click();
}

const confirmedOrder = {
  id: orderId,
  status: 'pending',
  customerName: 'Guest One',
  customerPhone: null,
  fulfillmentType: 'takeaway',
  deliveryAddress: null,
  currency: 'EGP',
  total: '34.86',
  createdAt: '2026-10-17T08:00:00.000Z',
  lines: [
    {
      id: 'line-confirmed',
      productId,
      productName: 'Test coffee',
      quantity: 1,
      variantName: null,
      selections: [],
      note: 'no sugar',
      lineTotal: '34.86',
    },
  ],
};

function paymentState() {
  return {
    context: { order: confirmedOrder, tableCode: null },
    orderId,
    revision: 1,
    total: '34.86',
    currency: 'EGP',
    status: 'pending',
    checks: [
      {
        id: checkId,
        splitMethod: 'whole',
        allocations: [],
        position: 0,
        amount: '34.86',
        paidAmount: '0.00',
        balanceDue: '34.86',
        revision: 1,
        status: 'open',
        settledAt: null,
        receipt: null,
        payments: [],
      },
    ],
  };
}

async function openCheckout(
  page: Page,
  interruptFirstPayment = false,
  mobile = false,
  catalogOnly = false,
  arabic = false,
  configurableCatalog = false,
) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  const orderState = paymentState();
  let postCount = 0;
  const paymentRequests: Record<string, unknown>[] = [];
  const processedPayments = new Map<string, Record<string, unknown>>();

  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Cashier',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
  await page.route('**/pos/registers?**', (route) =>
    route.fulfill({ json: [{ id: registerId, branchId, name: 'Front register' }] }),
  );
  await page.route('**/pos/shifts/current?**', (route) =>
    route.fulfill({
      json: {
        id: '88888888-8888-4888-8888-888888888888',
        branchId,
        registerId,
        registerName: 'Front register',
        openedByEmployeeId: employeeId,
        openedByName: 'Cashier',
        openRequestId: '99999999-9999-4999-8999-999999999999',
        openingFloat: '100.00',
        currency: 'EGP',
        openedAt: '2026-10-17T08:00:00.000Z',
        status: 'open',
      },
    }),
  );
  await page.route('**/pos/dining/tables?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/pos/catalog**', (route) =>
    route.fulfill({
      json: {
        categories: { items: [], nextCursor: null },
        products: { items: [testCatalogProduct(configurableCatalog)], nextCursor: null },
      },
    }),
  );
  await page.route('**/pos/orders/quote', async (route) => {
    const input = route.request().postDataJSON() as {
      items: Array<{
        lineId: string;
        quantity: number;
        variantId?: string;
        selections?: Array<{
          optionIds?: string[];
          optionQuantities?: Array<{ optionId: string; quantity: number }>;
        }>;
      }>;
    };
    const baseCents = (line: (typeof input.items)[number]) =>
      line.variantId === largeVariantId ? 4986 : 3486;
    const modifierCents = (line: (typeof input.items)[number]) => {
      const selections = line.selections ?? [];
      const options = selections.flatMap((selection) =>
        selection.optionQuantities?.length
          ? selection.optionQuantities
          : (selection.optionIds ?? []).map((optionId) => ({ optionId, quantity: 1 })),
      );
      return options.reduce(
        (sum, option) =>
          sum +
          (option.optionId === spicySauceId ? 250 : option.optionId === extraCheeseId ? 1000 : 0) *
            option.quantity,
        0,
      );
    };
    const totalCents = input.items.reduce(
      (sum, line) => sum + line.quantity * (baseCents(line) + modifierCents(line)),
      0,
    );
    const total = (totalCents / 100).toFixed(2);
    await route.fulfill({
      json: {
        currency: 'EGP',
        subtotal: total,
        total,
        items: input.items.map((line) => ({
          lineId: line.lineId,
          quantity: line.quantity,
          lineTotal: ((line.quantity * (baseCents(line) + modifierCents(line))) / 100).toFixed(2),
          quote: {
            productId,
            productRevision: 1,
            variantId: line.variantId ?? null,
            variantName: line.variantId === largeVariantId ? 'Large' : null,
            variantAttributes: [],
            currency: 'EGP',
            basePrice: (baseCents(line) / 100).toFixed(2),
            modifierTotal: (modifierCents(line) / 100).toFixed(2),
            totalPrice: ((baseCents(line) + modifierCents(line)) / 100).toFixed(2),
            selections: [],
          },
        })),
      },
    });
  });
  await page.route(`**/pos/orders/${orderId}`, (route) => route.fulfill({ json: confirmedOrder }));
  await page.route('**/pos/orders', (route) =>
    route.fulfill({
      status: 201,
      json: confirmedOrder,
    }),
  );
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ json: orderState }),
  );
  await page.route(`**/pos/orders/${orderId}/checks/${checkId}/receipt`, (route) =>
    route.fulfill({ json: receiptDocument() }),
  );
  await page.route('**/pos/receipts?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: receiptDocument().id,
            receiptNumber: receiptDocument().receiptNumber,
            issuedAt: receiptDocument().issuedAt,
            orderId,
            checkId,
            orderReference: receiptDocument().orderReference,
            checkNumber: 1,
            amount: '34.86',
            currency: 'EGP',
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/pos/orders/${orderId}/checks/${checkId}/payments`, async (route) => {
    postCount += 1;
    const request = route.request().postDataJSON() as Record<string, unknown>;
    paymentRequests.push(request);
    const body = request as { requestId: string; tenders: Array<{ amount: string }> };
    const savedResponse = processedPayments.get(body.requestId);
    if (savedResponse) {
      await route.fulfill({ status: 201, json: savedResponse });
      return;
    }
    const applied = body.tenders.reduce((sum, tender) => sum + Number(tender.amount), 0);
    const due = Math.max(0, 34.86 - applied).toFixed(2);
    const paid = (34.86 - Number(due)).toFixed(2);
    const payments = body.tenders.map((tender, index) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
      position: index,
      method: index === 0 ? 'cash' : 'terminal',
      amount: tender.amount,
      receivedAmount: tender.amount,
      changeAmount: '0.00',
      terminalReference: null,
      operatorEmployeeId: employeeId,
      createdAt: '2026-10-17T08:01:00.000Z',
    }));
    orderState.revision += 1;
    orderState.checks[0]!.paidAmount = paid;
    orderState.checks[0]!.balanceDue = due;
    orderState.checks[0]!.status = due === '0.00' ? 'settled' : 'open';
    orderState.checks[0]!.settledAt = due === '0.00' ? '2026-10-17T08:01:00.000Z' : null;
    const receipt = due === '0.00' ? receiptDocument() : null;
    orderState.checks[0]!.receipt = receipt
      ? { id: receipt.id, receiptNumber: receipt.receiptNumber, issuedAt: receipt.issuedAt }
      : null;
    orderState.checks[0]!.revision += 1;
    orderState.checks[0]!.payments.push(...payments);
    const response = {
      orderId,
      orderRevision: orderState.revision,
      check: {
        id: checkId,
        amount: '34.86',
        paidAmount: paid,
        balanceDue: due,
        revision: orderState.checks[0]!.revision,
        status: due === '0.00' ? 'settled' : 'open',
        settledAt: due === '0.00' ? '2026-10-17T08:01:00.000Z' : null,
        receipt: orderState.checks[0]!.receipt,
      },
      payments,
      receipt,
    };
    processedPayments.set(body.requestId, response);
    if (interruptFirstPayment && postCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: 201, json: response });
  });

  await page.goto('/catalog');
  if (catalogOnly) {
    return {
      paymentRequests,
      processedPaymentCount: () => orderState.checks[0]!.payments.length,
    };
  }
  await page.getByRole('button', { name: 'Add item: Test coffee', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await showOrder(page);
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  if (arabic) await page.getByRole('button', { name: 'Change language' }).click();
  const takePaymentName = arabic ? 'تحصيل مبلغ' : 'Take payment';
  await page.getByRole('button', { name: takePaymentName, exact: true }).click();
  await expect(page.getByRole('dialog', { name: takePaymentName })).toBeVisible();
  return {
    paymentRequests,
    processedPaymentCount: () => orderState.checks[0]!.payments.length,
  };
}

function receiptDocument() {
  return {
    version: 1,
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    receiptNumber: 'POS-AB12CD34EF56AB78',
    issuedAt: '2026-10-17T08:01:00.000Z',
    merchantName: 'Waffarly Cafe',
    branchName: 'Main branch',
    orderId,
    orderReference: 'ORD-55555555',
    orderCreatedAt: '2026-10-17T08:00:00.000Z',
    fulfillmentType: 'takeaway',
    tableCode: null,
    cashierName: 'Cashier',
    registerName: 'Front register',
    currency: 'EGP',
    checkNumber: 1,
    splitMethod: 'whole',
    amount: '34.86',
    items: [
      {
        name: 'Test coffee',
        variantName: null,
        selections: [],
        quantity: 1,
        unitPrice: '34.86',
        total: '34.86',
      },
    ],
    payments: [{ method: 'cash', amount: '34.86', receivedAmount: '35.00', changeAmount: '0.14' }],
    paidAmount: '34.86',
    cashReceivedAmount: '35.00',
    changeAmount: '0.14',
  };
}

test('live POS uses the prototype workspace design with the real catalog and saved drafts', async ({
  page,
}) => {
  await openCheckout(page, false, false, true);

  await expect(page.getByRole('navigation', { name: 'POS navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New sale' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add item: Test coffee', exact: true }),
  ).toBeVisible();
  await showOrder(page);
  await expect(page.locator('.pos-live-cart')).toBeVisible();
  await showMenu(page);
  await expect(page.locator('.pos-draft-dock')).toBeVisible();
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'orange');

  await page.getByLabel('Theme').selectOption('light');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'POS accent preview' }).click();
  await page.getByRole('button', { name: 'Teal', exact: true }).click();
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'teal');
  await page.reload();
  await expect(page.getByLabel('Theme')).toHaveValue('light');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'teal');

  await page.locator('.pos-workspace-language').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const rail = await page.locator('.pos-workspace-rail').boundingBox();
  expect(rail).not.toBeNull();
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    expect(rail!.x).toBe(0);
    expect(rail!.y).toBeGreaterThan((page.viewportSize()?.height ?? 844) - 100);
  } else {
    expect(rail!.x).toBeGreaterThan(1000);
  }
  await page.locator('.pos-workspace-language').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: 'POS accent preview' }).click();
  await page.getByRole('button', { name: 'Orange', exact: true }).click();
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'orange');
  await page.getByLabel('Theme').selectOption('dark');

  await page.getByRole('button', { name: 'Add item: Test coffee', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await showOrder(page);
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(1);
  await expect(page.locator('.pos-draft-tab.is-active')).toContainText('1 items');
  await page.locator('.pos-item-note-editor summary').click();
  await page.getByRole('textbox', { name: 'Item note for Test coffee' }).fill('no sugar');
  await expect(page.locator('.pos-item-note-editor summary')).toContainText('no sugar');
  await page.getByRole('button', { name: 'New order', exact: true }).first().click();
  await expect(page.locator('.pos-draft-tab')).toHaveCount(2);
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(0);
  await page.getByRole('button', { name: /^All orders/ }).click();
  const savedDrafts = page.getByRole('dialog', { name: 'Saved orders' });
  await savedDrafts
    .getByRole('button', { name: /^Resume draft/ })
    .last()
    .click();
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: 'New order', exact: true }).first().click();
  await page.getByRole('button', { name: 'New order', exact: true }).first().click();
  await page.getByRole('button', { name: 'New order', exact: true }).first().click();
  await expect(page.locator('.pos-draft-tab')).toHaveCount(2);
  await page.getByRole('button', { name: /^All orders/ }).click();
  await expect(savedDrafts.getByRole('button', { name: /^Resume draft/ })).toHaveCount(2);
  await savedDrafts
    .getByRole('button', { name: /^Resume draft/ })
    .last()
    .click();
  await expect(page.locator('.pos-live-cart-line')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/pos-live-catalog.png', fullPage: true });
});

test('configurable products show variants, required choices, extras, and the estimated price', async ({
  page,
}, testInfo) => {
  await openCheckout(page, false, false, true, false, true);

  const product = page.getByRole('button', { name: 'Customize item: Test burger', exact: true });
  await expect(product).toBeVisible();
  await product.click();

  const dialog = page.getByRole('dialog', { name: 'Test burger' });
  await expect(dialog).toBeVisible();
  const configurator = dialog.getByTestId('pos-product-configurator');
  await expect(configurator.getByRole('group', { name: 'Choose a size' })).toContainText('Large');
  await expect(configurator.getByRole('group', { name: 'Sauce' })).toContainText('Required');
  await expect(configurator.getByRole('group', { name: 'Extras' })).toContainText('Optional');
  await expect(configurator.getByLabel('Classic sauce')).toBeChecked();

  await configurator.getByLabel('Large').check();
  await configurator.getByLabel('Spicy mayo').check();
  await configurator.getByLabel('Extra cheese').check();
  await configurator.getByRole('button', { name: 'Add one Extra cheese' }).click();
  await expect(dialog.getByTestId('pos-configured-item-total')).toContainText('72.36');
  await page.screenshot({ path: testInfo.outputPath('product-options-configurator.png') });

  await dialog.getByRole('button', { name: /Add item/ }).click();
  await expect(dialog).toHaveCount(0);
  await showOrder(page);
  const line = page.locator('.pos-live-cart-line');
  await expect(line).toContainText('Large');
  await expect(line).toContainText('Spicy mayo');
  await expect(line).toContainText('Extra cheese ×2');
  await expect(line).toContainText('EGP 72.36');

  await page.getByRole('button', { name: 'Increase quantity: Test burger', exact: true }).click();
  await expect(line).toContainText('EGP 144.72');
  await line.locator('summary').click();
  await page.getByRole('textbox', { name: 'Item note for Test burger' }).fill('No onion');

  await page.getByRole('button', { name: 'Edit options: Test burger', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Test burger' });
  const editConfigurator = editDialog.getByTestId('pos-product-configurator');
  await expect(editConfigurator.getByLabel('Large')).toBeChecked();
  await expect(editConfigurator.getByLabel('Spicy mayo')).toBeChecked();
  await expect(editConfigurator.getByLabel('Classic sauce')).not.toBeChecked();
  await expect(editConfigurator.getByRole('checkbox', { name: /Extra cheese/ })).toBeChecked();
  await expect(editConfigurator.getByRole('group', { name: 'Extras' })).toContainText('2');
  await editConfigurator.getByLabel('Classic sauce').check();
  await expect(editDialog.getByTestId('pos-configured-item-total')).toContainText('69.86');
  await editDialog.getByRole('button', { name: /Save changes/ }).click();
  await expect(editDialog).toHaveCount(0);
  await expect(line).toContainText('Large');
  await expect(line).toContainText('Classic sauce');
  await expect(line).not.toContainText('Spicy mayo');
  await expect(line).toContainText('Extra cheese ×2');
  await expect(line).toContainText('EGP 139.72');
  await expect(line).toContainText('No onion');

  await page.getByRole('button', { name: 'Edit options: Test burger', exact: true }).click();
  const cancelledEdit = page.getByRole('dialog', { name: 'Test burger' });
  const cancelledConfigurator = cancelledEdit.getByTestId('pos-product-configurator');
  await expect(cancelledConfigurator.getByLabel('Classic sauce')).toBeChecked();
  await cancelledConfigurator.getByLabel('Spicy mayo').check();
  await cancelledEdit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cancelledEdit).toHaveCount(0);
  await expect(line).toContainText('Classic sauce');
  await expect(line).not.toContainText('Spicy mayo');
  await expect(line).toContainText('EGP 139.72');
  await expect(line).toContainText('No onion');
  await page.screenshot({ path: testInfo.outputPath('configured-cart-line-edit-action.png') });
});

test('saved orders remain searchable and contained with fifty drafts; cleanup protects pending sales', async ({
  page,
}, testInfo) => {
  await openCheckout(page, false, false, true);
  await expect(page.locator('.pos-draft-tab.is-active')).toHaveCount(1);
  await page.evaluate(
    ({ orderId }) => {
      const key = Object.keys(localStorage).find((entry) =>
        entry.startsWith('waffarly:pos:workspace:v1:'),
      )!;
      const envelope = JSON.parse(localStorage.getItem(key)!);
      const base = Object.values(envelope.workspace.drafts)[0] as Record<string, unknown>;
      const now = new Date().toISOString();
      const id = (index: number) =>
        `${index.toString().padStart(6, '0')}-0000-4000-8000-000000000000`;
      envelope.workspace.drafts = Object.fromEntries(
        Array.from({ length: 50 }, (_, index) => [
          id(index),
          {
            ...base,
            id: id(index),
            createdAt: now,
            updatedAt: now,
            customerName:
              index >= 40 ? `Customer ${index} with a very long name for layout review` : '',
          },
        ]),
      );
      envelope.workspace.selectedDraftId = id(49);
      envelope.workspace.pendingSales = {
        [id(0)]: {
          requestId: 'saved-sale',
          payload: {
            requestId: 'saved-sale',
            registerId: 'register',
            fulfillmentType: 'takeaway',
            items: [
              {
                lineId: 'line',
                productId: 'product',
                quantity: 1,
                expectedProductRevision: 1,
                selections: [],
              },
            ],
          },
        },
      };
      envelope.workspace.confirmedOrders = {
        [orderId]: { orderId, branchId: base.branchId, createdAt: now },
      };
      localStorage.setItem(key, JSON.stringify(envelope));
    },
    { orderId },
  );
  await page.reload();
  await page.getByRole('button', { name: /^All orders/ }).click();
  const picker = page.getByRole('dialog', { name: 'Saved orders' });
  await expect(picker.getByRole('button', { name: /^Resume draft/ })).toHaveCount(50);
  const list = picker.getByTestId('saved-orders-list');
  const metrics = await list.evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
  }));
  expect(metrics.client).toBeGreaterThan(80);
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  const bounds = await picker.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  if (page.viewportSize()!.width > 767) {
    const dock = await page.locator('.pos-draft-dock').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(dock!.y + 2);
  }
  await expect(
    picker.getByRole('button', { name: 'Delete draft DRAFT-000000', exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('fifty-drafts.png') });
  await picker.getByRole('textbox', { name: 'Search saved orders' }).fill('Customer 49');
  await expect(picker.getByRole('button', { name: /^Resume draft/ })).toHaveCount(1);
  await picker.getByRole('button', { name: 'Delete draft DRAFT-000049', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete draft?' });
  await expect(confirm).toContainText('Customer 49');
  await confirm.getByRole('button', { name: 'Keep draft' }).click();
  await expect(page.getByRole('button', { name: /^All orders/ })).toBeFocused();
  await page.getByRole('button', { name: /^All orders/ }).click();
  await picker.getByRole('button', { name: 'Remove empty drafts (39)' }).click();
  await expect(picker.getByRole('button', { name: /^Resume draft/ })).toHaveCount(11);
  await expect(
    picker.getByRole('button', { name: 'Delete draft DRAFT-000000', exact: true }),
  ).toBeDisabled();
  await picker.getByRole('textbox', { name: 'Search saved orders' }).fill('Customer 49');
  await picker.getByRole('button', { name: 'Delete draft DRAFT-000049', exact: true }).click();
  await confirm.getByRole('button', { name: 'Delete draft', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /^All orders/ }).click();
  await expect(picker.getByRole('button', { name: /^Resume draft/ })).toHaveCount(10);
  await picker.getByRole('button', { name: /^Confirmed orders/ }).click();
  await expect(picker.getByRole('button', { name: /^Open confirmed order/ })).toHaveCount(1);
  await expect(picker.getByRole('button', { name: /^Delete draft/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByLabel('Theme').selectOption('light');
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.locator('.pos-draft-dock button[aria-haspopup="dialog"]').click();
  await expect(page.getByRole('dialog', { name: 'الطلبات المحفوظة' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('saved-orders-ar-light.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('confirmed order survives reload and draft switching without creating another sale', async ({
  page,
}, testInfo) => {
  let creations = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/pos/orders')
      creations++;
  });
  await openCheckout(page);
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  const panel = page.getByTestId('confirmed-order-panel');
  await expect(panel).toContainText('Test coffee');
  await expect(panel).toContainText('no sugar');
  await expect(panel).toContainText('Guest One');
  await expect(panel.getByRole('status').first()).toHaveText('Unpaid');
  await expect(page.locator('.pos-draft-tab.is-active')).toHaveCount(1);
  await page.reload();
  await expect(panel.getByRole('button', { name: 'Take payment', exact: true })).toBeEnabled();
  await expect(panel).toContainText('ORD-55555555');
  await panel.getByRole('button', { name: 'Start another order' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.pos-draft-tab')).toHaveCount(2);
  await page.getByRole('button', { name: /^All orders/ }).click();
  await page
    .getByRole('dialog', { name: 'Saved orders' })
    .getByRole('button', { name: /^Confirmed orders/ })
    .click();
  await page
    .getByRole('button', { name: 'Open confirmed order ORD-55555555', exact: true })
    .click();
  await expect(panel).toContainText('Test coffee');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('confirmed-order.png'), fullPage: true });
  await page.getByLabel('Theme').selectOption('light');
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(panel).toContainText('Test coffee');
  await page.screenshot({
    path: testInfo.outputPath('confirmed-order-ar-light.png'),
    fullPage: true,
  });
  expect(creations).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unverified payment state blocks collection and recovers with retry', async ({ page }) => {
  await openCheckout(page);
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  );
  await page.reload();
  const panel = page.getByTestId('confirmed-order-panel');
  await expect(panel.getByRole('alert')).toContainText('Could not verify payment status');
  await expect(panel.getByRole('button', { name: 'Take payment', exact: true })).toBeDisabled();
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ json: paymentState() }),
  );
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Take payment', exact: true })).toBeEnabled();
});

test('a denied order read hides its cached details and blocks collection', async ({ page }) => {
  await openCheckout(page);
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  await page.route(`**/pos/orders/${orderId}`, (route) =>
    route.fulfill({ status: 403, json: { message: 'Access denied' } }),
  );
  await page.reload();
  const panel = page.getByTestId('confirmed-order-panel');
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Take payment', exact: true })).toBeDisabled();
  await expect(panel.getByText('Test coffee', { exact: true })).toHaveCount(0);
});

test('cashier records a split cash and terminal payment and sees the remaining balance', async ({
  page,
}) => {
  const { paymentRequests } = await openCheckout(page);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });

  await dialog.getByLabel('Amount for payment 1').fill('5.00');
  await dialog.getByLabel('Cash received for payment 1').fill('10.00');
  await dialog.getByRole('button', { name: 'Add payment method' }).click();
  await dialog.getByLabel('Amount for payment 2').fill('3.00');
  await expect(dialog.getByText('26.86', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Record partial payment' }).click();

  await expect(dialog.getByRole('status').filter({ hasText: 'Payment recorded' })).toBeVisible();
  await expect(dialog.getByText('26.86', { exact: false }).first()).toBeVisible();
  expect(paymentRequests).toHaveLength(1);
  expect(paymentRequests[0]).toMatchObject({
    revision: 1,
    tenders: [
      { method: 'cash', amount: '5.00', receivedAmount: '10.00' },
      { method: 'terminal', amount: '3.00' },
    ],
  });
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  const panel = page.getByTestId('confirmed-order-panel');
  await expect(panel.getByRole('status').first()).toHaveText('Partially paid');
  await expect(panel).toContainText('26.86');
  await page.reload();
  await expect(panel.getByRole('status').first()).toHaveText('Partially paid');
  await expect(panel).toContainText('26.86');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('cashier retries an uncertain payment with the exact same command ID', async ({ page }) => {
  const { paymentRequests, processedPaymentCount } = await openCheckout(page, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByRole('button', { name: 'Settle check' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Retry this exact payment');
  await dialog.getByRole('button', { name: 'Retry the same payment' }).click();
  const receipt = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receipt.getByText('Waffarly Cafe')).toBeVisible();
  await expect(receipt.getByText('POS-AB12CD34EF56AB78').first()).toBeVisible();
  expect(paymentRequests).toHaveLength(2);
  expect(paymentRequests[1]!.requestId).toBe(paymentRequests[0]!.requestId);
  expect(paymentRequests[1]!.tenders).toEqual(paymentRequests[0]!.tenders);
  expect(processedPaymentCount()).toBe(1);
});

test('cashier can open the saved receipt and print or save it as a PDF', async ({ page }) => {
  const { paymentRequests } = await openCheckout(page);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printRequested = 'true';
    };
  });
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Settle check' })
    .click();

  const receipt = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receipt.getByText('Waffarly Cafe')).toBeVisible();
  await expect(receipt.getByText('POS-AB12CD34EF56AB78').first()).toBeVisible();
  await expect(receipt.getByText('Test coffee')).toBeVisible();
  await expect(receipt.getByText('EGP 0.14')).toBeVisible();
  await receipt.getByRole('button', { name: 'Print / Save PDF' }).click();
  await expect.poll(() => page.locator('body').getAttribute('data-print-requested')).toBe('true');
  await page.emulateMedia({ media: 'print' });
  const printLayout = await page.locator('.pos-receipt-document').evaluate((document) => ({
    styles: Array.from(document.ownerDocument.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join('\n'),
    actionsDisplay: getComputedStyle(
      document.parentElement!.querySelector('.pos-receipt-screen-actions')!,
    ).display,
  }));
  expect(printLayout.styles).toContain('80mm');
  expect(printLayout.styles).toContain('76mm');
  expect(printLayout.actionsDisplay).toBe('none');
  await page.emulateMedia({ media: 'screen' });
  expect(paymentRequests).toHaveLength(1);

  await receipt.getByRole('button', { name: 'Back to checkout' }).click();
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Done' })
    .click();
  const panel = page.getByTestId('confirmed-order-panel');
  await expect(panel.getByRole('status').first()).toHaveText('Paid');
  await expect(panel.getByRole('button', { name: 'Take payment', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'View / print receipt', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'POS receipt' })).toContainText(
    'POS-AB12CD34EF56AB78',
  );
  await page
    .getByRole('dialog', { name: 'POS receipt' })
    .getByRole('button', { name: 'Done' })
    .click();
  expect(paymentRequests).toHaveLength(1);
  await page.getByRole('link', { name: 'Receipts' }).click();
  await expect(page.getByRole('heading', { name: 'Receipts', exact: true })).toBeVisible();
  await page.reload();
  const savedReceipt = page.getByRole('article').filter({ hasText: 'POS-AB12CD34EF56AB78' });
  await expect(savedReceipt).toBeVisible();
  await savedReceipt.getByRole('button', { name: 'View / print receipt' }).click();
  await expect(page.getByText('Test coffee')).toBeVisible();
});

test('a failed print dialog keeps the saved receipt and does not collect payment again', async ({
  page,
}) => {
  const { paymentRequests } = await openCheckout(page);
  await page.evaluate(() => {
    window.print = () => {
      throw new Error('The print dialog is unavailable.');
    };
  });
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Settle check' })
    .click();

  const receipt = page.getByRole('dialog', { name: 'POS receipt' });
  await expect(receipt.getByText('POS-AB12CD34EF56AB78').first()).toBeVisible();
  await receipt.getByRole('button', { name: 'Print / Save PDF' }).click();
  await expect(receipt.getByRole('alert')).toContainText('Your receipt is saved');
  await expect(receipt.getByText('Test coffee')).toBeVisible();
  expect(paymentRequests).toHaveLength(1);

  await receipt.getByRole('button', { name: 'Back to checkout' }).click();
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Done' })
    .click();
  await page.getByRole('link', { name: 'Receipts' }).click();
  await page.reload();
  const savedReceipt = page.getByRole('article').filter({ hasText: 'POS-AB12CD34EF56AB78' });
  await expect(savedReceipt).toBeVisible();
  await savedReceipt.getByRole('button', { name: 'View / print receipt' }).click();
  await expect(page.getByText('Test coffee')).toBeVisible();
  expect(paymentRequests).toHaveLength(1);
});

test('cashier recovers a committed payment after navigating and reloading', async ({ page }) => {
  const { paymentRequests, processedPaymentCount } = await openCheckout(page, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByRole('button', { name: 'Settle check' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Retry this exact payment');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();

  await page.getByRole('link', { name: 'Tables' }).click();
  await expect(page.getByRole('heading', { name: 'Tables & open sessions' })).toBeVisible();
  const recoveryNotice = page.locator('section[aria-label="Payments needing confirmation"]');
  await expect(recoveryNotice).toContainText('Order #55555555');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(recoveryNotice).toContainText('Order #55555555');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(paymentRequests).toHaveLength(1);

  await page.getByRole('button', { name: 'Change language' }).click();
  const arabicRecoveryNotice = page.locator('section[aria-label="دفعات تحتاج إلى تأكيد"]');
  await expect(arabicRecoveryNotice).toContainText('تحتاج الدفعات إلى تأكيد');
  await page.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }).first().click();
  const recoveredDialog = page.getByRole('dialog', { name: 'تحصيل مبلغ' });
  await expect(recoveredDialog.getByText('EGP 0.00')).toBeVisible();
  await expect(recoveredDialog.getByRole('status')).toContainText('على هذا الجهاز');
  await expect(
    recoveredDialog.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-payment-recovery-mobile.png' });
  await recoveredDialog.getByRole('button', { name: 'التحقق من النتيجة المحفوظة' }).click();
  const recoveredReceipt = page.getByRole('dialog', { name: 'إيصال نقاط البيع' });
  await expect(recoveredReceipt.getByText('Waffarly Cafe')).toBeVisible();
  await expect(recoveredReceipt.getByText('Test coffee')).toBeVisible();
  await expect(arabicRecoveryNotice).toHaveCount(0);
  expect(paymentRequests).toHaveLength(2);
  expect(paymentRequests[1]!.requestId).toBe(paymentRequests[0]!.requestId);
  expect(paymentRequests[1]!.tenders).toEqual(paymentRequests[0]!.tenders);
  expect(processedPaymentCount()).toBe(1);
});

test('checkout shows customer, service, frozen item notes and reference before collection', async ({
  page,
}, testInfo) => {
  const { paymentRequests } = await openCheckout(page);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(dialog.getByTestId('checkout-order-identity')).toContainText('Guest One');
  await expect(dialog.getByTestId('checkout-order-identity')).toContainText('Takeaway');
  await expect(dialog).toContainText('ORD-55555555');
  const context = dialog.getByTestId('checkout-order-context');
  await expect(context).toContainText('Whole order');
  await context.locator('summary').click();
  await expect(context.getByRole('article')).toContainText('Test coffee');
  await expect(context.getByRole('article')).toContainText('no sugar');
  await page.screenshot({ path: testInfo.outputPath('checkout-context.png') });
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeInViewport();
  expect(paymentRequests).toHaveLength(0);
});

test('checkout switches allocated quantities and labels amount shares as order reference only', async ({
  page,
}, testInfo) => {
  await openCheckout(page, false, false, true);
  const secondId = '99999999-9999-4999-8999-999999999999';
  const contextOrder = {
    ...confirmedOrder,
    customerName: 'Dining guest',
    fulfillmentType: 'dine_in',
    lines: [
      {
        ...confirmedOrder.lines[0]!,
        variantName: 'Large',
        quantity: 2,
        lineTotal: '20.00',
        selections: [{ groupName: 'Milk', optionName: 'Oat', quantity: 1 }],
      },
      {
        ...confirmedOrder.lines[0]!,
        id: 'tea-line',
        productName: 'Tea',
        note: 'no ice',
        quantity: 1,
        lineTotal: '14.86',
      },
    ],
  };
  const state = {
    ...paymentState(),
    context: { order: contextOrder, tableCode: 'T04' },
    checks: [
      {
        ...paymentState().checks[0]!,
        amount: '10.00',
        balanceDue: '10.00',
        splitMethod: 'items',
        allocations: [
          {
            orderLineId: 'line-confirmed',
            productName: 'Test coffee',
            variantName: 'Large',
            quantity: 1,
            amount: '10.00',
          },
        ],
      },
      {
        ...paymentState().checks[0]!,
        id: secondId,
        position: 1,
        amount: '24.86',
        balanceDue: '24.86',
        splitMethod: 'items',
        allocations: [
          {
            orderLineId: 'line-confirmed',
            productName: 'Test coffee',
            variantName: 'Large',
            quantity: 1,
            amount: '10.00',
          },
          {
            orderLineId: 'tea-line',
            productName: 'Tea',
            variantName: null,
            quantity: 1,
            amount: '14.86',
          },
        ],
      },
    ],
  };
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ json: state }),
  );
  await page.getByRole('button', { name: 'Add item: Test coffee', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await showOrder(page);
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click();
  await page.getByRole('button', { name: 'Take payment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  const context = dialog.getByTestId('checkout-order-context');
  await expect(dialog.getByTestId('checkout-order-identity')).toContainText('T04');
  await expect(dialog.getByTestId('checkout-order-identity')).toContainText('Dining guest');
  await context.locator('summary').click();
  await expect(context.getByRole('article')).toHaveCount(1);
  await expect(context.getByRole('article')).toContainText('×1');
  await expect(context.getByRole('article')).toContainText('Large');
  await expect(context.getByRole('article')).toContainText('Milk: Oat');
  await expect(context.getByRole('article')).toContainText('EGP 10.00');
  await expect(context).not.toContainText('Tea');
  await dialog.getByLabel('Choose check').selectOption(secondId);
  await context.locator('summary').click();
  await expect(context.getByRole('article')).toHaveCount(2);
  await expect(context).toContainText('no ice');
  await expect(dialog.getByRole('region', { name: 'Check balance' })).toContainText('EGP 24.86');
  await page.screenshot({ path: testInfo.outputPath('allocated-check-context.png') });
  for (const method of ['equal', 'custom']) {
    for (const check of state.checks) {
      check.splitMethod = method;
      check.allocations = [];
      check.amount = '17.43';
      check.balanceDue = '17.43';
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Take payment', exact: true }).click();
    await expect(context).toContainText('Items below are order reference only.');
    await context.locator('summary').click();
    await expect(context.getByRole('article')).toHaveCount(2);
    await expect(context).not.toContainText('EGP 20.00');
    await expect(dialog.getByRole('region', { name: 'Check balance' })).toContainText('EGP 17.43');
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Theme').selectOption('light');
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('button', { name: 'تحصيل مبلغ', exact: true }).click();
  const arabic = page.getByRole('dialog', { name: 'تحصيل مبلغ' });
  await expect(arabic).toContainText('حصة من إجمالي الطلب');
  await page.screenshot({ path: testInfo.outputPath('share-context-ar-light.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('older payment responses explain unavailable order context without inventing allocations', async ({
  page,
}) => {
  await openCheckout(page);
  await page
    .getByRole('dialog', { name: 'Take payment' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  const { context: omitted, ...legacy } = paymentState();
  void omitted;
  await page.route(`**/pos/orders/${orderId}/payment-state`, (route) =>
    route.fulfill({ json: legacy }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Take payment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(dialog.getByRole('region', { name: 'Order details' })).toContainText(
    'Verify the order reference before collecting.',
  );
  await expect(dialog.getByTestId('checkout-order-identity')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeEnabled();
});

test('mixed tender validation explains over-allocation and preserves the corrected proposal', async ({
  page,
}, testInfo) => {
  const { paymentRequests } = await openCheckout(page);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByRole('button', { name: 'Add payment method' }).click();
  const terminal = dialog.getByLabel('Amount for payment 2');
  await expect(terminal).toHaveAttribute('aria-invalid', 'true');
  await expect(terminal).toHaveAccessibleDescription(
    'Enter a positive amount with up to two decimal places.',
  );
  await terminal.fill('10.00');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Payment cannot exceed the remaining balance.',
  );
  const review = dialog.getByRole('button', { name: 'Review payment amounts', exact: true });
  await expect(review).toBeDisabled();
  await expect(review).toHaveAccessibleDescription('Payment cannot exceed the remaining balance.');
  await expect(dialog.getByLabel('Amount for payment 1')).toHaveValue('34.86');
  await expect(dialog.getByRole('button', { name: 'Record partial payment' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('overallocated-payment.png') });
  await dialog.getByLabel('Amount for payment 1').fill('20.00');
  await dialog.getByLabel('Cash received for payment 1').fill('25.00');
  await terminal.fill('14.86');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeEnabled();
  await expect(dialog.locator('footer')).toContainText('EGP 34.86');
  await expect(dialog.locator('footer')).toContainText('EGP 0.00');
  await expect(dialog.locator('footer')).toContainText('EGP 5.00');
  await page.screenshot({ path: testInfo.outputPath('corrected-payment.png') });
  await dialog.getByRole('button', { name: 'Remove payment method 2' }).click();
  await expect(dialog.getByRole('button', { name: 'Record partial payment' })).toBeEnabled();
  await expect(dialog.getByLabel('Cash received for payment 1')).toHaveValue('25.00');
  expect(paymentRequests).toHaveLength(0);
});

test('field validation links errors to cash and terminal inputs in Arabic and both themes', async ({
  page,
}, testInfo) => {
  const { paymentRequests } = await openCheckout(page);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await dialog.getByLabel('Cash received for payment 1').fill('1.00');
  const cash = dialog.getByLabel('Cash received for payment 1');
  await expect(cash).toHaveAttribute('aria-invalid', 'true');
  await expect(cash).toHaveAccessibleDescription('Cash received must cover the payment amount.');
  await dialog.getByRole('button', { name: 'Add payment method' }).click();
  await dialog.getByLabel('Amount for payment 2').fill('1.009');
  await expect(dialog.getByLabel('Amount for payment 2')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: 'Review payment amounts' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Theme').selectOption('light');
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('button', { name: 'تحصيل مبلغ', exact: true }).click();
  const localized = page.getByRole('dialog');
  await localized.locator('input').last().fill('0.01');
  await expect(localized.locator('input[aria-invalid="true"]')).toHaveCount(1);
  await expect(localized.getByRole('alert')).toContainText('راجع');
  await expect(localized.getByRole('button', { name: 'راجع مبالغ الدفع' })).toBeDisabled();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: testInfo.outputPath('cash-error-ar-light.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(paymentRequests).toHaveLength(0);
});

test('mobile and tablet selling preserve menu scroll and draft notes when switching views', async ({
  page,
}, testInfo) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await openCheckout(page, false, false, true);
    await page.route('**/pos/catalog**', (route) =>
      route.fulfill({
        json: {
          categories: { items: [], nextCursor: null },
          products: {
            items: Array.from({ length: 30 }, (_, index) => ({
              id: index ? `product-${index}` : productId,
              name: index ? `Coffee ${index}` : 'Test coffee',
              description: null,
              basePrice: '34.86',
              currency: 'EGP',
              sellingUnit: 'piece',
              images: [],
              categories: [],
              modifierGroups: [],
              variants: [],
            })),
            nextCursor: null,
          },
        },
      }),
    );
    await page.reload();
    const menu = page.getByTestId('pos-menu-pane');
    const order = page.getByTestId('pos-order-pane');
    const navigation = page.getByTestId('pos-mobile-navigation');
    await expect(menu).toBeVisible();
    await expect(order).toBeHidden();
    await expect(navigation).toBeInViewport();
    await page.getByRole('button', { name: 'Add item: Test coffee', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(navigation).toContainText('EGP 34.86');
    await menu.evaluate((element) => {
      element.scrollTop = 500;
    });
    await showOrder(page);
    await expect(menu).toBeHidden();
    await expect(order).toBeVisible();
    await page.locator('.pos-item-note-editor summary').click();
    await page.getByLabel('Item note for Test coffee').fill('less sugar');
    await showMenu(page);
    await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBe(500);
    await page.screenshot({ path: testInfo.outputPath(`mobile-menu-${width}.png`) });
    await showOrder(page);
    await expect(page.getByLabel('Item note for Test coffee')).toHaveValue('less sugar');
    await expect(page.getByRole('button', { name: 'Confirm order', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`mobile-order-${width}.png`) });
    await page.getByLabel('Theme').selectOption('light');
    await page.locator('.pos-workspace-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(navigation).toContainText('عرض الطلب');
    await page.screenshot({ path: testInfo.outputPath(`mobile-order-ar-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.pos-workspace-language').click();
    await page.getByLabel('Theme').selectOption('dark');
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((entry) =>
        entry.startsWith('waffarly:pos:workspace:v1:'),
      )!;
      const envelope = JSON.parse(localStorage.getItem(key)!);
      const draft = envelope.workspace.drafts[envelope.workspace.selectedDraftId];
      const line = draft.lines[0];
      draft.lines = Array.from({ length: 20 }, (_, index) => ({
        ...line,
        id: crypto.randomUUID(),
        note: index ? `Note ${index}` : 'less sugar',
      }));
      localStorage.setItem(key, JSON.stringify(envelope));
    });
    await page.reload();
    await showOrder(page);
    const orderScroll = page.locator('[data-pos-order-scroll]');
    await orderScroll.evaluate((element) => {
      element.scrollTop = 300;
    });
    await showMenu(page);
    await showOrder(page);
    await expect.poll(() => orderScroll.evaluate((element) => element.scrollTop)).toBe(300);
    await expect(navigation).toContainText('EGP 697.20');
    // Return to a blank workspace for the next viewport using isolated fixture storage.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage))
        if (key.startsWith('waffarly:pos:workspace:v1:')) localStorage.removeItem(key);
    });
  }
});

test('checkout keeps the focused cash field and action above a simulated on-screen keyboard', async ({
  page,
}, testInfo) => {
  const { paymentRequests } = await openCheckout(page, false, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  const received = dialog.getByLabel('Cash received for payment 1');
  await received.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 380 });
    Object.defineProperty(window.visualViewport!, 'offsetTop', { configurable: true, value: 40 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await received.fill('40.00');
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeEnabled();
  await expect
    .poll(async () => (await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height)
    .toBeLessThanOrEqual(420);
  const action = await dialog.getByRole('button', { name: 'Settle check' }).boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(420);
  await expect
    .poll(async () => {
      const field = await received.boundingBox();
      const area = await dialog.locator('[data-checkout-scroll]').boundingBox();
      return field!.y >= area!.y && field!.y + field!.height <= area!.y + area!.height;
    })
    .toBe(true);
  const field = await received.boundingBox();
  const scrollArea = await dialog.locator('[data-checkout-scroll]').boundingBox();
  expect(field!.y).toBeGreaterThanOrEqual(40);
  expect(field!.y + field!.height).toBeLessThanOrEqual(action!.y);
  expect(field!.y).toBeGreaterThanOrEqual(scrollArea!.y);
  expect(field!.y + field!.height).toBeLessThanOrEqual(scrollArea!.y + scrollArea!.height);
  await page.screenshot({ path: testInfo.outputPath('checkout-keyboard-area.png') });
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    Reflect.deleteProperty(window.visualViewport!, 'offsetTop');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(received).toHaveValue('40.00');
  await expect(dialog.getByText('Change to return')).toBeVisible();
  expect(paymentRequests).toHaveLength(0);
});

test('checkout keeps the due amount and primary action visible on a narrow screen', async ({
  page,
}) => {
  await openCheckout(page, false, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });
  await expect(dialog.getByText('Remaining balance')).toBeVisible();
  await expect(dialog.getByText('Balance after payment')).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-checkout-mobile.png' });
});

test('checkout keeps the order and due summary visible while scrolling split tenders', async ({
  page,
}) => {
  await openCheckout(page, false, true);
  const dialog = page.getByRole('dialog', { name: 'Take payment' });

  for (let index = 0; index < 3; index += 1) {
    await dialog.getByRole('button', { name: 'Add payment method' }).click();
  }
  await dialog.getByLabel('Amount for payment 1').fill('31.86');
  await dialog.getByLabel('Amount for payment 2').fill('1.00');
  await dialog.getByLabel('Amount for payment 3').fill('1.00');
  await dialog.getByLabel('Amount for payment 4').fill('1.00');

  const balance = dialog.getByRole('region', { name: 'Check balance' });
  const scrollArea = dialog.locator('form > div.overflow-y-auto');
  await expect(balance.getByText('Remaining balance')).toBeInViewport();
  await balance.getByText('Balance details', { exact: true }).click();
  await expect(balance.getByText('Order total')).toBeVisible();
  await balance.getByText('Balance details', { exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeInViewport();

  const scrollMetrics = await scrollArea.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await scrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(balance.getByText('Remaining balance')).toBeInViewport();
  await expect(balance.getByRole('strong')).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Settle check' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-checkout-split-mobile.png' });
});

test('checkout labels and amount hierarchy stay readable in Arabic RTL', async ({ page }) => {
  await openCheckout(page, false, true, false, true);
  const dialog = page.getByRole('dialog', { name: 'تحصيل مبلغ' });
  const balance = dialog.getByRole('region', { name: 'رصيد الحساب' });
  const paymentMethods = dialog.getByRole('region', { name: 'وسائل الدفع' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await balance.locator('summary').click();
  await expect(balance).toContainText('إجمالي الطلب');
  await expect(balance).toContainText('المتبقي');
  await expect(paymentMethods.getByRole('button', { name: 'إضافة وسيلة دفع' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'سداد الحساب' })).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(/\?{3,}/);
  await page.screenshot({ path: 'test-results/pos-checkout-arabic-mobile.png' });
});
