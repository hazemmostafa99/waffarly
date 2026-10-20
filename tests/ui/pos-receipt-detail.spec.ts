import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const checkId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const receiptNumber = 'POS-RCPT-0001049';

function makeReceipt(cashierName = 'Test cashier') {
  return {
    version: 1,
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    receiptNumber,
    issuedAt: '2026-10-17T08:01:00.000Z',
    merchantName: 'Waffarly Bakery & Cafe',
    branchName: 'Main branch',
    orderId,
    orderReference: 'ORD-1049',
    orderCreatedAt: '2026-10-17T08:00:00.000Z',
    fulfillmentType: 'dine_in',
    tableCode: 'T4',
    cashierName,
    registerName: 'Front register',
    currency: 'EGP',
    checkNumber: 2,
    splitMethod: 'items',
    amount: '175.00',
    items: [
      {
        name: 'Sweet Chocolate Croissant with Pistachio Cream',
        variantName: 'Large',
        selections: ['Extra pistachio', 'Oat milk'],
        quantity: 2,
        unitPrice: '55.00',
        total: '110.00',
      },
      {
        name: 'Iced caramel latte',
        variantName: null,
        selections: [],
        quantity: 1,
        unitPrice: '65.00',
        total: '65.00',
      },
    ],
    payments: [
      { method: 'cash', amount: '70.00', receivedAmount: '80.00', changeAmount: '10.00' },
      { method: 'terminal', amount: '105.00', receivedAmount: '105.00', changeAmount: '0.00' },
    ],
    paidAmount: '175.00',
    cashReceivedAmount: '80.00',
    changeAmount: '10.00',
  };
}

async function openSavedReceipt(
  page: import('@playwright/test').Page,
  actionLabel = 'View / print receipt',
  receiptLabel = 'POS receipt',
  cashierName = 'Test cashier',
) {
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Test cashier',
        role: 'cashier',
        permissions: ['sell'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
  await page.route('**/pos/receipts?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: makeReceipt().id,
            receiptNumber,
            issuedAt: makeReceipt().issuedAt,
            orderId,
            checkId,
            orderReference: 'ORD-1049',
            checkNumber: 2,
            amount: '175.00',
            currency: 'EGP',
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/pos/orders/${orderId}/checks/${checkId}/receipt`, (route) =>
    route.fulfill({ json: makeReceipt(cashierName) }),
  );

  await page.goto('/receipts');
  await page
    .getByRole('article', { name: receiptNumber })
    .getByRole('button', { name: actionLabel })
    .click();
  await expect(page.getByRole('article', { name: receiptLabel })).toBeVisible();
}

test('saved receipt presents frozen check details and prints only an 80mm paper area', async ({
  page,
}, testInfo) => {
  let paymentRequests = 0;
  await openSavedReceipt(page);
  await page.route('**/pos/orders/*/checks/*/payments', async (route) => {
    paymentRequests += 1;
    await route.fulfill({ status: 500, json: { message: 'Unexpected payment request' } });
  });

  const receipt = page.getByRole('article', { name: 'POS receipt' });
  await expect(receipt).toContainText('Waffarly Bakery & Cafe');
  await expect(receipt).toContainText('Test cashier');
  await expect(receipt).toContainText('ORD-1049');
  await expect(receipt).toContainText('T4');
  await expect(receipt).toContainText('Sweet Chocolate Croissant with Pistachio Cream');
  await expect(receipt).toContainText('Extra pistachio');
  await expect(receipt).toContainText('Oat milk');
  await expect(receipt).toContainText('External terminal');
  await expect(receipt).toContainText('Cash received');
  await expect(receipt).toContainText('Change to return');
  await expect(receipt).toContainText('175.00');

  const paper = await receipt.boundingBox();
  const actions = await page.locator('.pos-receipt-screen-actions').boundingBox();
  expect(paper).not.toBeNull();
  expect(actions).not.toBeNull();
  expect(paper!.width).toBeLessThanOrEqual(384);
  expect(actions!.width).toBe(paper!.width);
  if ((page.viewportSize()?.width ?? 0) < 600) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }

  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByRole('button', { name: 'Print / Save PDF' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect
    .poll(() => receipt.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(285);
  const printFacts = await receipt.evaluate((element) => {
    const paperStyle = getComputedStyle(element);
    const actionElement = document.querySelector('.pos-receipt-screen-actions');
    return {
      width: element.getBoundingClientRect().width,
      position: paperStyle.position,
      paperVisibility: paperStyle.visibility,
      paperBackground: paperStyle.backgroundColor,
      bodyWidth: Number.parseFloat(getComputedStyle(document.body).width),
      actionsDisplay: actionElement ? getComputedStyle(actionElement).display : 'missing',
    };
  });
  expect(printFacts.width).toBeGreaterThan(285);
  expect(printFacts.position).toBe('fixed');
  expect(printFacts.width).toBeLessThan(290);
  expect(printFacts.bodyWidth).toBeGreaterThan(300);
  expect(printFacts.bodyWidth).toBeLessThan(305);
  expect(printFacts.paperVisibility).toBe('visible');
  expect(printFacts.paperBackground).toBe('rgb(255, 255, 255)');
  expect(printFacts.actionsDisplay).toBe('none');
  expect(paymentRequests).toBe(0);

  if (process.env.POS_RECEIPT_DETAIL_CAPTURE === '1') {
    await page.emulateMedia({ media: 'screen' });
    await expect(receipt).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('saved-receipt-detail.png'),
      fullPage: true,
    });
  }
});

test('print failure keeps the saved receipt open without recording another payment', async ({
  page,
}) => {
  let paymentRequests = 0;
  await openSavedReceipt(page);
  await page.route('**/pos/orders/*/checks/*/payments', async (route) => {
    paymentRequests += 1;
    await route.fulfill({ status: 500, json: { message: 'Unexpected payment request' } });
  });
  await page.evaluate(() => {
    window.print = () => {
      throw new Error('Print dialog unavailable');
    };
  });

  await page.getByRole('button', { name: 'Print / Save PDF' }).click();
  await expect(page.getByRole('alert')).toContainText('Your receipt is saved');
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText(receiptNumber);
  expect(paymentRequests).toBe(0);

  await page.reload();
  const savedReceipt = page.getByRole('article', { name: receiptNumber });
  await expect(savedReceipt).toBeVisible();
  await savedReceipt.getByRole('button', { name: 'View / print receipt' }).click();
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText(receiptNumber);
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText('175.00');
  expect(paymentRequests).toBe(0);
});

test('Arabic receipt detail retains RTL and readable paper width', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'ar');
    document.cookie = 'waffarly-locale=ar; Path=/';
  });
  await openSavedReceipt(
    page,
    '\u0639\u0631\u0636 / \u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0625\u064a\u0635\u0627\u0644',
    '\u0625\u064a\u0635\u0627\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639',
    '????? ???????',
  );
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const receipt = page.getByRole('article', {
    name: '\u0625\u064a\u0635\u0627\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639',
  });
  await expect(receipt).toHaveAttribute('dir', 'rtl');
  await expect(receipt).toContainText(receiptNumber);
  await expect(receipt).toContainText(
    '\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0634\u064a\u0631 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d',
  );
  await expect(receipt).not.toContainText('????? ???????');
  await expect(receipt).toContainText(
    '\u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062f\u0641\u0639',
  );
  await expect(receipt).not.toContainText('Payment method');
  if ((page.viewportSize()?.width ?? 0) < 600) {
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    const positions = await page.evaluate(() => {
      const printButton = document.querySelector('.pos-receipt-screen-actions button:last-child');
      const navigation = document.querySelector('.pos-workspace-rail');
      return {
        printButtonBottom: printButton?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        navigationTop: navigation?.getBoundingClientRect().top ?? 0,
      };
    });
    expect(positions.printButtonBottom).toBeLessThanOrEqual(positions.navigationTop);
  }
  await expect(page.getByRole('button', { name: 'طباعة / حفظ PDF' })).toBeVisible();
  if (process.env.POS_RECEIPT_DETAIL_CAPTURE === '1') {
    await page.screenshot({
      path: testInfo.outputPath('saved-receipt-detail-ar.png'),
    });
  }
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test('item returns are supervisor-approved, recoverable, and do not issue a refund', async ({
  page,
}) => {
  await openSavedReceipt(page);
  let paymentRequests = 0;
  let approvalWasPersisted = false;
  let submitted: Record<string, unknown> | undefined;
  let recordedReturn: Record<string, any> | undefined;
  const returnLineId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const returnUrl = `**/pos/orders/${orderId}/returns`;
  await page.route(returnUrl, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          orderId,
          orderReference: 'ORD-1049',
          orderStatus: 'completed',
          eligible: true,
          items: [
            {
              orderLineId: returnLineId,
              productName: 'Sweet Chocolate Croissant with Pistachio Cream',
              variantName: 'Large',
              selections: ['Extra pistachio'],
              soldQuantity: 2,
              returnedQuantity: 0,
              returnableQuantity: 2,
              unitPrice: '55.00',
            },
          ],
          returns: recordedReturn ? [recordedReturn] : [],
        },
      });
      return;
    }

    submitted = route.request().postDataJSON() as Record<string, unknown>;
    const persisted = await page.evaluate(() =>
      Object.values(localStorage).some((value) => value.includes('supervisor-secret-123')),
    );
    approvalWasPersisted = persisted;
    const requestBody = submitted as {
      requestId: string;
      branchId: string;
      reason: string;
      lines: Array<{ orderLineId: string; quantity: number }>;
    };
    recordedReturn = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      requestId: requestBody.requestId,
      returnNumber: 'RET-1049-01',
      orderId,
      amount: '55.00',
      currency: 'EGP',
      reason: requestBody.reason,
      issuedAt: '2026-10-19T10:00:00.000Z',
      createdByEmployeeId: employeeId,
      approvedByEmployeeId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      issuedBy: 'Test cashier',
      approvedBy: 'Test supervisor',
      lines: requestBody.lines.map((line) => ({
        ...line,
        productName: 'Sweet Chocolate Croissant with Pistachio Cream',
        variantName: 'Large',
        disposition: 'waste',
        unitPrice: '55.00',
        amount: '55.00',
      })),
    };
    await route.fulfill({
      json: {
        orderId,
        return: recordedReturn,
        state: {
          orderId,
          orderReference: 'ORD-1049',
          orderStatus: 'completed',
          eligible: true,
          items: [
            {
              orderLineId: returnLineId,
              productName: 'Sweet Chocolate Croissant with Pistachio Cream',
              variantName: 'Large',
              selections: ['Extra pistachio'],
              soldQuantity: 2,
              returnedQuantity: 1,
              returnableQuantity: 1,
              unitPrice: '55.00',
            },
          ],
          returns: [recordedReturn],
        },
      },
    });
  });
  await page.route('**/pos/orders/*/checks/*/payments/refunds', async (route) => {
    paymentRequests += 1;
    await route.fulfill({
      status: 500,
      json: { message: 'An item return must not refund money.' },
    });
  });

  await page.getByRole('button', { name: 'Record item return' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record item return' });
  await expect(dialog).toContainText('recorded as waste');
  await dialog
    .getByRole('spinbutton', {
      name: 'Return quantity: Sweet Chocolate Croissant with Pistachio Cream',
    })
    .fill('1');
  await dialog.getByLabel('Item return reason').fill('Damaged in delivery');
  await dialog.getByLabel('Supervisor username').fill('supervisor');
  await dialog.getByLabel('Supervisor password').fill('supervisor-secret-123');
  await dialog.getByRole('button', { name: 'Record item return' }).click();

  await expect(page.getByRole('dialog', { name: 'Item return recorded' })).toContainText(
    'RET-1049-01',
  );
  await expect(page.getByRole('dialog', { name: 'Item return recorded' })).toContainText(
    'Reference value only',
  );
  await expect(page.getByRole('dialog', { name: 'Item return recorded' })).toContainText(
    'no money was refunded',
  );
  expect(submitted).toMatchObject({
    branchId,
    reason: 'Damaged in delivery',
    lines: [{ orderLineId: returnLineId, quantity: 1 }],
    approval: { username: 'supervisor', password: 'supervisor-secret-123' },
  });
  expect(approvalWasPersisted).toBe(false);
  expect(paymentRequests).toBe(0);
  await page.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText(receiptNumber);
  await expect(page.getByRole('article', { name: 'POS receipt' })).toContainText('175.00');
});

test('Arabic item-return workflow keeps RTL and blocks quantities above the remaining sale', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'ar');
    document.cookie = 'waffarly-locale=ar; Path=/';
  });
  await openSavedReceipt(
    page,
    '\u0639\u0631\u0636 / \u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0625\u064a\u0635\u0627\u0644',
    '\u0625\u064a\u0635\u0627\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639',
  );
  const returnLineId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await page.route(`**/pos/orders/${orderId}/returns`, (route) =>
    route.fulfill({
      json: {
        orderId,
        orderReference: 'ORD-1049',
        orderStatus: 'completed',
        eligible: true,
        items: [
          {
            orderLineId: returnLineId,
            productName: 'Test croissant',
            variantName: null,
            selections: [],
            soldQuantity: 1,
            returnedQuantity: 0,
            returnableQuantity: 1,
            unitPrice: '55.00',
          },
        ],
        returns: [],
      },
    }),
  );
  await page
    .getByRole('button', {
      name: '\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639 \u0635\u0646\u0641',
    })
    .click();
  const dialog = page.getByRole('dialog', {
    name: '\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639 \u0635\u0646\u0641',
  });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).direction))
    .toBe('rtl');
  await dialog
    .getByLabel(
      '\u0627\u0633\u0645 \u0645\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0645\u0634\u0631\u0641',
    )
    .fill('supervisor');
  await dialog
    .getByLabel(
      '\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0634\u0631\u0641',
    )
    .fill('secret');
  const quantity = dialog.getByRole('spinbutton', {
    name: '\u0643\u0645\u064a\u0629 \u0627\u0644\u0625\u0631\u062c\u0627\u0639: Test croissant',
  });
  await quantity.fill('2');
  await expect(
    dialog.getByRole('button', {
      name: '\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639 \u0635\u0646\u0641',
    }),
  ).toBeDisabled();
  await quantity.fill('1');
  await expect(dialog).toContainText(
    '\u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u0625\u0631\u062c\u0627\u0639',
  );
});
