import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const pendingOrderId = 'a1b2c3d4-e5f6-47a8-9abc-def012345678';
const preparingOrderId = 'b1c2d3e4-f5a6-47b8-9abc-def012345678';

function makeOrder(id: string, status: 'pending' | 'accepted' | 'preparing') {
  const isPending = status === 'pending';
  return {
    id,
    status,
    customerName: isPending ? 'Mina Ibrahim' : 'Sara Hassan',
    customerPhone: isPending ? '+201001234567' : null,
    fulfillmentType: isPending ? 'delivery' : 'dine_in',
    deliveryAddress: isPending ? '12 Tahrir Street, Cairo' : null,
    currency: 'EGP',
    total: isPending ? '245.00' : '180.00',
    createdAt: '2026-10-18T09:30:00.000Z',
    inventoryLifecycle: {
      branchId,
      warehouseId: null,
      branchName: 'Main branch',
      warehouseName: null,
      acceptedAt: status === 'pending' ? null : '2026-10-18T09:31:00.000Z',
      preparationStartedAt: status === 'preparing' ? '2026-10-18T09:32:00.000Z' : null,
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
        permissions: ['sell', 'open_register_shift'],
        branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
      },
    }),
  );
});

test('incoming tickets show live order details and preserve accept then preparation actions', async ({
  page,
}, testInfo) => {
  let pendingStatus: 'pending' | 'accepted' | 'preparing' = 'pending';
  const actionRequests: Array<{ url: string; body: Record<string, unknown> }> = [];

  await page.route('**/pos/orders?**', (route) =>
    route.fulfill({
      json: {
        items: [makeOrder(pendingOrderId, pendingStatus), makeOrder(preparingOrderId, 'preparing')],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/pos/orders/**', async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    actionRequests.push({ url, body });
    pendingStatus = url.endsWith('/accept') ? 'accepted' : 'preparing';
    await route.fulfill({ json: makeOrder(pendingOrderId, pendingStatus) });
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
  await expect(
    tickets.first().getByRole('button', { name: 'Accept and deduct stock' }),
  ).toBeVisible();
  await expect(tickets.nth(1).getByRole('button')).toHaveCount(0);
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
  await expect(tickets.first().getByRole('button')).toHaveCount(0);
  expect(actionRequests).toHaveLength(2);
  expect(actionRequests[0]?.url).toMatch(/\/accept$/);
  expect(actionRequests[0]?.body).toMatchObject({ branchId });
  expect(typeof actionRequests[0]?.body.requestId).toBe('string');
  expect(actionRequests[1]?.url).toMatch(/\/start-preparation$/);
  expect(typeof actionRequests[1]?.body.requestId).toBe('string');

  if ((page.viewportSize()?.width ?? 0) < 600) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  }
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
