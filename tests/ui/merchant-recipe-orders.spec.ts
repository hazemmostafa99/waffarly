import { expect, test, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const warehouseId = '44444444-4444-4444-8444-444444444444';

async function setup(page: Page, locale = 'en', loseAcceptanceReply = false) {
  await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'owner',
        merchantId,
        merchantName: 'Restaurant',
        activity: 'restaurant',
        ownerName: 'Owner',
        ownerMobile: '01000000000',
        contactPhone: '01000000000',
        firstMonthActivatedAt: '2026-10-01T00:00:00.000Z',
      },
    }),
  );
  let order = {
    id: orderId,
    status: 'pending',
    requiresRecipeAcceptance: true,
    customerName: 'Recipe buyer',
    customerPhone: '01000000000',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    currency: 'EGP',
    total: '26.00',
    createdAt: '2026-10-15T12:00:00.000Z',
    lines: [
      {
        id: warehouseId,
        productName: 'Bread',
        variantName: 'Large',
        variantAttributes: [],
        basePrice: '10.00',
        modifierTotal: '3.00',
        quantity: 2,
        unitPrice: '13.00',
        lineTotal: '26.00',
        selections: [],
      },
    ],
    inventoryLifecycle: {
      branchId: null as string | null,
      warehouseId: null as string | null,
      branchName: null as string | null,
      warehouseName: null as string | null,
      acceptedAt: null as string | null,
      preparationStartedAt: null as string | null,
      cancelledAt: null as string | null,
      cancellationReason: null as string | null,
      stockRestored: null as boolean | null,
    },
  };
  const accepts: Record<string, unknown>[] = [];
  let acceptedSnapshot: typeof order | undefined;
  await page.route('**/owner/orders**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { items: [order], nextCursor: null } });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (path.endsWith('/accept')) {
      accepts.push(body);
      if (!acceptedSnapshot) {
        order = {
          ...order,
          status: 'accepted',
          inventoryLifecycle: {
            ...order.inventoryLifecycle,
            branchId,
            warehouseId,
            branchName: 'Central',
            warehouseName: 'Kitchen',
            acceptedAt: '2026-10-15T12:01:00.000Z',
          },
        };
        acceptedSnapshot = structuredClone(order);
        if (loseAcceptanceReply) return route.abort('failed');
      }
      return route.fulfill({ json: acceptedSnapshot });
    }
    if (path.endsWith('/start-preparation'))
      order = {
        ...order,
        status: 'preparing',
        inventoryLifecycle: {
          ...order.inventoryLifecycle,
          preparationStartedAt: '2026-10-15T12:02:00.000Z',
        },
      };
    if (path.endsWith('/cancel'))
      order = {
        ...order,
        status: 'cancelled',
        inventoryLifecycle: {
          ...order.inventoryLifecycle,
          cancelledAt: '2026-10-15T12:02:00.000Z',
          cancellationReason: String(body.reason),
          stockRestored: body.restoreStock === true,
        },
      };
    return route.fulfill({ json: order });
  });
  await page.route('**/owner/inventory/branches**', (route) =>
    route.fulfill({
      json: new URL(route.request().url()).search
        ? { items: [{ id: branchId, name: 'Central' }], nextCursor: null }
        : { id: branchId, name: 'Central' },
    }),
  );
  await page.goto('http://127.0.0.1:5274/orders');
  await page
    .getByRole('button', { name: locale === 'ar' ? /تفاصيل الطلب/ : /Order details/ })
    .click();
  return accepts;
}

for (const locale of ['en', 'ar']) {
  test(`recipe acceptance chooses a branch and cancellation requires an explicit stock decision (${locale})`, async ({
    page,
  }) => {
    const accepts = await setup(page, locale);
    await page
      .getByRole('combobox', {
        name: locale === 'ar' ? 'فرع تنفيذ الطلب' : 'Fulfillment branch',
        exact: true,
      })
      .selectOption(branchId);
    await page
      .getByRole('button', {
        name: locale === 'ar' ? 'قبول وخصم المكونات' : 'Accept and deduct ingredients',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', {
        name: locale === 'ar' ? 'بدء التحضير' : 'Start preparation',
        exact: true,
      }),
    ).toBeVisible();
    expect(accepts[0]).toMatchObject({ branchId, requestId: expect.any(String) });
    await page
      .getByText(locale === 'ar' ? 'إلغاء قبل التحضير' : 'Cancel before preparation', {
        exact: true,
      })
      .click();
    const confirm = page.getByRole('button', {
      name: locale === 'ar' ? 'تأكيد الإلغاء' : 'Confirm cancellation',
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await page
      .getByLabel(locale === 'ar' ? 'سبب الإلغاء' : 'Cancellation reason', { exact: true })
      .fill('Customer cancelled');
    await expect(confirm).toBeDisabled();
    await page
      .getByLabel(locale === 'ar' ? 'قرار المخزون' : 'Stock decision', { exact: true })
      .selectOption('yes');
    await confirm.click();
    await expect(
      page.getByText(
        locale === 'ar'
          ? /Customer cancelled.*تم إرجاع المخزون/
          : /Customer cancelled.*Stock restored/,
      ),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });
}

test('an uncertain acceptance survives reload and retries its original command before preparation', async ({
  page,
}) => {
  const accepts = await setup(page, 'en', true);
  await page
    .getByRole('combobox', { name: 'Fulfillment branch', exact: true })
    .selectOption(branchId);
  await page.getByRole('button', { name: 'Accept and deduct ingredients', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved action', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Order details/ }).click();
  await page.getByRole('button', { name: 'Retry saved action', exact: true }).click();
  await expect.poll(() => accepts.length).toBe(2);
  expect(accepts[1]).toEqual(accepts[0]);
  await expect(page.getByRole('button', { name: 'Start preparation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start preparation', exact: true }).click();
  await expect(
    page.getByText('Preparation started; cancellation is unavailable.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Cancel before preparation', { exact: true })).toHaveCount(0);
});

test('dashboard labels preparation and excludes cancelled orders from order value', async ({
  page,
}) => {
  await setup(page);
  const common = {
    customerName: 'Buyer',
    customerPhone: '01000000000',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    currency: 'EGP',
    createdAt: new Date().toISOString(),
    lines: [],
  };
  await page.route('**/owner/orders**', (route) =>
    route.fulfill({
      json: {
        items: [
          { ...common, id: orderId, status: 'preparing', total: '26.00' },
          { ...common, id: warehouseId, status: 'cancelled', total: '50.00' },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/owner/catalog/**', (route) => route.fulfill({ json: [] }));
  await page.goto('http://127.0.0.1:5274/');
  await expect(page.locator('.dashboard-stat').first()).toContainText('26.00');
  await expect(page.locator('.dashboard-status.preparing')).toHaveText('Preparing');
  await expect(page.locator('.dashboard-status.cancelled')).toHaveText('Cancelled');
});
