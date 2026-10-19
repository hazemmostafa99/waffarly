import { expect, test, type Locator, type Page } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const selectedId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
const warehouseId = '55555555-5555-4555-8555-555555555555';
const supplierId = '66666666-6666-4666-8666-666666666666';
const nextCursor = '77777777-7777-4777-8777-777777777777';
const selectedItem = {
  id: selectedId,
  name: 'Selected flour',
  baseUnit: 'g',
  units: [],
  archivedAt: null,
  revision: 1,
};
const otherItem = { ...selectedItem, id: otherId, name: 'Olive ingredient' };
const warehouse = {
  id: warehouseId,
  name: 'Main',
  branchId: merchantId,
  branchName: 'Central',
  branchArchivedAt: null,
  archivedAt: null,
  revision: 1,
};

async function chooseLookup(scope: Page | Locator, label: string, name: string) {
  const input = scope.getByRole('combobox', { name: label, exact: true });
  await input.fill(name);
  await scope.getByRole('option').filter({ hasText: name }).click();
}

async function authenticate(page: Page, locale = 'en') {
  await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'audit',
        merchantId,
        merchantName: 'Merchant',
        activity: 'restaurant',
        ownerName: 'Owner',
        ownerMobile: '01000000000',
        contactPhone: '01000000000',
        firstMonthActivatedAt: '2026-10-01T00:00:00.000Z',
      },
    }),
  );
}

test('modifier editor saves quantity caps, variant prices and explicit empty effects', async ({
  page,
}) => {
  await authenticate(page);
  let saved: Record<string, unknown> | undefined;
  await page.route('**/owner/catalog/**', (route) => {
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { id: productId } });
    }
    const detail = new URL(route.request().url()).pathname.endsWith(`/products/${productId}`);
    return route.fulfill({
      json: detail
        ? {
            id: productId,
            name: 'Recipe bowl',
            description: '',
            basePrice: '20.00',
            availability: 'available',
            revision: 1,
            images: [{ mediaAssetId: otherId, publicUrl: '', isPrimary: true, position: 0 }],
            categories: [{ id: warehouseId }],
            variants: [
              {
                id: warehouseId,
                name: 'Large',
                sku: null,
                barcode: null,
                price: '20.00',
                stockQuantity: null,
                availability: 'available',
                position: 0,
                attributes: [],
              },
            ],
            modifierGroups: [
              {
                id: supplierId,
                modifierGroupId: nextCursor,
                name: 'Extras',
                description: '',
                selectionMode: 'multiple',
                minSelections: 0,
                maxSelections: 1,
                position: 0,
                options: [
                  {
                    id: selectedId,
                    name: 'Cheese',
                    priceAdjustment: '2.00',
                    defaultSelected: true,
                    maxQuantity: 1,
                    position: 0,
                    effects: [],
                    variantOverrides: [],
                  },
                ],
              },
            ],
            inventoryConfigurationRequired: true,
            inventoryDefaultMode: 'RECIPE',
            inventoryConfiguration: {
              mode: 'RECIPE',
              targets: [
                {
                  variantId: warehouseId,
                  components: [{ stockItemId: selectedId, unitCode: 'g', quantity: '10' }],
                },
              ],
            },
          }
        : [],
    });
  });
  await page.goto(`http://127.0.0.1:5274/products/${productId}/edit`);
  await page.getByRole('tab', { name: /Options/ }).click();
  await page.getByText('Quantities, variants and ingredients', { exact: true }).click();
  const option = page.getByRole('group', { name: 'Cheese', exact: true });
  await option.getByLabel('Maximum quantity per option').fill('3');
  await option.getByText('Large', { exact: true }).click();
  await option.getByLabel('Variant price (blank inherits product price)').fill('1.50');
  await option.getByLabel('Replace all ingredient effects').check();
  await expect(option.getByText('An empty list means no ingredient effects.')).toBeVisible();
  await page.getByRole('tab', { name: /Preview and publish/ }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect
    .poll(() => saved?.modifierGroupAssignments)
    .toMatchObject([
      {
        options: [
          {
            optionId: selectedId,
            maxQuantity: 3,
            variantOverrides: [
              { variantId: warehouseId, available: true, priceAdjustment: '1.50', effects: [] },
            ],
          },
        ],
      },
    ]);
});

for (const locale of ['en', 'ar']) {
  test(`product inventory keeps selected units while searching and paging (${locale})`, async ({
    page,
  }) => {
    await authenticate(page, locale);
    const lookups: URL[] = [];
    let productLists = 0;
    let productDetails = 0;
    await page.route('**/owner/catalog/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(`/products/${productId}`)) {
        productDetails++;
        return route.fulfill({
          json: {
            id: productId,
            name: 'Recipe bowl',
            description: null,
            basePrice: '50',
            availability: 'available',
            revision: 1,
            images: [],
            categories: [],
            variants: [],
            modifierGroups: [],
            inventoryConfigurationRequired: true,
            inventoryDefaultMode: 'RECIPE',
            inventoryConfiguration: {
              mode: 'RECIPE',
              targets: [
                {
                  variantId: null,
                  components: [{ stockItemId: selectedId, unitCode: 'kg', quantity: '1.5' }],
                },
              ],
            },
          },
        });
      }
      if (path.endsWith('/products')) productLists++;
      return route.fulfill({ json: [] });
    });
    await page.route('**/owner/inventory/items**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(`/${selectedId}`)) return route.fulfill({ json: selectedItem });
      if (url.pathname.endsWith(`/${otherId}`)) return route.fulfill({ json: otherItem });
      lookups.push(url);
      return route.fulfill({
        json: {
          items: [otherItem],
          nextCursor:
            url.searchParams.get('cursor') || url.searchParams.get('search') ? null : nextCursor,
        },
      });
    });
    await page.goto(`http://127.0.0.1:5274/products/${productId}/edit`);
    await page.getByRole('tab', { name: locale === 'ar' ? /المخزون/ : /Inventory/ }).click();
    const picker = page.getByRole('group', {
      name: locale === 'ar' ? 'صنف المخزون' : 'Stock Item',
      exact: true,
    });
    await expect(picker.getByRole('combobox')).toHaveValue(selectedId);
    const unit = page.getByRole('combobox', {
      name: locale === 'ar' ? 'الوحدة' : 'Unit',
      exact: true,
    });
    await expect(unit).toHaveValue('kg');
    await expect(
      picker.getByRole('button', { name: locale === 'ar' ? 'التالي' : 'Next', exact: true }),
    ).toBeEnabled();
    expect(lookups).toHaveLength(1);
    expect(lookups[0]!.searchParams.get('limit')).toBe('25');
    expect(productDetails).toBe(1);
    expect(productLists).toBe(0);
    await picker
      .getByRole('button', { name: locale === 'ar' ? 'التالي' : 'Next', exact: true })
      .click();
    await expect.poll(() => lookups.at(-1)?.searchParams.get('cursor')).toBe(nextCursor);
    await expect(unit).toHaveValue('kg');
    await picker.getByRole('searchbox').fill('Olive');
    await expect.poll(() => lookups.at(-1)?.searchParams.get('search')).toBe('Olive');
    expect(lookups.at(-1)!.searchParams.has('cursor')).toBe(false);
    await expect(unit).toHaveValue('kg');
    await expect(picker.getByRole('combobox')).toBeEnabled();
    await picker.getByRole('combobox').selectOption(otherId);
    await expect(unit).toHaveValue('g');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
  });
}

test('editing metadata preserves an existing recipe without opening its inventory tab', async ({
  page,
}) => {
  await authenticate(page);
  let saved: Record<string, unknown> | undefined;
  let inventoryReads = 0;
  const configuration = {
    mode: 'RECIPE',
    targets: [
      {
        variantId: null,
        components: [{ stockItemId: selectedId, unitCode: 'kg', quantity: '1.5' }],
      },
    ],
  };
  await page.route('**/owner/catalog/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { id: productId } });
    }
    return route.fulfill({
      json: path.endsWith(`/products/${productId}`)
        ? {
            id: productId,
            name: 'Recipe bowl',
            description: '',
            basePrice: '50',
            availability: 'available',
            revision: 1,
            images: [{ mediaAssetId: otherId, publicUrl: '', isPrimary: true, position: 0 }],
            categories: [{ id: warehouseId }],
            variants: [],
            modifierGroups: [],
            inventoryConfigurationRequired: true,
            inventoryDefaultMode: 'RECIPE',
            inventoryConfiguration: configuration,
          }
        : [],
    });
  });
  await page.route('**/owner/inventory/**', (route) => {
    inventoryReads++;
    return route.fulfill({ json: [] });
  });
  await page.goto(`http://127.0.0.1:5274/products/${productId}/edit`);
  await page.getByRole('tab', { name: /Preview and publish/ }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => saved?.inventoryConfiguration).toEqual(configuration);
  expect(inventoryReads).toBe(0);
});

test('purchase editors use bounded lookups and preserve the selected invoice fields', async ({
  page,
}) => {
  await authenticate(page);
  const requests: URL[] = [];
  let saved: Record<string, unknown> | undefined;
  await page.route('**/owner/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/auth/')) return route.fallback();
    requests.push(url);
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...saved,
          id: productId,
          status: 'draft',
          revision: 1,
          supplierName: 'Supplier',
          warehouseName: 'Main',
          branchName: 'Central',
          lines: [],
        },
      });
    }
    if (url.pathname.includes('/invoices'))
      return route.fulfill({ json: { items: [], nextCursor: null } });
    const item = url.pathname.includes('/suppliers')
      ? { id: supplierId, name: 'Supplier' }
      : url.pathname.includes('/warehouses')
        ? warehouse
        : otherItem;
    return route.fulfill({ json: url.search ? { items: [item], nextCursor } : item });
  });
  await page.goto('http://127.0.0.1:5274/inventory/purchases');
  await page.getByRole('button', { name: 'New purchase invoice', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Supplier', exact: true })).toBeEnabled();
  await chooseLookup(dialog, 'Supplier', 'Supplier');
  await expect(dialog.getByRole('combobox', { name: 'Warehouse', exact: true })).toBeEnabled();
  await dialog.getByRole('combobox', { name: 'Warehouse', exact: true }).selectOption(warehouseId);
  await dialog.getByRole('button', { name: 'Continue to items', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Stock item', exact: true })).toBeEnabled();
  await chooseLookup(dialog, 'Stock item', 'Olive ingredient');
  await dialog.getByLabel('Quantity', { exact: true }).fill('1.25');
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect.poll(() => saved).toBeTruthy();
  expect(saved).toMatchObject({
    supplierId,
    warehouseId,
    lines: [{ stockItemId: otherId, quantity: '1.25', unitCode: 'g', condition: 'available' }],
  });
  expect(requests.some((url) => url.pathname.includes('/branches'))).toBe(false);
  expect(requests.some((url) => url.searchParams.has('cursor'))).toBe(false);
  expect(
    requests.filter((url) => url.search).every((url) => url.searchParams.get('limit') === '25'),
  ).toBe(true);
});

test('opening-stock retry hydrates only saved references and keeps the original request', async ({
  page,
}) => {
  await authenticate(page);
  const pending = {
    requestId: nextCursor,
    reason: 'Reviewed opening',
    lines: [
      {
        warehouseId,
        stockItemId: selectedId,
        condition: 'available',
        quantity: '1.25',
        unitCode: 'g',
      },
    ],
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('waffarly-opening-stock-pending', JSON.stringify(value));
    sessionStorage.setItem('waffarly-opening-stock-request', value.requestId);
  }, pending);
  let posted: unknown;
  await page.route('**/owner/inventory/**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      posted = route.request().postDataJSON();
      return route.fulfill({ json: { id: productId, replayed: true, movements: [] } });
    }
    if (url.pathname.endsWith('/policy'))
      return route.fulfill({
        json: { negativeStockPolicy: 'allow', revision: 1, updatedAt: null },
      });
    if (url.pathname.endsWith(`/${selectedId}`))
      return route.fulfill({ json: { ...selectedItem, archivedAt: '2026-10-15T00:00:00.000Z' } });
    if (url.pathname.endsWith(`/${warehouseId}`))
      return route.fulfill({
        json: { ...warehouse, branchArchivedAt: '2026-10-15T00:00:00.000Z' },
      });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto('http://127.0.0.1:5274/inventory/opening');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Selected flour');
  await expect(dialog).toContainText('Central');
  await dialog.getByRole('button', { name: 'Retry posting', exact: true }).click();
  await expect.poll(() => posted).toEqual(pending);
});

test('new opening selections survive a language change and post the reviewed quantities', async ({
  page,
}) => {
  await authenticate(page);
  let posted: Record<string, unknown> | undefined;
  let policyReads = 0;
  await page.route('**/owner/inventory/**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      posted = route.request().postDataJSON();
      return route.fulfill({ json: { id: productId, replayed: false, movements: [] } });
    }
    if (url.pathname.endsWith('/policy')) {
      policyReads++;
      return route.fulfill({
        json: { negativeStockPolicy: 'allow', revision: 1, updatedAt: null },
      });
    }
    if (url.pathname.includes('/items'))
      return route.fulfill({
        json: url.search ? { items: [otherItem], nextCursor: null } : otherItem,
      });
    if (url.pathname.includes('/warehouses'))
      return route.fulfill({
        json: url.search ? { items: [warehouse], nextCursor: null } : warehouse,
      });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto('http://127.0.0.1:5274/inventory/opening');
  await expect(page.getByRole('combobox', { name: 'Warehouse', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Warehouse', exact: true }).selectOption(warehouseId);
  await expect(page.getByRole('combobox', { name: 'Stock item', exact: true })).toBeEnabled();
  await chooseLookup(page, 'Stock item', 'Olive ingredient');
  await page.getByLabel('Reason', { exact: true }).fill('Reviewed count');
  await page.getByLabel('Quantity', { exact: true }).fill('1.25');
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect.poll(() => policyReads).toBe(2);
  await page.getByRole('button', { name: 'مراجعة الرصيد', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Olive ingredient');
  await expect(dialog).toContainText('Central');
  await dialog.getByRole('button', { name: 'ترحيل الرصيد الافتتاحي', exact: true }).click();
  await expect
    .poll(() => posted?.lines)
    .toEqual([
      {
        warehouseId,
        stockItemId: otherId,
        condition: 'available',
        quantity: '1.25',
        unitCode: 'g',
      },
    ]);
});

for (const locale of ['en', 'ar']) {
  test(`inventory opens on stock and filters reset pagination (${locale})`, async ({
    page,
  }, testInfo) => {
    await authenticate(page, locale);
    const balanceRequests: URL[] = [];
    const otherRequests: string[] = [];
    await page.route('**/owner/inventory/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/balances')) {
        balanceRequests.push(url);
        return route.fulfill({
          json: {
            items: [
              {
                id: productId,
                warehouseId,
                warehouseName: 'Main',
                branchId: merchantId,
                branchName: 'Central',
                stockItemId: selectedId,
                stockItemName: 'Selected flour',
                baseUnit: 'g',
                condition: 'available',
                quantity: '25000',
                updatedAt: '2026-10-17T10:00:00Z',
              },
            ],
            nextCursor: url.searchParams.has('cursor') ? null : nextCursor,
          },
        });
      }
      otherRequests.push(url.pathname);
      return route.fulfill({
        json: url.search ? { items: [warehouse], nextCursor: null } : warehouse,
      });
    });
    await page.route('**/owner/catalog/**', (route) => route.fulfill({ json: [] }));
    await page.goto('http://127.0.0.1:5274/products');
    await expect(page.locator('.products-heading h1')).toBeVisible();
    const productsStyle = await page.evaluate(() => {
      const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        headingFont: css('.products-heading h1').fontFamily,
        headingSize: css('.products-heading h1').fontSize,
        headingColor: css('.products-heading h1').color,
        background: css('.merchant-layout').backgroundColor,
        cardRadius: css('.products-table-card').borderRadius,
        cardPadding: css('.products-table-card').padding,
        cardHeadingSize: css('.products-table-card .wf-card-heading h2').fontSize,
        buttonBackground: css('.products-heading .products-button.primary').backgroundColor,
        buttonShadow: css('.products-heading .products-button.primary').boxShadow,
      };
    });
    await page.screenshot({
      path: testInfo.outputPath(`products-reference-${locale}.png`),
      fullPage: true,
    });
    await page.goto('http://127.0.0.1:5274/inventory');
    await expect(
      page.getByRole('heading', {
        name: locale === 'ar' ? 'نظرة عامة على المخزون' : 'Stock overview',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Selected flour', { exact: true })).toBeVisible();
    await expect(page.locator('.inventory-intro h1')).toHaveCSS(
      'font-family',
      productsStyle.headingFont,
    );
    await expect(page.locator('.inventory-intro h1')).toHaveCSS(
      'font-size',
      productsStyle.headingSize,
    );
    await expect(page.locator('.inventory-intro h1')).toHaveCSS(
      'color',
      productsStyle.headingColor,
    );
    await expect(page.locator('.merchant-layout')).toHaveCSS(
      'background-color',
      productsStyle.background,
    );
    const balancesCard = page.locator('.inventory-card').last();
    await expect(balancesCard).toHaveCSS('border-radius', productsStyle.cardRadius);
    await expect(balancesCard).toHaveCSS('padding', productsStyle.cardPadding);
    await expect(balancesCard.locator('.wf-card-heading h2')).toHaveCSS('font-size', '16px');
    await expect(balancesCard.locator('.wf-data-table')).toHaveCSS('font-size', '14px');
    await expect(page.locator('.inventory-intro-actions .bg-gradient-to-br')).toHaveCSS(
      'background-color',
      productsStyle.buttonBackground,
    );
    await expect(page.locator('.inventory-intro-actions .bg-gradient-to-br')).toHaveCSS(
      'box-shadow',
      productsStyle.buttonShadow,
    );
    await expect(page.locator('#stock-search')).toHaveCSS('background-color', 'rgb(245, 248, 251)');
    await expect(page.locator('#stock-search')).toHaveCSS('height', '42px');
    expect(otherRequests.some((path) => /policy|movements/.test(path))).toBe(false);
    await page
      .getByRole('button', { name: locale === 'ar' ? 'التالي' : 'Next', exact: true })
      .last()
      .click();
    await expect.poll(() => balanceRequests.at(-1)?.searchParams.get('cursor')).toBe(nextCursor);
    await page.locator('#stock-search').fill('flour');
    await page
      .getByRole('button', { name: locale === 'ar' ? 'بحث' : 'Search', exact: true })
      .click();
    await expect.poll(() => balanceRequests.at(-1)?.searchParams.get('search')).toBe('flour');
    expect(balanceRequests.at(-1)!.searchParams.has('cursor')).toBe(false);
    const warehouseFilter = page.getByRole('combobox', {
      name: locale === 'ar' ? 'تصفية حسب المستودع' : 'Filter by warehouse',
      exact: true,
    });
    await expect(warehouseFilter).toBeEnabled();
    await warehouseFilter.selectOption(warehouseId);
    await expect
      .poll(() => balanceRequests.at(-1)?.searchParams.get('warehouseId'))
      .toBe(warehouseId);
    await page
      .getByRole('button', { name: locale === 'ar' ? 'مسح الفلاتر' : 'Clear filters', exact: true })
      .click();
    await expect.poll(() => balanceRequests.at(-1)?.searchParams.has('warehouseId')).toBe(false);
    expect(balanceRequests.at(-1)!.searchParams.has('search')).toBe(false);
    await expect(warehouseFilter).toHaveValue('');
    await expect(
      page.getByRole('link', {
        name: locale === 'ar' ? 'نظرة عامة على المخزون' : 'Stock overview',
        exact: true,
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
    await page.screenshot({ path: testInfo.outputPath(`inventory-${locale}.png`), fullPage: true });
  });

  test(`item creation keeps packs optional and adds no stock (${locale})`, async ({ page }) => {
    await authenticate(page, locale);
    let saved: Record<string, unknown> | undefined;
    const writes: string[] = [];
    await page.route('**/owner/inventory/**', (route) => {
      if (route.request().method() !== 'GET') {
        writes.push(new URL(route.request().url()).pathname);
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { ...selectedItem, ...saved } });
      }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });
    await page.goto('http://127.0.0.1:5274/inventory/items?new=1');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const disclosure = dialog.getByRole('button', {
      name: locale === 'ar' ? 'هل تشتري هذا الصنف في عبوات؟' : 'Do you buy this item in packs?',
    });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await disclosure.click();
    await dialog
      .getByLabel(locale === 'ar' ? 'اسم الصنف' : 'Item name', { exact: true })
      .fill('New flour');
    await dialog
      .getByLabel(locale === 'ar' ? 'وحدة القياس' : 'Measurement unit', { exact: true })
      .selectOption('kg');
    await dialog
      .getByRole('button', {
        name: locale === 'ar' ? 'إنشاء صنف مخزون' : 'Create stock item',
        exact: true,
      })
      .click();
    await expect.poll(() => saved).toMatchObject({ name: 'New flour', baseUnit: 'kg', units: [] });
    expect(writes).toEqual(['/owner/inventory/items']);
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: locale === 'ar' ? 'إضافة الرصيد الافتتاحي' : 'Add starting stock',
        exact: true,
      }),
    ).toBeVisible();
  });
}

test('empty inventory guides setup and keeps history separate', async ({ page }) => {
  await authenticate(page);
  await page.route('**/owner/inventory/**', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.goto('http://127.0.0.1:5274/inventory');
  await expect(
    page.getByRole('heading', { name: 'Set up a branch and warehouse', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set up branch and warehouse', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add stock items', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Movement history', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Movement history', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Current balances', exact: true })).toHaveCount(0);
});

test('purchase review receives stock only after explicit confirmation and preserves retry identity', async ({
  page,
}, testInfo) => {
  await authenticate(page);
  let draft: Record<string, unknown> | undefined;
  const confirmations: Record<string, unknown>[] = [];
  const invoice = {
    id: productId,
    revision: 1,
    status: 'draft',
    supplierId,
    supplierName: 'Supplier',
    warehouseId,
    warehouseName: 'Main',
    branchName: 'Central',
    supplierInvoiceNumber: 'INV-42',
    createdAt: '2026-10-17T10:00:00Z',
    lines: [
      {
        id: selectedId,
        stockItemId: otherId,
        stockItemName: 'Olive ingredient',
        quantity: '1.25',
        unitCode: 'g',
        unitName: 'Gram',
        baseUnit: 'g',
        condition: 'available',
      },
    ],
  };
  await page.route('**/owner/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/auth/')) return route.fallback();
    if (url.pathname.endsWith('/confirm')) {
      confirmations.push(route.request().postDataJSON());
      return confirmations.length === 1
        ? route.fulfill({ status: 503, json: { message: 'Please retry receiving.' } })
        : route.fulfill({
            json: { invoice: { ...invoice, status: 'confirmed' }, receipt: { replayed: false } },
          });
    }
    if (route.request().method() === 'POST') {
      draft = route.request().postDataJSON();
      return route.fulfill({ json: invoice });
    }
    if (url.pathname.includes('/invoices'))
      return route.fulfill({ json: { items: [], nextCursor: null } });
    const item = url.pathname.includes('/suppliers')
      ? { id: supplierId, name: 'Supplier' }
      : url.pathname.includes('/warehouses')
        ? warehouse
        : otherItem;
    return route.fulfill({ json: url.search ? { items: [item], nextCursor: null } : item });
  });
  await page.goto('http://127.0.0.1:5274/inventory/purchases?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continue to items', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Choose a supplier and warehouse');
  await chooseLookup(dialog, 'Supplier', 'Supplier');
  await dialog.getByRole('combobox', { name: 'Warehouse', exact: true }).selectOption(warehouseId);
  await dialog.getByLabel('Supplier invoice number', { exact: true }).fill('INV-42');
  await dialog.getByRole('button', { name: 'Continue to items', exact: true }).click();
  await chooseLookup(dialog, 'Stock item', 'Olive ingredient');
  await dialog.getByLabel('Quantity', { exact: true }).fill('1.25');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByLabel('Supplier invoice number', { exact: true })).toHaveValue('INV-42');
  await dialog.getByRole('button', { name: 'Continue to items', exact: true }).click();
  await expect(dialog.getByLabel('Quantity', { exact: true })).toHaveValue('1.25');
  await dialog.getByRole('button', { name: 'Save and review', exact: true }).click();
  await expect(dialog).toContainText('Receiving this purchase adds the quantities below to:');
  expect(draft).toMatchObject({
    supplierId,
    warehouseId,
    supplierInvoiceNumber: 'INV-42',
    lines: [{ quantity: '1.25', unitCode: 'g' }],
  });
  expect(confirmations).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('purchase-review.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Confirm receipt', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Please retry receiving.');
  await dialog.getByRole('button', { name: 'Confirm receipt', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(confirmations).toHaveLength(2);
  expect(confirmations[1]).toEqual(confirmations[0]);
});

for (const locale of ['en', 'ar']) {
  test(`movement filters query the server and reset pagination (${locale})`, async ({ page }) => {
    await authenticate(page, locale);
    const ar = locale === 'ar';
    const queries: URL[] = [];
    await page.route('**/owner/inventory/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/movements')) {
        queries.push(url);
        return route.fulfill({
          json: { items: [], nextCursor: url.searchParams.has('cursor') ? null : nextCursor },
        });
      }
      const item = url.pathname.includes('/items') ? otherItem : warehouse;
      return route.fulfill({ json: url.search ? { items: [item], nextCursor: null } : item });
    });
    await page.goto('http://127.0.0.1:5274/inventory/history');
    const next = page
      .locator('.inventory-pagination')
      .getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true });
    await next.click();
    await expect.poll(() => queries.at(-1)?.searchParams.get('cursor')).toBe(nextCursor);
    await page
      .getByRole('combobox', { name: ar ? 'نوع الحركة' : 'Movement type', exact: true })
      .selectOption('recipe_consumption');
    await expect.poll(() => queries.at(-1)?.searchParams.get('kind')).toBe('recipe_consumption');
    expect(queries.at(-1)?.searchParams.has('cursor')).toBe(false);
    await chooseLookup(page, ar ? 'تصفية حسب الصنف' : 'Filter by item', 'Olive ingredient');
    await expect.poll(() => queries.at(-1)?.searchParams.get('stockItemId')).toBe(otherId);
    await page
      .getByRole('combobox', { name: ar ? 'الحالة' : 'Condition', exact: true })
      .selectOption('non_sellable');
    await expect.poll(() => queries.at(-1)?.searchParams.get('condition')).toBe('non_sellable');
    await page
      .getByRole('button', { name: ar ? 'مسح الفلاتر' : 'Clear filters', exact: true })
      .click();
    await expect.poll(() => queries.at(-1)?.searchParams.toString()).toBe('limit=25');
  });

  test(`inline supplier creation preserves purchase fields through cancel and retry (${locale})`, async ({
    page,
  }, testInfo) => {
    await authenticate(page, locale);
    const ar = locale === 'ar';
    const supplier = { id: supplierId, name: 'New supplier' };
    const supplierCommands: Record<string, unknown>[] = [];
    const invoices: Record<string, unknown>[] = [];
    let supplierCreated = false;
    let confirmations = 0;
    await page.route('**/owner/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/auth/')) return route.fallback();
      if (url.pathname.endsWith('/confirm')) {
        confirmations++;
        return route.fulfill({ status: 500 });
      }
      if (route.request().method() === 'POST' && url.pathname.endsWith('/suppliers')) {
        supplierCommands.push(route.request().postDataJSON());
        if (supplierCommands.length === 1)
          return route.fulfill({ status: 503, json: { message: 'Supplier unavailable' } });
        supplierCreated = true;
        return route.fulfill({ json: supplier });
      }
      if (route.request().method() === 'POST' && url.pathname.endsWith('/invoices')) {
        const body = route.request().postDataJSON();
        invoices.push(body);
        return route.fulfill({
          json: {
            ...body,
            id: productId,
            revision: 1,
            status: 'draft',
            supplierName: supplier.name,
            warehouseName: warehouse.name,
            branchName: warehouse.branchName,
            createdAt: '2026-10-18T10:00:00Z',
            lines: [],
          },
        });
      }
      if (url.pathname.includes('/invoices'))
        return route.fulfill({ json: { items: [], nextCursor: null } });
      if (url.pathname.includes('/suppliers'))
        return route.fulfill({
          json: url.search
            ? { items: supplierCreated ? [supplier] : [], nextCursor: null }
            : supplier,
        });
      return route.fulfill({
        json: url.search ? { items: [warehouse], nextCursor: null } : warehouse,
      });
    });
    await page.goto('http://127.0.0.1:5274/inventory/purchases?new=1');
    const editor = page.getByRole('dialog', {
      name: ar ? 'فاتورة شراء جديدة' : 'New purchase invoice',
      exact: true,
    });
    await editor
      .getByLabel(ar ? 'رقم فاتورة المورد' : 'Supplier invoice number', { exact: true })
      .fill('KEEP-42');
    await editor
      .getByRole('combobox', { name: ar ? 'المخزن' : 'Warehouse', exact: true })
      .selectOption(warehouseId);
    await editor
      .getByRole('button', { name: ar ? 'إضافة مورد' : 'Add supplier', exact: true })
      .click();
    const supplierDialog = page.getByRole('dialog', {
      name: ar ? 'إنشاء مورد' : 'Create supplier',
      exact: true,
    });
    await supplierDialog
      .getByRole('button', { name: ar ? 'إغلاق' : 'Close', exact: true })
      .filter({ hasText: ar ? 'إغلاق' : 'Close' })
      .click();
    await expect(
      editor.getByLabel(ar ? 'رقم فاتورة المورد' : 'Supplier invoice number', { exact: true }),
    ).toHaveValue('KEEP-42');
    await editor
      .getByRole('button', { name: ar ? 'إضافة مورد' : 'Add supplier', exact: true })
      .click();
    await supplierDialog
      .getByLabel(ar ? 'المورد' : 'Supplier', { exact: true })
      .fill(supplier.name);
    await supplierDialog
      .getByRole('button', { name: ar ? 'حفظ المورد' : 'Save supplier', exact: true })
      .click();
    await expect(supplierDialog.getByRole('alert')).toContainText(
      ar ? 'يرجى التحقق من البيانات المدخلة والمحاولة مجددًا.' : 'Supplier unavailable',
    );
    await supplierDialog
      .getByRole('button', { name: ar ? 'حفظ المورد' : 'Save supplier', exact: true })
      .click();
    await expect(supplierDialog).toHaveCount(0);
    expect(supplierCommands[1]).toEqual(supplierCommands[0]);
    await expect(
      editor.getByRole('combobox', { name: ar ? 'المورد' : 'Supplier', exact: true }),
    ).toHaveValue(supplier.name);
    await expect(
      editor.getByRole('combobox', { name: ar ? 'المخزن' : 'Warehouse', exact: true }),
    ).toHaveValue(warehouseId);
    await expect(
      editor.getByLabel(ar ? 'رقم فاتورة المورد' : 'Supplier invoice number', { exact: true }),
    ).toHaveValue('KEEP-42');
    await editor
      .getByRole('button', { name: ar ? 'متابعة إلى الأصناف' : 'Continue to items', exact: true })
      .click();
    expect(invoices).toHaveLength(0);
    expect(confirmations).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`inline-supplier-${locale}.png`),
      fullPage: true,
    });
  });

  test(`negative-stock policy requires an explicit save (${locale})`, async ({ page }) => {
    await authenticate(page, locale);
    const ar = locale === 'ar';
    const writes: unknown[] = [];
    let policy = { negativeStockPolicy: 'allow', revision: 1, updatedAt: null };
    await page.route('**/owner/inventory/policy', (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        writes.push(body);
        policy = { ...policy, ...body, revision: 2 };
      }
      return route.fulfill({ json: policy });
    });
    await page.goto('http://127.0.0.1:5274/inventory/settings');
    const save = page.getByRole('button', {
      name: ar ? 'حفظ السياسة' : 'Save policy',
      exact: true,
    });
    const prevent = page.getByRole('radio', {
      name: ar ? /منع الرصيد السالب/ : /Prevent negative stock/,
    });
    await expect(prevent).toBeEnabled();
    await expect(save).toBeDisabled();
    await prevent.check();
    expect(writes).toHaveLength(0);
    await save.click();
    await expect.poll(() => writes).toEqual([{ negativeStockPolicy: 'prevent', revision: 1 }]);
    await expect(save).toBeDisabled();
    await page.reload();
    await expect(prevent).toBeChecked();
  });
}

for (const locale of ['en', 'ar']) {
  test(`item and movement details link their recorded source (${locale})`, async ({ page }) => {
    await authenticate(page, locale);
    const ar = locale === 'ar';
    const movementId = nextCursor;
    const invoiceId = otherId;
    const movement = {
      id: movementId,
      batchId: supplierId,
      kind: 'purchase_receipt',
      sourceType: 'purchase_invoice',
      sourceId: invoiceId,
      reason: 'Received supplier delivery',
      warehouseId,
      warehouseName: warehouse.name,
      branchId: merchantId,
      branchName: warehouse.branchName,
      stockItemId: selectedId,
      stockItemName: selectedItem.name,
      baseUnit: 'g',
      condition: 'available',
      unitCode: 'g',
      enteredQuantity: '500',
      baseDelta: '500',
      actor: 'audit',
      createdAt: '2026-10-18T10:00:00.000Z',
    };
    const balance = {
      id: productId,
      warehouseId,
      warehouseName: warehouse.name,
      branchId: merchantId,
      branchName: warehouse.branchName,
      stockItemId: selectedId,
      stockItemName: selectedItem.name,
      baseUnit: 'g',
      condition: 'available',
      quantity: '500',
      updatedAt: movement.createdAt,
    };
    const invoice = {
      id: invoiceId,
      revision: 1,
      status: 'draft',
      supplierId,
      supplierName: 'Supplier',
      warehouseId,
      warehouseName: warehouse.name,
      branchName: warehouse.branchName,
      supplierInvoiceNumber: 'INV-44',
      lines: [
        {
          id: productId,
          stockItemId: selectedId,
          stockItemName: selectedItem.name,
          baseUnit: 'g',
          unitName: 'gram',
          condition: 'available',
          quantity: '500',
          unitCode: 'g',
          position: 0,
        },
      ],
      confirmedAt: null,
      confirmedBy: null,
      createdBy: 'audit',
      updatedBy: 'audit',
      createdAt: movement.createdAt,
      updatedAt: movement.createdAt,
    };
    let invoiceDetailReads = 0;
    await page.route('**/owner/inventory/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(`/movements/${movementId}`))
        return route.fulfill({ json: movement });
      if (url.pathname.endsWith('/movements'))
        return route.fulfill({ json: { items: [movement], nextCursor: null } });
      if (url.pathname.endsWith('/balances'))
        return route.fulfill({ json: { items: [balance], nextCursor: null } });
      if (url.pathname.endsWith(`/items/${selectedId}`))
        return route.fulfill({ json: selectedItem });
      if (url.pathname.endsWith('/health'))
        return route.fulfill({
          json: {
            items: [],
            nextCursor: null,
            summary: {
              configuredItemLocations: 0,
              lowStockItemLocations: 0,
              healthyItemLocations: 0,
            },
          },
        });
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });
    await page.route('**/owner/purchasing/invoices**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(`/${invoiceId}`)) {
        invoiceDetailReads++;
        return route.fulfill({ json: invoice });
      }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });

    await page.goto(`http://127.0.0.1:5274/inventory/items/${selectedId}`);
    await expect(page.getByRole('heading', { name: selectedItem.name, level: 1 })).toBeVisible();
    await page
      .getByRole('link', { name: ar ? 'عرض الحركة' : 'View movement', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: ar ? 'تفاصيل الحركة' : 'Movement details', level: 1 }),
    ).toBeVisible();
    const sourceLink = page.getByRole('link', {
      name: ar ? 'عرض فاتورة الشراء' : 'View purchase invoice',
      exact: true,
    });
    await expect(sourceLink).toHaveAttribute('href', `/inventory/purchases/${invoiceId}`);
    await expect(page.getByRole('link', { name: selectedItem.name, exact: true })).toHaveAttribute(
      'href',
      `/inventory/items/${selectedId}`,
    );
    await sourceLink.click();
    await expect(page).toHaveURL(`http://127.0.0.1:5274/inventory/purchases/${invoiceId}`);
    const review = page.getByRole('dialog', {
      name: ar ? 'مراجعة فاتورة المورد' : 'Review supplier invoice',
      exact: true,
    });
    await expect(review).toBeVisible();
    await expect(review).toContainText('INV-44');
    expect(invoiceDetailReads).toBe(1);
  });

  test(`stock health shows scoped counts and saves a reorder point (${locale})`, async ({
    page,
  }) => {
    await authenticate(page, locale);
    const ar = locale === 'ar';
    const healthQueries: URL[] = [];
    const writes: Record<string, unknown>[] = [];
    await page.route('**/owner/inventory/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/health')) {
        healthQueries.push(url);
        return route.fulfill({
          json: {
            items: [
              {
                thresholdId: supplierId,
                warehouseId,
                warehouseName: warehouse.name,
                branchId: merchantId,
                branchName: warehouse.branchName,
                stockItemId: selectedId,
                stockItemName: selectedItem.name,
                baseUnit: 'g',
                minimumAvailableQuantity: '3',
                availableQuantity: '2',
                state: 'low',
                revision: 1,
                updatedAt: '2026-10-18T10:00:00.000Z',
              },
            ],
            nextCursor: null,
            summary: {
              configuredItemLocations: 4,
              lowStockItemLocations: 2,
              healthyItemLocations: 2,
            },
          },
        });
      }
      if (url.pathname.endsWith('/reorder-threshold') && route.request().method() === 'PATCH') {
        writes.push(route.request().postDataJSON());
        return route.fulfill({
          json: {
            id: supplierId,
            warehouseId,
            stockItemId: selectedId,
            minimumAvailableQuantity: '4.5',
            revision: 2,
            updatedAt: '2026-10-19T10:00:00.000Z',
          },
        });
      }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });

    await page.goto('http://127.0.0.1:5274/inventory/health');
    const summary = page.locator('.inventory-health-summary');
    await expect(summary.locator('> div').nth(2).locator('strong')).toHaveText('4');
    await page
      .getByRole('button', { name: ar ? 'تعديل الحد' : 'Edit threshold', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: ar ? 'تعديل حد إعادة الطلب' : 'Edit reorder point',
      exact: true,
    });
    await dialog.locator('input[inputmode="decimal"]').fill('4.5');
    await dialog
      .getByRole('button', { name: ar ? 'حفظ الحد' : 'Save threshold', exact: true })
      .click();
    await expect.poll(() => writes).toEqual([{ revision: 1, minimumAvailableQuantity: '4.5' }]);
    await expect.poll(() => healthQueries.length).toBeGreaterThan(1);
  });
}
