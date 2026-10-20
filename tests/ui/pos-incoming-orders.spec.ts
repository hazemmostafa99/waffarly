import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const pendingOrderId = 'a1b2c3d4-e5f6-47a8-9abc-def012345678';
const preparingOrderId = 'b1c2d3e4-f5a6-47b8-9abc-def012345678';

function makeOrder(
  id: string,
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed',
  handoverEligible = false,
  readyLineIds: string[] = [],
) {
  const isPending = id === pendingOrderId;
  return {
    id,
    status,
    customerName: isPending ? 'Mina Ibrahim' : 'Sara Hassan',
    customerPhone: isPending ? '+201001234567' : null,
    fulfillmentType: isPending ? 'delivery' : 'dine_in',
    tableCode: isPending ? null : '04',
    requiresRecipeAcceptance: true,
    kitchenTicket: {
      id: `ticket-${id}`,
      station: { id: branchId, name: 'Kitchen' },
      dispatchMode: 'automatic',
      dispatchedAt: '2026-10-18T09:30:00.000Z',
    },
    deliveryAddress: isPending ? '12 Tahrir Street, Cairo' : null,
    currency: 'EGP',
    total: isPending ? '245.00' : '180.00',
    createdAt: '2026-10-18T09:30:00.000Z',
    readyAt: status === 'ready' ? '2026-10-18T09:40:00.000Z' : null,
    completedAt: status === 'completed' ? '2026-10-18T09:45:00.000Z' : null,
    handoverEligible: status === 'ready' && handoverEligible,
    inventoryLifecycle: {
      branchId,
      warehouseId: null,
      branchName: 'Main branch',
      warehouseName: null,
      acceptedAt: status === 'pending' ? null : '2026-10-18T09:31:00.000Z',
      preparationStartedAt: ['preparing', 'ready'].includes(status)
        ? '2026-10-18T09:32:00.000Z'
        : null,
      cancelledAt: null,
      cancellationReason: null,
      stockRestored: null,
    },
    lines: [
      {
        id: `${id}-line-1`,
        productName: isPending ? 'Smoked chicken sandwich' : 'Avocado toast',
        variantName: isPending ? 'Large' : null,
        variantAttributes: [],
        basePrice: '200.00',
        modifierTotal: '45.00',
        quantity: 1,
        unitPrice: isPending ? '245.00' : '180.00',
        lineTotal: isPending ? '245.00' : '180.00',
        kitchenReadyAt: readyLineIds.includes(`${id}-line-1`) ? '2026-10-18T09:39:00.000Z' : null,
        note: isPending ? 'No onions, please' : null,
        selections: isPending
          ? [
              {
                groupName: 'Sauce',
                optionName: 'Garlic mayo',
                quantity: 1,
                modifierGroupId: null,
                modifierOptionId: null,
                priceAdjustment: '45.00',
              },
            ]
          : [],
      },
      {
        id: `${id}-line-2`,
        productName: isPending ? 'Side salad' : 'Mashed potatoes',
        variantName: null,
        variantAttributes: [],
        basePrice: '65.00',
        modifierTotal: '0.00',
        quantity: 2,
        unitPrice: '65.00',
        lineTotal: '130.00',
        kitchenReadyAt: readyLineIds.includes(`${id}-line-2`) ? '2026-10-18T09:39:00.000Z' : null,
        note: null,
        selections: [],
      },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/pos/me', (route) =>
    route.fulfill({
      json: {
        id: employeeId,
        merchantId,
        username: 'cashier',
        displayName: 'Cashier',
        role: 'cashier',
        permissions: ['sell', 'open_register_shift', 'accept_recipe_orders', 'start_preparation'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
});

test('incoming tickets show live order details and preserve accept then preparation actions', async ({
  page,
}, testInfo) => {
  let pendingStatus: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' = 'pending';
  let pendingPaid = false;
  const readyLineIds = new Set<string>();
  const actionRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  let initialListResponses = 0;
  const orderListRequests: Array<Record<string, string>> = [];

  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/pos/orders') {
      orderListRequests.push(request.headers());
    }
  });
  page.on('response', (response) => {
    if (
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/pos/orders'
    ) {
      initialListResponses += 1;
    }
  });

  await page.route('**/pos/orders?**', (route) =>
    route.fulfill({
      json: {
        items: [
          makeOrder(pendingOrderId, pendingStatus, pendingPaid, [...readyLineIds]),
          makeOrder(preparingOrderId, 'preparing'),
        ].filter((order) => order.status !== 'completed'),
        nextCursor: null,
      },
    }),
  );
  await page.route('**/pos/orders/**', async (route) => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;
    const orderId = pathname.split('/')[3]!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    actionRequests.push({ url, body });
    const itemReady = pathname.match(/\/items\/([^/]+)\/ready$/);
    if (orderId === pendingOrderId) {
      if (itemReady) {
        readyLineIds.add(itemReady[1]!);
        if (readyLineIds.size === 2) pendingStatus = 'ready';
      } else if (url.endsWith('/accept')) pendingStatus = 'accepted';
      else if (url.endsWith('/start-preparation')) pendingStatus = 'preparing';
      else if (url.endsWith('/handover')) pendingStatus = 'completed';
    }
    await route.fulfill({
      json:
        orderId === pendingOrderId && pendingStatus === 'completed'
          ? makeOrder(pendingOrderId, 'completed', true, [...readyLineIds])
          : makeOrder(
              orderId,
              orderId === pendingOrderId ? pendingStatus : 'preparing',
              pendingPaid,
              [...readyLineIds],
            ),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Incoming orders' })).toBeVisible();
  const tickets = page.locator('article');
  await expect(tickets).toHaveCount(2);
  await expect(tickets.first()).toContainText('Mina Ibrahim');
  await expect(tickets.first()).toContainText('delivery');
  await expect(tickets.first()).toContainText('Smoked chicken sandwich');
  await expect(tickets.first()).toContainText('Garlic mayo');
  await expect(tickets.first()).toContainText('No onions, please');
  await expect(tickets.first()).toContainText('EGP');
  await page.waitForTimeout(100);
  expect(initialListResponses).toBe(1);
  expect(orderListRequests.length).toBeGreaterThanOrEqual(1);
  expect(orderListRequests[0]?.['content-type']).toBeUndefined();
  await expect(
    tickets.first().getByRole('button', { name: 'Accept and deduct stock' }),
  ).toBeVisible();
  await expect(
    tickets.nth(1).getByRole('button', { name: 'Mark Mashed potatoes ready' }),
  ).toBeVisible();
  if (process.env.POS_QUEUE_CAPTURE === '1') {
    await page.screenshot({
      path: testInfo.outputPath('pending-ticket-layout.png'),
      fullPage: true,
    });
  }

  const firstTicket = await tickets.first().boundingBox();
  const secondTicket = await tickets.nth(1).boundingBox();
  expect(firstTicket).not.toBeNull();
  expect(secondTicket).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    expect(Math.abs(secondTicket!.x - firstTicket!.x)).toBeGreaterThan(100);
  } else {
    expect(secondTicket!.y).toBeGreaterThan(firstTicket!.y);
  }

  await tickets.first().getByRole('button', { name: 'Accept and deduct stock' }).click();
  await expect(tickets.first()).toContainText('accepted');
  await tickets.first().getByRole('button', { name: 'Start preparation' }).click();
  await expect(tickets.first()).toContainText('preparing');
  await expect(tickets.first()).toContainText('0 of 2 items ready');
  await tickets.first().getByRole('button', { name: 'Mark Smoked chicken sandwich ready' }).click();
  await expect.poll(() => actionRequests.length).toBe(3);
  expect(new URL(actionRequests[2]!.url).pathname).toContain(
    `/items/${pendingOrderId}-line-1/ready`,
  );
  await expect(tickets.first()).toContainText('1 of 2 items ready');
  await expect(tickets.first()).toContainText('preparing');
  await expect(tickets.first()).toContainText('Ready at');
  await tickets.first().getByRole('button', { name: 'Mark Side salad ready' }).click();
  await expect(tickets.first()).toContainText('ready');
  await expect(tickets.first()).toContainText('Ready at');
  await expect(tickets.first()).toContainText('Settle every check before handover.');
  await expect(tickets.first().getByRole('button', { name: 'Confirm handover' })).toBeDisabled();
  expect(actionRequests).toHaveLength(4);
  expect(actionRequests[0]?.url).toMatch(/\/accept$/);
  expect(actionRequests[0]?.body).toMatchObject({ branchId });
  expect(typeof actionRequests[0]?.body.requestId).toBe('string');
  expect(actionRequests[1]?.url).toMatch(/\/start-preparation$/);
  expect(typeof actionRequests[1]?.body.requestId).toBe('string');
  expect(actionRequests[2]?.url).toMatch(new RegExp(`/items/${pendingOrderId}-line-1/ready$`));
  expect(typeof actionRequests[2]?.body.requestId).toBe('string');
  expect(actionRequests[3]?.url).toMatch(new RegExp(`/items/${pendingOrderId}-line-2/ready$`));
  expect(typeof actionRequests[3]?.body.requestId).toBe('string');

  // Simulate every check being settled, then refresh the queue to expose the handover action.
  pendingPaid = true;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(tickets.first()).toContainText(
    'All checks are paid. The order is ready for handover.',
  );
  await tickets.first().getByRole('button', { name: 'Confirm handover' }).click();
  await expect(tickets).toHaveCount(1);
  expect(actionRequests).toHaveLength(5);
  expect(actionRequests[4]?.url).toMatch(/\/handover$/);
  expect(typeof actionRequests[4]?.body.requestId).toBe('string');

  if ((page.viewportSize()?.width ?? 0) < 600) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
});

test('a failed queue refresh keeps the saved list visible and pauses new actions until refresh succeeds', async ({
  page,
}) => {
  let listReads = 0;
  await page.route('**/pos/orders?**', (route) => {
    listReads += 1;
    if (listReads === 2 || listReads === 3) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 503, message: 'Queue temporarily unavailable' }),
      });
    }
    return route.fulfill({
      json: {
        items: [makeOrder(pendingOrderId, 'pending'), makeOrder(preparingOrderId, 'preparing')],
        nextCursor: null,
      },
    });
  });

  await page.goto('/');
  const tickets = page.locator('article');
  await expect(tickets).toHaveCount(2);
  await expect(page.getByText(/Last updated:/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();

  const staleWarning = page.getByRole('alert');
  await expect(staleWarning).toContainText('Could not refresh the kitchen queue');
  await expect(staleWarning).toContainText('New actions are paused');
  await expect(tickets).toHaveCount(2);
  await expect(tickets.first()).toContainText('Smoked chicken sandwich');
  await expect(
    tickets.first().getByRole('button', { name: 'Accept and deduct stock' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(staleWarning).toHaveCount(0);
  await expect(
    tickets.first().getByRole('button', { name: 'Accept and deduct stock' }),
  ).toBeEnabled();
});

test('a stale queue still permits retrying its exact saved idempotent action', async ({ page }) => {
  const savedRequestId = 'saved-kitchen-accept-request';
  await page.addInitScript(
    ({ merchant, employee, branch, order, requestId }) => {
      const deviceId = 'queue-stale-retry-device';
      localStorage.setItem('waffarly:pos:device:v1', deviceId);
      const key = `waffarly:pos:workspace:v1:${encodeURIComponent(merchant)}:${encodeURIComponent(employee)}:${encodeURIComponent(deviceId)}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 5,
          workspace: {
            merchantId: merchant,
            employeeId: employee,
            deviceId,
            selectedBranchId: branch,
            drafts: {},
            pendingActions: {
              [order]: { action: 'accept', requestId, branchId: branch },
            },
            pendingShiftOpen: null,
            pendingSales: {},
            pendingPayments: {},
            confirmedOrders: {},
            selectedConfirmedOrderId: null,
            selectedDraftId: null,
          },
        }),
      );
    },
    {
      merchant: merchantId,
      employee: employeeId,
      branch: branchId,
      order: pendingOrderId,
      requestId: savedRequestId,
    },
  );

  let listReads = 0;
  let pendingStatus: 'pending' | 'accepted' = 'pending';
  let actionRequest: { url: string; body: Record<string, unknown> } | null = null;
  await page.route('**/pos/orders?**', (route) => {
    listReads += 1;
    if (listReads === 2 || listReads === 3) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 503, message: 'Queue temporarily unavailable' }),
      });
    }
    return route.fulfill({
      json: { items: [makeOrder(pendingOrderId, pendingStatus)], nextCursor: null },
    });
  });
  await page.route('**/pos/orders/**', async (route) => {
    actionRequest = {
      url: route.request().url(),
      body: route.request().postDataJSON() as Record<string, unknown>,
    };
    pendingStatus = 'accepted';
    await route.fulfill({ json: makeOrder(pendingOrderId, pendingStatus) });
  });

  await page.goto('/');
  const ticket = page.locator('article').first();
  await expect(ticket.getByRole('button', { name: 'Retry saved action' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('alert')).toContainText('New actions are paused');
  const retryButton = ticket.getByRole('button', { name: 'Retry saved action' });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();

  await expect.poll(() => actionRequest?.body.requestId).toBe(savedRequestId);
  expect(actionRequest?.url).toMatch(new RegExp(`/pos/orders/${pendingOrderId}/accept$`));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(ticket).toContainText('accepted');
});

test('offline kitchen queue shows its last successful update and pauses order actions', async ({
  page,
}) => {
  await page.route('**/pos/orders?**', (route) =>
    route.fulfill({
      json: {
        items: [makeOrder(pendingOrderId, 'pending')],
        nextCursor: null,
      },
    }),
  );

  await page.goto('/');
  const acceptButton = page.getByRole('button', { name: 'Accept and deduct stock' });
  await expect(acceptButton).toBeEnabled();
  await page.context().setOffline(true);

  await expect(
    page.getByText(/POS is offline\. Showing the last loaded kitchen orders from/),
  ).toBeVisible();
  await expect(acceptButton).toBeDisabled();

  await page.context().setOffline(false);
  await expect(acceptButton).toBeEnabled();
});

test('Arabic incoming tickets translate fulfillment and retain RTL layout', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'ar');
    document.cookie = 'waffarly-locale=ar; Path=/';
  });
  await page.route('**/pos/orders?**', (route) =>
    route.fulfill({
      json: { items: [makeOrder(pendingOrderId, 'pending')], nextCursor: null },
    }),
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'الطلبات الواردة' })).toBeVisible();
  await expect(page.locator('article')).toContainText('توصيل');
  await expect(page.locator('article')).toContainText('قبول الطلب وخصم المخزون');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  if ((page.viewportSize()?.width ?? 0) < 600) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
});

test('Arabic server errors are not presented as invalid cashier input', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'ar');
    document.cookie = 'waffarly-locale=ar; Path=/';
  });
  await page.route('**/pos/orders?**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
    }),
  );

  await page.goto('/');

  const error = page.getByRole('alert');
  await expect(error).toContainText('حدث خطأ غير متوقع.');
  await expect(error).not.toContainText('يرجى التحقق من البيانات المدخلة');
});
