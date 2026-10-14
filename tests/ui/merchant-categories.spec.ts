import { expect, test, type Page } from '@playwright/test';

const image = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${color}"/><circle cx="32" cy="24" r="15" fill="#f3a628"/><rect x="13" y="32" width="38" height="8" rx="4" fill="#087858"/><rect x="15" y="42" width="34" height="8" rx="4" fill="#efb445"/></svg>`)}`;

const media = ['#fff1d7', '#e3f7ec', '#eaf2ff', '#fbe8ec', '#eee8fb'].map((color, index) => ({
  id: `image-${index + 1}`,
  storageKey: `category-${index + 1}.svg`,
  publicUrl: image(color),
  mimeType: 'image/svg+xml',
  sizeBytes: 500,
}));

type TestCategory = {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  availability: string;
  archivedAt: string | null;
  revision: number;
  effectiveVisible: boolean;
  childCount: number;
  productCount: number;
  image: (typeof media)[number];
};

function makeCategories(): TestCategory[] {
  const roots = ['البرجر', 'الوجبات', 'المشروبات', 'الحلويات', 'الإضافات', 'العروض'].map(
    (name, index): TestCategory => ({
      id: `root-${index + 1}`,
      name,
      description: `وصف ${name}`,
      parentId: null,
      parent: null,
      availability: index === 5 ? 'unavailable' : 'available',
      archivedAt: null,
      revision: 1,
      effectiveVisible: index !== 5,
      childCount: 2,
      productCount: 8 - index,
      image: media[index % media.length]!,
    }),
  );
  const children = roots.flatMap((root, rootIndex) =>
    [1, 2].map((childIndex): TestCategory => ({
      id: `child-${rootIndex + 1}-${childIndex}`,
      name: `${root.name} ${childIndex === 1 ? 'كلاسيك' : 'عائلية'}`,
      description: `تصنيف فرعي من ${root.name}`,
      parentId: root.id,
      parent: { id: root.id, name: root.name },
      availability: 'available',
      archivedAt: null,
      revision: 1,
      effectiveVisible: root.effectiveVisible,
      childCount: 0,
      productCount: childIndex + rootIndex,
      image: media[(rootIndex + childIndex) % media.length]!,
    })),
  );
  return [...roots, ...children];
}

async function mockCategoryCatalog(page: Page) {
  let categories = makeCategories();
  const mutations: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
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
        json: path.endsWith('/categories') ? categories : path.endsWith('/media') ? media : [],
      });
      return;
    }
    const body = request.postData()
      ? (request.postDataJSON() as Record<string, unknown>)
      : undefined;
    mutations.push({ method: request.method(), path, body });
    if (request.method() === 'POST' && path.endsWith('/categories')) {
      const parent = categories.find((category) => category.id === body?.parentId) ?? null;
      const created: TestCategory = {
        id: `created-${categories.length + 1}`,
        name: String(body?.name),
        description: String(body?.description ?? ''),
        parentId: parent?.id ?? null,
        parent: parent ? { id: parent.id, name: parent.name } : null,
        availability: String(body?.availability),
        archivedAt: null,
        revision: 1,
        effectiveVisible: body?.availability === 'available' && (parent?.effectiveVisible ?? true),
        childCount: 0,
        productCount: 0,
        image: media.find((item) => item.id === body?.imageAssetId) ?? media[0]!,
      };
      categories.push(created);
      await route.fulfill({ json: created });
      return;
    }
    if (request.method() === 'POST' && (path.endsWith('/archive') || path.endsWith('/restore'))) {
      const categoryId = path.split('/').at(-2)!;
      const restoring = path.endsWith('/restore');
      let saved = categories[0]!;
      categories = categories.map((category) => {
        if (category.id !== categoryId) return category;
        saved = {
          ...category,
          archivedAt: restoring ? null : '2026-10-14',
          availability: restoring ? 'unavailable' : category.availability,
          revision: category.revision + 1,
        };
        return saved;
      });
      await route.fulfill({ json: saved });
      return;
    }
    const id = path.split('/').at(-1)!;
    if (request.method() === 'PATCH') {
      let updated = categories[0]!;
      categories = categories.map((category) => {
        if (category.id !== id) return category;
        const parent = categories.find((item) => item.id === body?.parentId) ?? null;
        updated = {
          ...category,
          ...body,
          parentId: parent?.id ?? null,
          parent: parent ? { id: parent.id, name: parent.name } : null,
          effectiveVisible:
            body?.availability === 'available' && (parent?.effectiveVisible ?? true),
          revision: category.revision + 1,
          image: media.find((item) => item.id === body?.imageAssetId) ?? category.image,
        } as TestCategory;
        return updated;
      });
      await route.fulfill({ json: updated });
      return;
    }
    if (request.method() === 'DELETE') {
      categories = categories.filter((category) => category.id !== id);
    }
    await route.fulfill({ json: { saved: true } });
  });
  return mutations;
}

test('Arabic categories page matches the reference structure and stays responsive', async ({
  page,
}, testInfo) => {
  await mockCategoryCatalog(page);
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'ar'));
  await page.goto('http://127.0.0.1:5274/categories');
  await expect(page.getByRole('heading', { name: 'التصنيفات', exact: true })).toBeVisible();
  await expect(page.locator('.wf-summary-card')).toHaveCount(4);
  await expect(page.locator('.wf-summary-card')).toContainText(['17', '12', '6', '18']);
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'تفاصيل التصنيف' })).toBeVisible();
  await expect(page.getByLabel('اسم التصنيف')).toHaveValue('البرجر');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  if (testInfo.project.name === 'desktop') {
    const list = await page.locator('.categories-list-card').boundingBox();
    const editor = await page.locator('.categories-editor-card').boundingBox();
    const nameInput = await page.getByLabel('اسم التصنيف').boundingBox();
    expect(editor!.x).toBeGreaterThan(list!.x);
    expect(nameInput!.x).toBeGreaterThanOrEqual(editor!.x);
    expect(nameInput!.x + nameInput!.width).toBeLessThanOrEqual(editor!.x + editor!.width);
    await page.setViewportSize({ width: 976, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(976);
    const resizedEditor = await page.locator('.categories-editor-card').boundingBox();
    const resizedInput = await page.getByLabel('اسم التصنيف').boundingBox();
    expect(resizedInput!.x).toBeGreaterThanOrEqual(resizedEditor!.x);
    expect(resizedInput!.x + resizedInput!.width).toBeLessThanOrEqual(
      resizedEditor!.x + resizedEditor!.width,
    );
  }
  await page.screenshot({ path: testInfo.outputPath('categories-arabic.png'), fullPage: true });
});

test('category filters, sorting, selection, and pagination work', async ({ page }) => {
  await mockCategoryCatalog(page);
  await page.goto('http://127.0.0.1:5274/categories');
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('textbox', { name: 'Search categories' }).fill('الحلويات');
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Search categories' }).fill('');
  await page.getByRole('combobox', { name: 'All statuses' }).selectOption('unavailable');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'All statuses' }).selectOption('');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('products');
  await expect(page.locator('.wf-data-table tbody tr').first()).toContainText('البرجر');
  await page.getByRole('button', { name: 'Category details: المشروبات' }).click();
  await expect(page.getByLabel('Category name')).toHaveValue('المشروبات');
});

test('categories can be created and edited with parent, image, and visibility', async ({
  page,
}) => {
  const mutations = await mockCategoryCatalog(page);
  await page.goto('http://127.0.0.1:5274/categories');
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  await page.getByLabel('Category name').fill('Breakfast');
  await page.getByLabel('Description').fill('Morning menu');
  await page.getByLabel('Parent category').selectOption('root-1');
  await page.getByRole('button', { name: 'category-2.svg' }).click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  expect(mutations[0]).toMatchObject({
    method: 'POST',
    body: {
      name: 'Breakfast',
      description: 'Morning menu',
      parentId: 'root-1',
      availability: 'unavailable',
      imageAssetId: 'image-2',
    },
  });
  await expect(page.getByLabel('Category name')).toHaveValue('Breakfast');
  await page.getByLabel('Category name').fill('Breakfast Menu');
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(mutations[1]?.method).toBe('PATCH');
  expect(mutations[1]?.body).toMatchObject({ name: 'Breakfast Menu', revision: 1 });
});

test('deleting a category requires confirmation and refreshes totals', async ({ page }) => {
  const mutations = await mockCategoryCatalog(page);
  await page.goto('http://127.0.0.1:5274/categories');
  await page.getByRole('button', { name: 'Category details: البرجر كلاسيك' }).click();
  await page.getByRole('button', { name: 'Delete category' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('.products-button').getByText('Cancel', { exact: true }).click();
  expect(mutations).toHaveLength(0);
  await page.getByRole('button', { name: 'Delete category' }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(mutations[0]).toMatchObject({
    method: 'DELETE',
    path: '/owner/catalog/categories/child-1-1',
  });
  await expect(page.locator('.wf-summary-card').last()).toContainText('17');
});

test('categories can be archived, viewed, and restored as unavailable', async ({ page }) => {
  const mutations = await mockCategoryCatalog(page);
  const target = makeCategories().find((category) => category.id === 'root-3')!;
  await page.goto('http://127.0.0.1:5274/categories');
  await page.getByRole('button', { name: `Category details: ${target.name}` }).click();
  await page.getByRole('button', { name: 'Archive category' }).click();
  await expect(page.getByText('Category archived.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'All statuses' }).selectOption('archived');
  await expect(page.locator('.wf-data-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore category' }).click();
  await expect(page.getByText('Category restored as unavailable.', { exact: true })).toBeVisible();
  expect(mutations.slice(-2)).toMatchObject([
    { method: 'POST', path: '/owner/catalog/categories/root-3/archive', body: { revision: 1 } },
    { method: 'POST', path: '/owner/catalog/categories/root-3/restore', body: { revision: 2 } },
  ]);
});
