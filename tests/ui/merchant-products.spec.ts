import { expect, test, type Page } from '@playwright/test';

const imageUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="7" fill="#def7e9"/><path d="M7 16c0-6 4-9 11-9s11 3 11 9" fill="#efa72e"/><rect x="7" y="16" width="22" height="4" rx="2" fill="#006047"/><rect x="7" y="20" width="22" height="4" rx="2" fill="#f3cf65"/><rect x="7" y="24" width="22" height="5" rx="2" fill="#efa72e"/></svg>')}`;
const categories = ['برجر', 'وافل وحلويات', 'مقبلات', 'مشروبات', 'أخرى'].map((name, index) => ({
  id: `category-${index}`,
  name,
  parentId: null,
  availability: 'available',
  archivedAt: null,
  revision: 1,
  effectiveVisible: true,
  image: { id: 'image-1', publicUrl: imageUrl },
}));
const names = [
  'برجر سيجنتشر',
  'برجر كلاسيك',
  'بطاطس ترافل',
  'وافل كلاسيك',
  'وافل دجاج',
  'آيس لاتيه',
];

async function mockCatalog(page: Page, empty = false, includeArchived = false) {
  let products = Array.from({ length: empty ? 0 : 24 }, (_, index) => ({
    id: `product-${index + 1}`,
    name: `${names[index % names.length]} ${String(index + 1).padStart(2, '0')}`,
    basePrice: String(65 + index * 5),
    availability: index < 18 ? 'available' : 'unavailable',
    archivedAt: null as string | null,
    revision: 1,
    variants: [],
    images: [{ mediaAssetId: 'image-1', publicUrl: imageUrl, isPrimary: true }],
    categories: [categories[index % categories.length]!],
  }));
  if (includeArchived) {
    products.push({
      id: 'archived-product',
      name: 'Archived Burger',
      basePrice: '99.00',
      availability: 'unavailable',
      archivedAt: '2026-10-13',
      revision: 2,
      variants: [],
      images: [{ mediaAssetId: 'image-1', publicUrl: imageUrl, isPrimary: true }],
      categories: [categories[0]!],
    });
  }
  const mutations: { method: string; path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'ahmed',
        merchantName: 'Waffarly',
        ownerName: 'أحمد علي',
        ownerMobile: '01012345678',
        contactPhone: '0212345678',
        activity: 'restaurant',
      },
    }),
  );
  await page.route('**/owner/catalog/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      await route.fulfill({
        json: path.endsWith('/products')
          ? products
          : path.endsWith('/categories')
            ? categories
            : path.endsWith('/modifier-groups')
              ? []
              : [
                  {
                    id: 'image-1',
                    storageKey: 'burger.svg',
                    publicUrl: imageUrl,
                    mimeType: 'image/svg+xml',
                    sizeBytes: 500,
                  },
                ],
      });
      return;
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    mutations.push({ method: request.method(), path, body });
    if (request.method() === 'PATCH') {
      products = products.map((product) =>
        path.endsWith(`/${product.id}`)
          ? ({
              ...product,
              ...body,
              revision: product.revision + 1,
            } as typeof product)
          : product,
      );
    } else if (path.endsWith('/archive')) {
      products = products.map((product) =>
        path.endsWith(`/${product.id}/archive`)
          ? { ...product, archivedAt: '2026-10-13' }
          : product,
      );
    } else if (path.endsWith('/restore')) {
      products = products.map((product) =>
        path.endsWith(`/${product.id}/restore`)
          ? {
              ...product,
              archivedAt: null,
              availability: 'unavailable',
              revision: product.revision + 1,
            }
          : product,
      );
    } else {
      products.push({
        id: `created-${products.length}`,
        name: String(body.name),
        basePrice: String(body.basePrice),
        availability: String(body.availability),
        description: String(body.description),
        archivedAt: null,
        revision: 1,
        variants: [],
        images: [{ mediaAssetId: 'image-1', publicUrl: imageUrl, isPrimary: true }],
        categories: [categories[0]!],
      });
    }
    await route.fulfill({ json: { saved: true } });
  });
  return mutations;
}

test('Arabic products layout, real totals, responsive table, and pagination', async ({
  page,
}, testInfo) => {
  await mockCatalog(page);
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'ar'));
  await page.goto('http://127.0.0.1:5274/products');
  await expect(page.getByRole('heading', { name: 'المنتجات', exact: true })).toBeVisible();
  await expect(page.locator('.wf-summary-card')).toHaveCount(4);
  await expect(page.locator('.wf-summary-card').nth(0)).toContainText('24');
  await expect(page.locator('.wf-summary-card').nth(1)).toContainText('18');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  if (testInfo.project.name === 'desktop') {
    const chart = await page.locator('.products-distribution').boundingBox();
    const table = await page.locator('.products-table-card').boundingBox();
    expect(chart!.x).toBeGreaterThan(table!.x);
    await page.setViewportSize({ width: 976, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(976);
  }
  await page.screenshot({ path: testInfo.outputPath('products-arabic.png'), fullPage: true });
  await page.getByRole('button', { name: 'صفحة 4', exact: true }).click();
  await expect(page.getByRole('button', { name: 'صفحة 4', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'الصفحة التالية' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'حالة النشر', exact: true }).selectOption('unavailable');
  await expect(page.getByRole('button', { name: 'صفحة 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: 'تغيير اللغة' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
});

test('search and category filters reset paging and selection; sort orders prices', async ({
  page,
}) => {
  await mockCatalog(page);
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('button', { name: 'Page 4', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select all on this page' }).check();
  await expect(page.getByRole('combobox', { name: 'Bulk actions' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('product-24');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Bulk actions' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('category-0');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(5);
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('price-desc');
  await expect(page.locator('.wf-data-table tbody tr').first()).toContainText('EGP 165.00');
  await page.getByRole('textbox', { name: 'Search catalog', exact: true }).fill('no match');
  await expect(page.getByText('No matching products.')).toBeVisible();
  await expect(page.locator('.wf-summary-card').first()).toContainText('24');
});

test('product creation uses the catalog builder and posts the reviewed product', async ({
  page,
}) => {
  const mutations = await mockCatalog(page);
  await page.goto('http://127.0.0.1:5274/products');
  const add = page.getByRole('button', { name: 'Add Product', exact: true });
  await add.click();
  await expect(page.getByRole('heading', { name: 'Create a product', exact: true })).toBeVisible();
  await page.locator('.basic-product-name input').fill('New Burger');
  await page.locator('.basic-name-price-row input[type="number"]').fill('149.50');
  await page.locator('.basic-description summary').click();
  await page.locator('.basic-description textarea').fill('Freshly prepared');
  await page.getByRole('button', { name: 'Browse categories', exact: true }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Choose from library', exact: true }).click();
  const mediaDialog = page.getByRole('dialog', { name: 'Choose product photos', exact: true });
  await mediaDialog.locator('.media-library-option').first().click();
  await mediaDialog.getByRole('button', { name: 'Apply selected photos', exact: true }).click();
  await page.getByRole('button', { name: /Next: Options/ }).click();
  await page.getByRole('button', { name: 'Continue without choices', exact: true }).click();
  await page.getByRole('button', { name: 'Review product', exact: true }).click();
  await page.locator('input[name="availability"]').nth(1).check();
  await page.getByRole('button', { name: 'Create as unavailable', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  await expect(
    page.getByRole('heading', { name: 'Products', level: 1, exact: true }),
  ).toBeVisible();
  expect(mutations[0]?.body).toMatchObject({
    name: 'New Burger',
    basePrice: '149.50',
    description: 'Freshly prepared',
    categoryIds: ['category-0'],
    imageAssetIds: ['image-1'],
    primaryImageAssetId: 'image-1',
    availability: 'unavailable',
    modifierGroupAssignments: [],
    variants: [],
  });
  await expect(page.locator('.wf-summary-card').first()).toContainText('25');
});

test('product edits use the builder and preserve the loaded revision', async ({ page }) => {
  await mockCatalog(page);
  let saved: Record<string, unknown> | undefined;
  await page.route('**/owner/catalog/products/product-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { id: 'product-1' } });
      return;
    }
    await route.fulfill({
      json: {
        id: 'product-1',
        name: 'Original Burger',
        description: 'Original description',
        basePrice: '70.00',
        availability: 'available',
        revision: 3,
        images: [{ mediaAssetId: 'image-1', publicUrl: imageUrl, isPrimary: true, position: 0 }],
        categories: [{ id: 'category-0', name: categories[0]!.name }],
        modifierGroups: [],
        variants: [],
        inventoryConfiguration: null,
        inventoryConfigurationRequired: false,
        inventoryDefaultMode: 'DIRECT',
      },
    });
  });
  await page.goto('http://127.0.0.1:5274/products/product-1/edit');
  await expect(page.getByRole('heading', { name: 'Edit product', exact: true })).toBeVisible();
  await expect(page.locator('.basic-product-name input')).toHaveValue('Original Burger');
  await page.locator('.basic-product-name input').fill('Updated Burger');
  await page.locator('.basic-name-price-row input[type="number"]').fill('155.00');
  await page.getByRole('tab', { name: /Preview and publish/ }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  expect(saved).toMatchObject({
    revision: 3,
    name: 'Updated Burger',
    basePrice: '155.00',
    categoryIds: ['category-0'],
    imageAssetIds: ['image-1'],
  });
});

test('a failed catalog refresh after save does not create the product twice', async ({ page }) => {
  const mutations = await mockCatalog(page);
  let failNextList = false;
  let createRequests = 0;
  await page.route('**/owner/catalog/products', async (route) => {
    if (route.request().method() === 'POST') {
      createRequests++;
      failNextList = true;
      await route.fallback();
      return;
    }
    if (route.request().method() === 'GET' && failNextList) {
      failNextList = false;
      await route.fulfill({ status: 503, json: { message: 'Refresh unavailable' } });
      return;
    }
    await route.fallback();
  });
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await page.locator('.basic-product-name input').fill('Saved Burger');
  await page.locator('.basic-name-price-row input[type="number"]').fill('155.00');
  await page.getByRole('button', { name: 'Browse categories', exact: true }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Choose from library', exact: true }).click();
  const mediaDialog = page.getByRole('dialog', { name: 'Choose product photos', exact: true });
  await mediaDialog.locator('.media-library-option').first().click();
  await mediaDialog.getByRole('button', { name: 'Apply selected photos', exact: true }).click();
  await page.getByRole('button', { name: /Next: Options/ }).click();
  await page.getByRole('button', { name: 'Continue without choices', exact: true }).click();
  await page.getByRole('button', { name: 'Review product', exact: true }).click();
  await page.locator('input[name="availability"]').nth(1).check();
  await page.getByRole('button', { name: 'Create as unavailable', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  await expect(page.getByRole('alert')).toContainText('Refresh unavailable');
  expect(createRequests).toBe(1);
  expect(mutations).toHaveLength(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(createRequests).toBe(1);
  expect(mutations).toHaveLength(1);
});

test('archived products can be viewed and restored as unavailable', async ({ page }) => {
  const mutations = await mockCatalog(page, false, true);
  await page.goto('http://127.0.0.1:5274/products');
  await page
    .getByRole('combobox', { name: 'Publication status', exact: true })
    .selectOption('archived');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.wf-data-table')).toContainText('Archived Burger');
  await page.getByRole('button', { name: 'Restore Archived Burger' }).click();
  await expect(page.getByText('Product restored as unavailable.', { exact: true })).toBeVisible();
  expect(mutations.at(-1)).toMatchObject({
    method: 'POST',
    path: '/owner/catalog/products/archived-product/restore',
    body: { revision: 2 },
  });
  await expect(page.getByText('No matching products.')).toBeVisible();
});

test('bulk hide updates only selected products and archive requires confirmation', async ({
  page,
}) => {
  const mutations = await mockCatalog(page);
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('checkbox', { name: 'Select all on this page' }).check();
  await page.getByRole('combobox', { name: 'Bulk actions' }).selectOption('unavailable');
  await expect(page.getByText('Products updated.', { exact: true })).toBeVisible();
  expect(mutations).toHaveLength(6);
  expect(mutations.every((request) => request.body.availability === 'unavailable')).toBe(true);
  await page.getByRole('checkbox', { name: 'Select all on this page' }).check();
  await page.getByRole('combobox', { name: 'Bulk actions' }).selectOption('archive');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(mutations).toHaveLength(6);
  await page.getByRole('combobox', { name: 'Bulk actions' }).selectOption('archive');
  await page.getByRole('button', { name: 'Archive (6)', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.wf-summary-card').first()).toContainText('18');
});

test('CSV import supports quoted names and previews before creating products', async ({ page }) => {
  const mutations = await mockCatalog(page, true);
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByLabel('CSV file').setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      '\uFEFFname,basePrice,availability\r\n"Burger, Deluxe",155.00,available\r\nLatte,85.00,unavailable',
    ),
  });
  await expect(page.getByRole('table', { name: 'Import preview' })).toContainText('Burger, Deluxe');
  await page
    .getByRole('combobox', { name: 'Category', exact: true })
    .last()
    .selectOption('category-0');
  await page.getByRole('combobox', { name: 'Product images', exact: true }).selectOption('image-1');
  await page.getByRole('button', { name: 'Import remaining products' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mutations).toHaveLength(2);
  expect(mutations[0]?.body.name).toBe('Burger, Deluxe');
  await expect(page.locator('.wf-summary-card').first()).toContainText('2');
});

test('empty catalog and failed loads show honest states', async ({ page }) => {
  await mockCatalog(page, true);
  await page.goto('http://127.0.0.1:5274/products');
  await expect(
    page.getByText('No products yet. Add your first product to get started.'),
  ).toBeVisible();
  await expect(page.locator('.wf-summary-card').first()).toContainText('0');
  await page.route('**/owner/catalog/products', (route) =>
    route.fulfill({ status: 500, json: { message: 'Catalog unavailable' } }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Catalog unavailable');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Catalog unavailable');
});

test('a partial import retries only remaining rows', async ({ page }) => {
  const mutations = await mockCatalog(page, true);
  let failOnce = true;
  await page.route('**/owner/catalog/products', async (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().postDataJSON().name === 'Latte' &&
      failOnce
    ) {
      failOnce = false;
      await route.fulfill({ status: 500, json: { message: 'Temporary failure' } });
    } else await route.fallback();
  });
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('CSV file').setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,basePrice\nBurger,145\nLatte,85'),
  });
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('category-0');
  await dialog
    .getByRole('combobox', { name: 'Product images', exact: true })
    .selectOption('image-1');
  await dialog.getByRole('button', { name: 'Import remaining products' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Import stopped.');
  await expect(dialog.getByRole('table', { name: 'Import preview' })).toContainText('Latte');
  await expect(dialog.getByRole('table', { name: 'Import preview' })).not.toContainText('Burger');
  await dialog.getByRole('button', { name: 'Import remaining products' }).click();
  await expect(dialog).toHaveCount(0);
  expect(mutations.map((request) => request.body.name)).toEqual(['Burger', 'Latte']);
  await expect(page.locator('.wf-summary-card').first()).toContainText('2');
});

test('cancelling product creation returns to the catalog without a write', async ({ page }) => {
  const mutations = await mockCatalog(page);
  await page.goto('http://127.0.0.1:5274/products');
  await page.getByRole('button', { name: 'Add Product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create a product', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5274/products');
  await expect(
    page.getByRole('heading', { name: 'Products', level: 1, exact: true }),
  ).toBeVisible();
  expect(mutations).toHaveLength(0);
});
