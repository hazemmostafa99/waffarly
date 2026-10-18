import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const orderId = '44444444-4444-4444-8444-444444444444';
const registerId = '77777777-7777-4777-8777-777777777777';

const owner = {
  username: 'owner',
  merchantId,
  merchantName: 'Browser Test Restaurant',
  activity: 'restaurant',
  contactPhone: '01000000000',
  ownerName: 'Owner',
  ownerMobile: '01100000000',
  firstMonthActivatedAt: '2026-10-01T00:00:00.000Z',
};

function employeeSummary(username: string, displayName: string, role: 'cashier' | null = null) {
  return {
    id: employeeId,
    username,
    displayName,
    role,
    permissions: [
      'accept_recipe_orders',
      'start_preparation',
      ...(role === 'cashier' ? ['open_register_shift', 'sell'] : []),
    ],
    active: true,
    revision: 1,
    branchIds: [branchId],
    branches: [{ id: branchId, name: 'Central', archivedAt: null }],
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  };
}

function orderSummary(status: 'pending' | 'accepted' | 'preparing') {
  return {
    id: orderId,
    status,
    customerName: 'Recipe buyer',
    customerPhone: '01000000000',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    currency: 'EGP',
    total: '26.00',
    createdAt: '2026-10-15T12:00:00.000Z',
    lines: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        productName: 'Bread',
        variantName: 'Large',
        quantity: 2,
        lineTotal: '26.00',
        selections: [{ optionName: 'Extra cheese', quantity: 1 }],
      },
    ],
    inventoryLifecycle: {
      branchId: status === 'pending' ? null : branchId,
      warehouseId: status === 'pending' ? null : '66666666-6666-4666-8666-666666666666',
      branchName: status === 'pending' ? null : 'Central',
      warehouseName: status === 'pending' ? null : 'Kitchen',
      acceptedAt: status === 'pending' ? null : '2026-10-15T12:01:00.000Z',
      preparationStartedAt: status === 'preparing' ? '2026-10-15T12:02:00.000Z' : null,
      cancelledAt: null,
      cancellationReason: null,
      stockRestored: null,
    },
  };
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin;
  return {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders(route),
    body: JSON.stringify(body),
  });
}

async function allowPreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: corsHeaders(route) });
  return true;
}

async function mockOwner(page: Page) {
  let employees: ReturnType<typeof employeeSummary>[] = [];
  let registers: Array<{
    id: string;
    branchId: string;
    branchName: string;
    name: string;
    active: boolean;
    revision: number;
  }> = [];
  await page.route('**/auth/owner/me', async (route) => {
    if (await allowPreflight(route)) return;
    await fulfillJson(route, owner);
  });
  await page.route('**/owner/employees**', async (route) => {
    if (await allowPreflight(route)) return;
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { items: employees, nextCursor: null });
      return;
    }
    const body = route.request().postDataJSON() as {
      username: string;
      displayName: string;
      branchIds: string[];
      role?: 'cashier' | null;
    };
    employees = [employeeSummary(body.username, body.displayName, body.role ?? null)];
    await fulfillJson(route, employees[0], 201);
  });
  await page.route('**/owner/pos/registers**', async (route) => {
    if (await allowPreflight(route)) return;
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { items: registers, nextCursor: null });
      return;
    }
    const body = route.request().postDataJSON() as { branchId: string; name: string };
    registers = [
      {
        id: registerId,
        branchId: body.branchId,
        branchName: 'Central',
        name: body.name,
        active: true,
        revision: 1,
      },
    ];
    await fulfillJson(route, registers[0], 201);
  });
  await page.route('**/owner/inventory/branches**', async (route) => {
    if (await allowPreflight(route)) return;
    const url = new URL(route.request().url());
    const isEntity = url.pathname.endsWith(`/${branchId}`);
    await fulfillJson(
      route,
      isEntity
        ? { id: branchId, name: 'Central', archivedAt: null }
        : { items: [{ id: branchId, name: 'Central', archivedAt: null }], nextCursor: null },
    );
  });
}

test('owner configures a cashier and register, then the cashier can open a shift and handle recipe orders', async ({
  browser,
}, testInfo) => {
  const ownerPage = await browser.newPage();
  await ownerPage.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await mockOwner(ownerPage);
  await ownerPage.goto('http://127.0.0.1:5274/employees');

  await ownerPage.getByRole('button', { name: 'Add employee', exact: true }).click();
  await ownerPage.getByLabel('Employee name', { exact: true }).fill('Amira Hassan');
  await ownerPage.getByLabel('Username', { exact: true }).fill('amira1');
  await ownerPage
    .getByLabel('Password (12 characters minimum)', { exact: true })
    .fill('browser-test-password');
  await ownerPage
    .getByRole('combobox', { name: 'Add an active branch', exact: true })
    .selectOption(branchId);
  await ownerPage.getByRole('combobox', { name: 'POS role', exact: true }).selectOption('cashier');
  await ownerPage.getByRole('button', { name: 'Save employee', exact: true }).click();
  await expect(ownerPage.getByText('Employee account created.', { exact: true })).toBeVisible();
  await expect(ownerPage.getByText('@amira1', { exact: true })).toBeVisible();
  await expect(ownerPage.getByText('Central', { exact: true })).toBeVisible();
  await ownerPage.screenshot({
    path: testInfo.outputPath('owner-employee-created.png'),
    fullPage: true,
  });

  await ownerPage.goto('http://127.0.0.1:5274/pos-registers');
  await ownerPage.getByRole('button', { name: 'Add register', exact: true }).click();
  await ownerPage
    .getByRole('combobox', { name: 'Choose branch', exact: true })
    .selectOption(branchId);
  await ownerPage.getByLabel('Register name', { exact: true }).fill('Front counter');
  await ownerPage.getByRole('button', { name: 'Save register', exact: true }).click();
  await expect(ownerPage.getByText('Register created at Central.', { exact: true })).toBeVisible();
  await expect(ownerPage.getByText('Front counter', { exact: true })).toBeVisible();
  await ownerPage.close();

  const posPage = await browser.newPage();
  await posPage.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  let signedIn = false;
  let status: 'pending' | 'accepted' | 'preparing' = 'pending';
  let catalogRequested = false;
  let loginPayload: Record<string, unknown> | undefined;
  let openShiftPayload: Record<string, unknown> | undefined;
  let activeShift: Record<string, unknown> | null = null;
  const acceptPayloads: Record<string, unknown>[] = [];
  let preparationPayload: Record<string, unknown> | undefined;

  await posPage.route('**/auth/pos/me', async (route) => {
    if (await allowPreflight(route)) return;
    if (!signedIn) {
      await fulfillJson(route, { message: 'Sign in is required.' }, 401);
      return;
    }
    await fulfillJson(route, {
      id: employeeId,
      merchantId,
      username: 'amira1',
      displayName: 'Amira Hassan',
      role: 'cashier',
      permissions: ['accept_recipe_orders', 'start_preparation', 'open_register_shift', 'sell'],
      branches: [{ id: branchId, name: 'Central', archivedAt: null }],
    });
  });
  await posPage.route('**/auth/pos/login', async (route) => {
    if (await allowPreflight(route)) return;
    loginPayload = route.request().postDataJSON() as Record<string, unknown>;
    signedIn = true;
    await fulfillJson(route, { authenticated: true });
  });
  await posPage.route('**/pos/orders**', async (route) => {
    if (await allowPreflight(route)) return;
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { items: [orderSummary(status)], nextCursor: null });
      return;
    }
    if (path.endsWith('/accept')) {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      acceptPayloads.push(payload);
      status = 'accepted';
      if (acceptPayloads.length === 1) {
        await fulfillJson(route, { message: 'Temporary gateway failure.' }, 503);
        return;
      }
      await fulfillJson(route, orderSummary(status));
      return;
    }
    if (path.endsWith('/start-preparation')) {
      preparationPayload = route.request().postDataJSON() as Record<string, unknown>;
      status = 'preparing';
      await fulfillJson(route, orderSummary(status));
      return;
    }
    await route.fulfill({ status: 404, headers: corsHeaders(route) });
  });
  await posPage.route('**/pos/catalog**', async (route) => {
    if (await allowPreflight(route)) return;
    catalogRequested = true;
    await fulfillJson(route, {
      categories: {
        items: [{ id: '77777777-7777-4777-8777-777777777777', name: 'Bakery', parentId: null }],
        nextCursor: null,
      },
      products: {
        items: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            name: 'Fresh sourdough',
            description: 'Baked this morning',
            basePrice: '85.00',
            currency: 'EGP',
            sellingUnit: 'piece',
            images: [],
            categories: [{ id: '77777777-7777-4777-8777-777777777777', name: 'Bakery' }],
            modifierGroups: [],
            variants: [],
          },
        ],
        nextCursor: null,
      },
    });
  });
  await posPage.route('**/pos/registers**', async (route) => {
    if (await allowPreflight(route)) return;
    await fulfillJson(route, [{ id: registerId, branchId, name: 'Front counter' }]);
  });
  await posPage.route('**/pos/shifts/current**', async (route) => {
    if (await allowPreflight(route)) return;
    await fulfillJson(route, activeShift);
  });
  await posPage.route('**/pos/shifts/open', async (route) => {
    if (await allowPreflight(route)) return;
    openShiftPayload = route.request().postDataJSON() as Record<string, unknown>;
    activeShift = {
      id: '88888888-8888-4888-8888-888888888888',
      branchId,
      registerId,
      registerName: 'Front counter',
      openedByEmployeeId: employeeId,
      openedByName: 'Amira Hassan',
      openRequestId: openShiftPayload.requestId,
      openingFloat: openShiftPayload.openingFloat,
      currency: 'EGP',
      openedAt: '2026-10-17T12:00:00.000Z',
      status: 'open',
    };
    await fulfillJson(route, activeShift, 201);
  });

  await posPage.goto('http://127.0.0.1:5275/login');
  await posPage.getByLabel('Business code', { exact: true }).fill('browser-test-restaurant');
  await posPage.getByLabel('Username', { exact: true }).fill('amira1');
  await posPage.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await posPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(posPage.getByRole('heading', { name: 'Recipe order queue' })).toBeVisible();
  expect(loginPayload).toEqual({
    storefrontSlug: 'browser-test-restaurant',
    username: 'amira1',
    password: 'browser-test-password',
  });

  await posPage.getByRole('link', { name: 'Catalog', exact: true }).click();
  await expect(
    posPage.getByRole('heading', { name: 'Product catalog', exact: true }),
  ).toBeVisible();
  await expect(
    posPage.getByRole('heading', { name: 'Fresh sourdough', exact: true }),
  ).toBeVisible();
  expect(catalogRequested).toBe(true);
  await posPage.getByRole('link', { name: 'Incoming orders', exact: true }).click();
  await expect(posPage.getByRole('heading', { name: 'Recipe order queue' })).toBeVisible();

  await posPage.getByRole('button', { name: 'Accept and deduct stock', exact: true }).click();
  await expect(posPage.getByRole('alert')).toContainText('Temporary gateway failure.');
  await expect(
    posPage.getByText('A previous reply was uncertain. Retry the saved action before continuing.'),
  ).toBeVisible();
  expect(acceptPayloads).toHaveLength(1);

  await posPage.reload();
  await expect(posPage.locator('.pos-status-accepted')).toContainText('accepted');
  await expect(
    posPage.getByRole('button', { name: 'Retry saved action', exact: true }),
  ).toBeVisible();
  await posPage.getByRole('button', { name: 'Retry saved action', exact: true }).click();
  await expect(
    posPage.getByRole('button', { name: 'Start preparation', exact: true }),
  ).toBeVisible();
  expect(acceptPayloads).toHaveLength(2);
  expect(acceptPayloads[0]).toMatchObject({ branchId, requestId: expect.any(String) });
  expect(acceptPayloads[1]).toEqual(acceptPayloads[0]);
  expect(
    await posPage.evaluate(
      ({ merchantId: merchant, employeeId: employee, orderId: order }) => {
        const deviceId = localStorage.getItem('waffarly:pos:device:v1');
        if (!deviceId) return 'device-id-missing';
        const key = `waffarly:pos:workspace:v1:${encodeURIComponent(merchant)}:${encodeURIComponent(employee)}:${encodeURIComponent(deviceId)}`;
        const stored = localStorage.getItem(key);
        if (!stored) return 'workspace-missing';
        const value = JSON.parse(stored) as {
          workspace?: { pendingActions?: Record<string, unknown> };
        };
        return value.workspace?.pendingActions?.[order] ?? null;
      },
      { merchantId, employeeId, orderId },
    ),
  ).toBeNull();
  await expect(
    posPage.getByRole('button', { name: 'Start preparation', exact: true }),
  ).toBeVisible();
  await expect(posPage.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await posPage.screenshot({ path: testInfo.outputPath('pos-order-accepted.png'), fullPage: true });

  await posPage.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect(posPage.locator('.pos-status-preparing')).toContainText('preparing');
  expect(preparationPayload).toMatchObject({ requestId: expect.any(String) });
  await expect(posPage.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await posPage.screenshot({
    path: testInfo.outputPath('pos-preparation-started.png'),
    fullPage: true,
  });

  await posPage.getByRole('link', { name: 'Register shift', exact: true }).click();
  await expect(
    posPage.getByRole('heading', { name: 'Open register shift', exact: true }),
  ).toBeVisible();
  await posPage.getByLabel('Opening cash float (EGP)', { exact: true }).fill('125.5');
  await posPage.getByRole('button', { name: 'Open shift', exact: true }).click();
  await expect(
    posPage.getByRole('heading', { name: 'Register shift is open', exact: true }),
  ).toBeVisible();
  expect(openShiftPayload).toMatchObject({
    registerId,
    requestId: expect.any(String),
    openingFloat: '125.5',
  });
  await expect(posPage.getByText('Amira Hassan', { exact: false })).toBeVisible();

  await posPage.getByRole('button', { name: 'Change language', exact: true }).click();
  await expect(posPage.getByRole('heading', { name: 'قائمة طلبات الوصفات' })).toBeVisible();
  await expect(posPage.locator('.pos-status-preparing')).toContainText('قيد التحضير');
  await expect(posPage.locator('html')).toHaveAttribute('dir', 'rtl');
  await posPage.screenshot({ path: testInfo.outputPath('pos-arabic-rtl.png'), fullPage: true });

  await posPage.close();
});
