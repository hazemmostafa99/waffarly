import { expect, test } from '@playwright/test';

test('detail navigation changes route content and restores listing history', async ({ page }) => {
  await page.goto('/marketplace/products/1');
  await expect(page.locator('.product-detail')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي', exact: true });
  await nav.getByRole('link', { name: 'السوبر ماركت', exact: true }).click();
  await expect(page).toHaveURL(/\/marketplace\?category=grocery#deals$/);
  await expect(page.locator('.product-detail')).toHaveCount(0);
  await expect(page.locator('#deals')).toContainText('لا توجد منتجات مطابقة لبحثك.');
  await page.goBack();
  await expect(page).toHaveURL(/\/marketplace\/products\/1$/);
  await expect(page.locator('.product-detail')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'التنقل الرئيسي', exact: true })
    .getByRole('link', { name: 'المطاعم', exact: true })
    .click();
  await expect(page).toHaveURL(/\/marketplace#restaurants$/);
  await expect(page.locator('#restaurants')).toBeVisible();
  await expect(page.locator('.product-detail')).toHaveCount(0);
  await page.getByRole('button', { name: 'القائمة', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'القائمة', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'الأجهزة', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/marketplace\?category=electronics#deals$/);
  await page.getByRole('searchbox', { name: 'ابحث في وفّرلي' }).fill('سماعة');
  await page.getByRole('search').getByRole('button', { name: 'بحث', exact: true }).click();
  await expect(page).toHaveURL(/category=electronics&q=.+#deals$/);
  await expect(page.locator('#deals .product')).toHaveCount(1);
  await expect(page.locator('.product-detail')).toHaveCount(0);
});

test('recommendations switch product details, reset quantity and share the local basket', async ({
  page,
}, testInfo) => {
  await page.goto('/marketplace/products/1');
  await page.getByRole('button', { name: 'زيادة الكمية', exact: true }).click();
  await expect(page.locator('.detail-quantity output')).toHaveText('2');
  const recommendations = page.locator('.product-recommendations');
  await expect(recommendations.locator('.product')).toHaveCount(4);
  await expect(recommendations.locator('.related')).toHaveText('من نفس القسم');
  await recommendations.locator('.product h3 a').first().click();
  await expect(page).toHaveURL(/\/marketplace\/products\/0$/);
  await expect(page.locator('.product-detail h1')).toContainText('سماعة');
  await expect(page.locator('.detail-quantity output')).toHaveText('1');
  await page
    .locator('.detail-purchase')
    .getByRole('button', { name: 'أضف للسلة', exact: true })
    .click();
  const cart = page.getByRole('dialog', { name: 'سلة التسوق', exact: true });
  await expect(cart).toBeVisible();
  await expect(cart.locator('.total')).toContainText('1,299');
  await cart.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await expect(cart).toBeHidden();
  await expect(page.locator('.overlay')).not.toHaveClass(/show/);
  await expect(page.locator('.detail-purchase .add')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('product-detail.png'),
    fullPage: true,
    animations: 'disabled',
  });
});
