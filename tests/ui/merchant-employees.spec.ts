import { expect, test, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const cursor = '44444444-4444-4444-8444-444444444444';
const employee = {
  id: employeeId,
  username: 'amira',
  displayName: 'Amira Hassan',
  role: 'cashier',
  permissions: ['accept_recipe_orders', 'start_preparation'],
  savedPermissions: ['accept_recipe_orders', 'start_preparation'],
  active: true,
  revision: 3,
  branchIds: [branchId],
  branches: [{ id: branchId, name: 'Central', archivedAt: null }],
  createdAt: '2026-10-15T12:00:00Z',
  updatedAt: '2026-10-15T12:00:00Z',
};

async function setup(page: Page, locale: string, empty = false, failFirstWrite = false) {
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
        firstMonthActivatedAt: '2026-10-01T00:00:00Z',
      },
    }),
  );
  await page.route('**/owner/catalog/**', (route) => route.fulfill({ json: [] }));
  const reads: URL[] = [];
  const writes: Array<{ method: string; body: Record<string, unknown> }> = [];
  let rows = empty ? [] : [employee];
  await page.route('**/owner/employees**', (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (method === 'GET') {
      reads.push(url);
      const search = url.searchParams.get('search') ?? '';
      const status = url.searchParams.get('status');
      const items = rows.filter(
        (row) =>
          `${row.displayName} ${row.username}`.toLowerCase().includes(search.toLowerCase()) &&
          (status === 'all' || (status === 'active' ? row.active : !row.active)),
      );
      return route.fulfill({
        json: {
          items,
          nextCursor:
            !search && status === 'all' && !url.searchParams.has('cursor') && items.length
              ? cursor
              : null,
        },
      });
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ method, body });
    if (failFirstWrite && writes.length === 1)
      return route.fulfill({
        status: 409,
        json: { message: 'Employee update failed for verification.' },
      });
    const saved = {
      ...employee,
      ...body,
      revision: 4,
      branches: (body.branchIds as string[]).map((id) => ({
        id,
        name: 'Central',
        archivedAt: null,
      })),
    } as typeof employee;
    rows = [saved];
    return route.fulfill({ json: saved });
  });
  await page.route('**/owner/inventory/branches**', (route) => {
    const url = new URL(route.request().url());
    const branch = { id: branchId, name: 'Central', archivedAt: null };
    return route.fulfill({
      json: url.pathname.endsWith(`/${branchId}`) ? branch : { items: [branch], nextCursor: null },
    });
  });
  return { reads, writes };
}

for (const locale of ['en', 'ar']) {
  const ar = locale === 'ar';
  test(`employees matches Products and resets pagination when filtering (${locale})`, async ({
    page,
  }, testInfo) => {
    const { reads } = await setup(page, locale);
    await page.goto('http://127.0.0.1:5274/products');
    await expect(page.locator('.products-heading h1')).toBeVisible();
    const reference = await page.evaluate(() => {
      const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        font: css('.products-heading h1').fontFamily,
        size: css('.products-heading h1').fontSize,
        color: css('.products-heading h1').color,
        radius: css('.products-table-card').borderRadius,
        cardPadding: css('.products-table-card').padding,
        background: css('.merchant-layout').backgroundColor,
        button: css('.products-heading .primary').backgroundColor,
        shadow: css('.products-heading .primary').boxShadow,
      };
    });
    await page.goto('http://127.0.0.1:5274/employees');
    await expect(
      page.getByRole('table', { name: ar ? 'قائمة الموظفين' : 'Employee list' }),
    ).toBeVisible();
    await expect(page.getByText('Amira Hassan', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.employee-heading-row h1')).toHaveCSS('font-family', reference.font);
    await expect(page.locator('.employee-heading-row h1')).toHaveCSS('font-size', reference.size);
    await expect(page.locator('.employee-heading-row h1')).toHaveCSS('color', reference.color);
    await expect(page.locator('.employee-table-card')).toHaveCSS('border-radius', reference.radius);
    await expect(page.locator('.employee-table-card')).toHaveCSS('padding', reference.cardPadding);
    await expect(page.locator('.merchant-layout')).toHaveCSS(
      'background-color',
      reference.background,
    );
    await expect(page.locator('.employee-heading-row .primary')).toHaveCSS(
      'background-color',
      reference.button,
    );
    await expect(page.locator('.employee-heading-row .primary')).toHaveCSS(
      'box-shadow',
      reference.shadow,
    );
    await page.screenshot({ path: testInfo.outputPath(`employees-${locale}.png`), fullPage: true });
    await page.getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true }).click();
    await expect.poll(() => reads.at(-1)?.searchParams.get('cursor')).toBe(cursor);
    await page
      .getByRole('searchbox', { name: ar ? 'ابحث عن موظفين' : 'Search employees' })
      .fill('Amira');
    await expect.poll(() => reads.at(-1)?.searchParams.get('search')).toBe('Amira');
    expect(reads.at(-1)!.searchParams.has('cursor')).toBe(false);
    await page
      .getByRole('combobox', { name: ar ? 'حالة الموظف' : 'Employee status' })
      .selectOption('inactive');
    await expect(
      page.getByText(ar ? 'لا يوجد موظفون مطابقون' : 'No matching employees', { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
    expect(reads.every((url) => url.searchParams.get('limit') === '25')).toBe(true);
  });

  test(`employee creation validates branches and keeps the draft after a failed save (${locale})`, async ({
    page,
  }, testInfo) => {
    const { writes } = await setup(page, locale, true, true);
    await page.goto('http://127.0.0.1:5274/employees');
    const add = page.getByRole('button', { name: ar ? 'إضافة موظف' : 'Add employee', exact: true });
    await add.click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel(ar ? 'اسم الموظف' : 'Employee name', { exact: true })
      .fill('Amira Hassan');
    await dialog.getByLabel(ar ? 'اسم المستخدم' : 'Username', { exact: true }).fill('AMIRA1');
    await dialog
      .getByLabel(ar ? 'كلمة المرور (12 حرفًا على الأقل)' : 'Password (12 characters minimum)', {
        exact: true,
      })
      .fill('browser-test-password');
    const save = dialog.getByRole('button', {
      name: ar ? 'حفظ الموظف' : 'Save employee',
      exact: true,
    });
    await save.click();
    await expect(dialog.getByRole('alert')).toContainText(
      ar ? 'عيّن فرعًا نشطًا واحدًا على الأقل.' : 'Assign at least one active branch.',
    );
    expect(writes).toHaveLength(0);
    const branchPicker = dialog.getByRole('combobox', {
      name: ar ? 'إضافة فرع نشط' : 'Add an active branch',
      exact: true,
    });
    await branchPicker.fill('Central');
    await dialog.getByRole('option', { name: 'Central', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`employee-editor-${locale}.png`),
      fullPage: true,
    });
    await save.click();
    await expect(dialog.getByRole('alert')).toContainText(
      ar ? 'حدث خطأ غير متوقع.' : 'Employee update failed for verification.',
    );
    await expect(
      dialog.getByLabel(ar ? 'اسم الموظف' : 'Employee name', { exact: true }),
    ).toHaveValue('Amira Hassan');
    await save.click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({
      method: 'POST',
      body: {
        displayName: 'Amira Hassan',
        username: 'amira1',
        password: 'browser-test-password',
        role: 'cashier',
        branchIds: [branchId],
      },
    });
    await expect(page.getByText('@amira1', { exact: true })).toBeVisible();
    await expect(add).toBeFocused();
  });

  test(`editing preserves revision and deactivates without resetting the password (${locale})`, async ({
    page,
  }) => {
    const { writes } = await setup(page, locale);
    await page.goto('http://127.0.0.1:5274/employees');
    await page.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByLabel(ar ? 'اسم المستخدم' : 'Username', { exact: true }),
    ).toBeDisabled();
    await dialog
      .getByLabel(ar ? 'اسم الموظف' : 'Employee name', { exact: true })
      .fill('Amira Updated');
    await dialog.getByLabel(ar ? 'الحساب نشط' : 'Account active', { exact: true }).uncheck();
    await dialog.getByRole('button', { name: ar ? 'إزالة' : 'Remove', exact: true }).click();
    await dialog
      .getByRole('button', { name: ar ? 'حفظ الموظف' : 'Save employee', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([
      {
        method: 'PATCH',
        body: {
          revision: 3,
          displayName: 'Amira Updated',
          active: false,
          role: 'cashier',
          branchIds: [],
        },
      },
    ]);
    await expect(page.locator('.products-notice')).toContainText(
      ar ? 'تم إيقاف الموظف' : 'Employee deactivated.',
    );
    await expect(
      page.getByRole('cell', { name: ar ? 'غير نشط' : 'Inactive', exact: true }),
    ).toBeVisible();
  });
}
