import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const firstTableId = '44444444-4444-4444-8444-444444444444';
const secondTableId = '55555555-5555-4555-8555-555555555555';
const sessionId = '66666666-6666-4666-8666-666666666666';
const orderId = '77777777-7777-4777-8777-777777777777';
const lineId = '88888888-8888-4888-8888-888888888888';

test('cashier moves a table session and splits whole quantities from the dining view', async ({
  page,
}) => {
  const employee = {
    id: employeeId,
    merchantId,
    username: 'cashier',
    displayName: 'Cashier',
    role: 'cashier',
    permissions: ['sell', 'open_register_shift'],
    branches: [{ id: branchId, name: 'Main branch', archivedAt: null }],
  };
  const session = {
    id: sessionId,
    branchId,
    tableId: firstTableId,
    tableCode: '#01',
    revision: 1,
    openedAt: '2026-10-17T10:00:00.000Z',
    orderCount: 1,
    outstandingTotal: '10.00',
    orders: [
      {
        id: orderId,
        total: '10.00',
        currency: 'EGP',
        status: 'pending',
        revision: 1,
        createdAt: '2026-10-17T10:00:00.000Z',
        lines: [
          {
            id: lineId,
            productName: 'Butter Croissant',
            variantName: null,
            quantity: 2,
            unitPrice: '5.00',
          },
        ],
        checks: [
          {
            id: '99999999-9999-4999-8999-999999999999',
            position: 0,
            amount: '10.00',
            splitMethod: 'whole',
            allocations: [],
          },
        ],
      },
    ],
  };
  let moved = false;
  let splitRequest: Record<string, unknown> | null = null;
  await page.route('**/auth/pos/me', (route) => route.fulfill({ json: employee }));
  await page.route('**/pos/dining/tables?**', (route) =>
    route.fulfill({
      json: moved
        ? [
            {
              id: firstTableId,
              branchId,
              branchName: 'Main branch',
              code: '#01',
              capacity: 4,
              active: true,
              revision: 1,
              occupancy: 'available',
              sessionId: null,
              sessionRevision: null,
              openedAt: null,
              orderCount: 0,
              outstandingTotal: '0.00',
            },
            {
              id: secondTableId,
              branchId,
              branchName: 'Main branch',
              code: '#02',
              capacity: 2,
              active: true,
              revision: 1,
              occupancy: 'occupied',
              sessionId,
              sessionRevision: 2,
              openedAt: '2026-10-17T10:00:00.000Z',
              orderCount: 1,
              outstandingTotal: '10.00',
            },
          ]
        : [
            {
              id: firstTableId,
              branchId,
              branchName: 'Main branch',
              code: '#01',
              capacity: 4,
              active: true,
              revision: 1,
              occupancy: 'occupied',
              sessionId,
              sessionRevision: 1,
              openedAt: '2026-10-17T10:00:00.000Z',
              orderCount: 1,
              outstandingTotal: '10.00',
            },
            {
              id: secondTableId,
              branchId,
              branchName: 'Main branch',
              code: '#02',
              capacity: 2,
              active: true,
              revision: 1,
              occupancy: 'available',
              sessionId: null,
              sessionRevision: null,
              openedAt: null,
              orderCount: 0,
              outstandingTotal: '0.00',
            },
          ],
    }),
  );
  await page.route('**/pos/dining/sessions?**', (route) =>
    route.fulfill({
      json: [
        {
          ...session,
          tableId: moved ? secondTableId : firstTableId,
          tableCode: moved ? '#02' : '#01',
          revision: moved ? 2 : 1,
        },
      ],
    }),
  );
  await page.route(`**/pos/dining/sessions/${sessionId}/move`, async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ revision: 1, tableId: secondTableId });
    moved = true;
    await route.fulfill({
      json: { ...session, tableId: secondTableId, tableCode: '#02', revision: 2 },
    });
  });
  await page.route(`**/pos/orders/${orderId}/split-checks`, async (route) => {
    splitRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        orderId,
        revision: 2,
        checks: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            position: 0,
            amount: '5.00',
            splitMethod: 'items',
            allocations: [
              {
                orderLineId: lineId,
                productName: 'Butter Croissant',
                variantName: null,
                quantity: 1,
                amount: '5.00',
              },
            ],
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            position: 1,
            amount: '5.00',
            splitMethod: 'items',
            allocations: [
              {
                orderLineId: lineId,
                productName: 'Butter Croissant',
                variantName: null,
                quantity: 1,
                amount: '5.00',
              },
            ],
          },
        ],
      },
    });
  });

  await page.goto('/dining');
  await expect(page.getByRole('heading', { name: 'Tables & open sessions' })).toBeVisible();
  await expect(page.getByText('Table #01', { exact: true })).toBeVisible();
  await page.getByLabel('Move session to an available table').selectOption(secondTableId);
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByText('Table #02', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Split check', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Split check · Table #02' });
  await dialog.getByLabel('Check 1 · Butter Croissant').fill('1');
  await dialog.getByLabel('Check 2 · Butter Croissant').fill('1');
  expect(
    await dialog
      .getByRole('button', { name: 'Save split', exact: true })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  ).toBe('rgb(194, 65, 12)');
  await page.screenshot({ path: 'test-results/pos-dining-split.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Save split', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(splitRequest).toMatchObject({
    revision: 1,
    method: 'items',
    checks: [
      { lines: [{ orderLineId: lineId, quantity: 1 }] },
      { lines: [{ orderLineId: lineId, quantity: 1 }] },
    ],
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.getByRole('heading', { name: 'الترابيزات والجلسات المفتوحة' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ترابيزات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تقسيم الحساب', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
