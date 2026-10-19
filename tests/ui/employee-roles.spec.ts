import { expect, test, type Page } from '@playwright/test';
import {
  resolvePosEmployeePermissions,
  type PosEmployeeRole,
} from '../../packages/contracts/src/pos';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const branches = [{ id: branchId, name: 'Central', archivedAt: null }];

async function mockApi(
  page: Page,
  handler: (path: string, method: string, body: unknown) => unknown,
) {
  await page.route('http://127.0.0.1:4000/**', async (route) => {
    const headers = {
      'access-control-allow-origin': route.request().headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const request = route.request();
    const result = handler(
      new URL(request.url()).pathname,
      request.method(),
      request.postData() ? request.postDataJSON() : undefined,
    );
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
}

for (const locale of ['en', 'ar']) {
  test(`owner can preview and save employee roles in ${locale}`, async ({ page }) => {
    await page.addInitScript(
      (language) => localStorage.setItem('waffarly-locale', language),
      locale,
    );
    let savedRole: PosEmployeeRole = 'cashier';
    let savedBody: Record<string, unknown> | undefined;
    await mockApi(page, (path, method, body) => {
      if (path === '/auth/owner/me')
        return {
          username: 'owner',
          merchantId,
          merchantName: 'Role test',
          activity: 'restaurant',
          ownerName: 'Test Owner',
          ownerMobile: '01100000000',
          contactPhone: '01000000000',
          firstMonthActivatedAt: '2026-10-01T00:00:00.000Z',
        };
      const employee = {
        id: employeeId,
        username: 'staff',
        displayName: 'Staff Member',
        role: savedRole,
        permissions: resolvePosEmployeePermissions(savedRole, [
          'accept_recipe_orders',
          'start_preparation',
        ]),
        savedPermissions: ['accept_recipe_orders', 'start_preparation'],
        revision: 1,
        active: true,
        branches,
        branchIds: [branchId],
      };
      if (path === `/owner/employees/${employeeId}` && method === 'PATCH') {
        savedBody = body as Record<string, unknown>;
        savedRole = savedBody.role as PosEmployeeRole;
        return { ...employee, role: savedRole, revision: 2 };
      }
      return { items: path === '/owner/employees' ? [employee] : [], nextCursor: null };
    });
    await page.goto('http://127.0.0.1:5274/employees');
    await page
      .getByRole('button', { name: locale === 'ar' ? 'تعديل' : 'Edit', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    const role = dialog.getByLabel(locale === 'ar' ? 'الدور' : 'Role', { exact: true });
    for (const value of [
      'branch_manager',
      'inventory_officer',
      'customer_service',
      'kitchen',
      'accountant',
    ]) {
      await role.selectOption(value);
      await expect(
        dialog.getByText(locale === 'ar' ? 'صلاحيات هذا الدور' : 'Permissions for this role', {
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      dialog.getByText(
        locale === 'ar' ? 'عرض الإيصالات وإعادة طباعتها' : 'View and reprint receipts',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        locale === 'ar' ? 'إنشاء المبيعات وتحصيل المدفوعات' : 'Create sales and collect payments',
        { exact: true },
      ),
    ).toHaveCount(0);
    await dialog
      .getByRole('button', { name: locale === 'ar' ? 'حفظ الموظف' : 'Save employee', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(savedBody?.role).toBe('accountant');
    expect(savedBody?.branchIds).toEqual([branchId]);
    await expect(
      page.getByRole('cell', { name: locale === 'ar' ? 'محاسب' : 'Accountant', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel(locale === 'ar' ? 'دور الموظف' : 'Employee role', { exact: true })
      .selectOption('accountant');
    await expect(
      page.getByLabel(locale === 'ar' ? 'دور الموظف' : 'Employee role', { exact: true }),
    ).toHaveValue('accountant');
  });
}

for (const [role, home] of [
  ['inventory_officer', '/inventory'],
  ['accountant', '/receipts'],
  ['customer_service', '/'],
  ['kitchen', '/'],
] as const) {
  test(`${role} lands on its workspace and cannot open sales`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
    const calls: string[] = [];
    await mockApi(page, (path) => {
      calls.push(path);
      if (path === '/auth/pos/me')
        return {
          id: employeeId,
          merchantId,
          username: 'staff',
          displayName: 'Role Test',
          role,
          permissions: resolvePosEmployeePermissions(role, [
            'sell',
            'accept_recipe_orders',
            'start_preparation',
          ]),
          branches,
        };
      return { items: [], nextCursor: null };
    });
    await page.goto('http://127.0.0.1:5275/');
    await expect(page).toHaveURL(`http://127.0.0.1:5275${home}`);
    const nav = page.getByRole('navigation', { name: 'POS navigation' });
    await expect(nav.getByRole('link', { name: 'New sale', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Register shift', exact: true })).toHaveCount(0);
    await page.goto('http://127.0.0.1:5275/catalog');
    await expect(page).toHaveURL(`http://127.0.0.1:5275${home}`);
    expect(calls).not.toContain('/pos/catalog');
    if (role === 'inventory_officer') {
      await expect(page.getByRole('heading', { name: 'Stock balances' })).toBeVisible();
      expect(calls).not.toContain('/pos/receipts');
    }
    if (role === 'accountant') {
      await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
      expect(calls).not.toContain('/pos/orders');
    }
  });
}
