import { expect, test, type Page } from '@playwright/test';

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><rect width="360" height="240" fill="#efe4d4"/><ellipse cx="180" cy="210" rx="80" ry="10" fill="#d4c7b5"/><rect x="145" y="65" width="70" height="140" rx="12" fill="#fcfaf2"/><rect x="158" y="30" width="44" height="36" fill="#183d31"/><path d="M230 160q60-80 65 0q-25 40-65 0" fill="#63815c"/><text x="180" y="136" font-size="13" text-anchor="middle" fill="#2b5342">BOTANICAL</text></svg>')}`;
const fixtures = Array.from({ length: 25 }, (_, index) => ({
  id: `media-${index}`,
  storageKey: `catalog/${index === 0 ? 'serum-product' : index === 1 ? 'category-cover' : `image-${index}`}.${index % 2 ? 'png' : 'jpg'}`,
  publicUrl: image,
  mimeType: index % 2 ? 'image/png' : 'image/jpeg',
  sizeBytes: 1024 * 1024,
}));

async function mockLibrary(page: Page, { empty = false, failure = false } = {}) {
  let media = empty ? [] : [...fixtures];
  let fail = failure;
  const posts: Record<string, unknown>[] = [];
  await page.route('**/auth/owner/me', (route) =>
    route.fulfill({
      json: {
        username: 'ahmed',
        merchantName: 'Waffarly',
        ownerName: 'أحمد علي',
        ownerMobile: '01012345678',
        contactPhone: '0212345678',
        activity: 'retail',
      },
    }),
  );
  await page.route('**/owner/catalog/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      const isUpload = path.endsWith('/media/upload');
      const body = isUpload
        ? {
            storageKey: `catalog/${
              route
                .request()
                .postDataBuffer()
                ?.toString('latin1')
                .match(/filename="([^"]+)"/)?.[1] ?? 'uploaded-image.jpg'
            }`,
            publicUrl: 'http://localhost:4000/media/catalog/uploaded-image.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 6,
          }
        : (route.request().postDataJSON() as Record<string, unknown>);
      posts.push(isUpload ? { uploadedFile: body.storageKey } : body);
      const asset = {
        ...body,
        id: 'new-media',
        ...(isUpload ? { storageKey: body.storageKey } : {}),
      };
      media = [asset as (typeof fixtures)[number], ...media];
      await route.fulfill({ json: asset });
    } else if (path.endsWith('/media')) {
      if (fail) {
        fail = false;
        await route.fulfill({ status: 500, json: { message: 'Could not load media.' } });
      } else await route.fulfill({ json: media });
    } else if (path.endsWith('/products')) {
      await route.fulfill({
        json: empty ? [] : [{ id: 'product-1', images: [{ mediaAssetId: 'media-0' }] }],
      });
    } else
      await route.fulfill({ json: empty ? [] : [{ id: 'category-1', image: { id: 'media-1' } }] });
  });
  return posts;
}

test('Arabic gallery matches the reference, uses real totals, and fits the viewport', async ({
  page,
}, testInfo) => {
  await mockLibrary(page);
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'ar'));
  await page.goto('http://127.0.0.1:5274/media');
  await expect(page.getByRole('heading', { name: 'مكتبة الوسائط', exact: true })).toBeVisible();
  await expect(page.locator('.media-card')).toHaveCount(12);
  await expect(page.locator('.media-storage-ring')).toContainText('25 MB');
  await expect(page.locator('.media-type-row.images')).toContainText('25');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  if (testInfo.project.name === 'desktop') {
    const summary = await page.locator('.media-summary').boundingBox();
    const gallery = await page.locator('.media-gallery').boundingBox();
    expect(summary!.x).toBeGreaterThan(gallery!.x);
    await expect(page.locator('.media-grid')).toHaveCSS('grid-template-columns', /^(\S+ ){3}\S+$/);
    await page.setViewportSize({ width: 976, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(976);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.screenshot({ path: testInfo.outputPath('media-arabic.png'), fullPage: true });
  await page.getByRole('button', { name: 'صفحة 3', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'الصفحة التالية' })).toBeDisabled();
});

test('search, format, usage, and type filters reset pagination and preserve library totals', async ({
  page,
}) => {
  await mockLibrary(page);
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('http://127.0.0.1:5274/media');
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await page.getByRole('combobox', { name: 'Usage', exact: true }).selectOption('category');
  await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.locator('.media-file-name')).toHaveText('category-cover.png');
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('combobox', { name: 'Usage', exact: true }).selectOption('product');
  await expect(page.locator('.media-file-name')).toHaveText('serum-product.jpg');
  await page.getByRole('combobox', { name: 'Usage', exact: true }).selectOption('library');
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption('PNG');
  await expect(page.locator('.media-card')).toHaveCount(11);
  await page.getByRole('textbox', { name: 'Search media' }).fill('image-23');
  await expect(page.locator('.media-card')).toHaveCount(1);
  await expect(page.locator('.media-storage-ring')).toContainText('25 MB');
  await page.getByRole('combobox', { name: 'File type', exact: true }).selectOption('videos');
  await expect(page.getByRole('heading', { name: 'No matching files' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(12);
  await page.getByRole('textbox', { name: 'Search catalog', exact: true }).fill('serum');
  await expect(page.locator('.media-file-name')).toHaveText('serum-product.jpg');
});

test('previews, actions, and file selection work without mutating assets', async ({ page }) => {
  await mockLibrary(page);
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('http://127.0.0.1:5274/media');
  await page.getByRole('checkbox', { name: 'Select serum-product.jpg', exact: true }).check();
  await expect(page.locator('.media-selection')).toContainText('1 selected');
  await page.getByRole('button', { name: 'Selected files', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('serum-product.jpg');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'File actions serum-product.jpg', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'File actions serum-product.jpg', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('serum-product.jpg');
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.locator('.media-selection')).toHaveCount(0);
  await page.getByRole('button', { name: 'Storage details', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('25 Files in your library');
  await expect(page.getByRole('dialog')).toContainText('25 MB');
});

test('the image dialog uploads a local image into the library', async ({ page }) => {
  const posts = await mockLibrary(page, { empty: true });
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('http://127.0.0.1:5274/media');
  await page.getByRole('button', { name: 'Add media', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Upload from device' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByLabel('Choose image').setInputFiles({
    name: 'device-image.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  });
  await dialog.getByRole('button', { name: 'Upload image', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.media-file-name')).toHaveText('device-image.jpg');
  expect(posts).toEqual([{ uploadedFile: 'catalog/device-image.jpg' }]);
});

test('the image dialog persists valid API metadata and rejects unsafe URLs', async ({ page }) => {
  const posts = await mockLibrary(page, { empty: true });
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('http://127.0.0.1:5274/media');
  await expect(page.getByRole('heading', { name: 'Your media library starts here' })).toBeVisible();
  await page.getByRole('button', { name: 'Add media', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add by URL', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Image URL', exact: true })
    .fill('ftp://example.com/serum.jpg');
  await dialog.getByRole('textbox', { name: 'File name', exact: true }).fill('new-serum.jpg');
  await dialog.getByRole('spinbutton', { name: 'File size in bytes' }).fill('2048');
  await dialog.getByRole('button', { name: 'Add image', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Use a valid public HTTP or HTTPS image URL.',
  );
  expect(posts).toHaveLength(0);
  await dialog
    .getByRole('textbox', { name: 'Image URL', exact: true })
    .fill('https://example.com/serum.jpg');
  await dialog.getByRole('button', { name: 'Add image', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.media-file-name')).toHaveText('new-serum.jpg');
  expect(posts).toEqual([
    {
      publicUrl: 'https://example.com/serum.jpg',
      storageKey: 'new-serum.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
    },
  ]);
  await expect(page.locator('.media-storage-ring')).toContainText('2 KB');
});

test('failed library requests show a retry action and recover', async ({ page }) => {
  await mockLibrary(page, { failure: true });
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  await page.goto('http://127.0.0.1:5274/media');
  await expect(page.getByRole('alert')).toContainText('Could not load media.');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.media-card')).toHaveCount(12);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
