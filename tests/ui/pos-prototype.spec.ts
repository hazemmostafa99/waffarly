import { expect, test } from '@playwright/test';

test('isolated selling preview, theme/RTL, customization, and draft context', async ({ page }) => {
  const liveRequests: string[] = [];
  await page.route('**/auth/pos/**', (route) => {
    liveRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/prototype');
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Current order' })).toBeVisible();
  const productGrid = page.getByTestId('product-grid');
  expect(
    await productGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(4);
  expect(
    await productGrid
      .locator('.product-card > div.relative')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBe(96);
  await page.screenshot({ path: 'test-results/pos-prototype-light.png', fullPage: true });
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/pos-prototype-dark-orange.png', fullPage: true });
  await page.getByRole('button', { name: 'POS accent preview', exact: true }).click();
  await page.getByRole('button', { name: 'Teal', exact: true }).click();
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'teal');
  await page.screenshot({ path: 'test-results/pos-prototype-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Add item: Chocolate dream', exact: true }).click();
  const configure = page.getByRole('dialog', { name: 'Chocolate dream', exact: true });
  await configure.getByRole('button', { name: 'Large', exact: false }).click();
  await configure.getByLabel('Extra berries', { exact: false }).check();
  await configure.getByLabel('Kitchen note', { exact: true }).fill('Sauce on the side');
  await configure.getByRole('button', { name: 'Add to order', exact: false }).click();
  await expect(page.getByTestId('order-lines')).toContainText('Sauce on the side');
  await page.getByRole('button', { name: 'Switch language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'القائمة', exact: true })).toBeVisible();
  await expect(page.getByTestId('order-lines')).toContainText('Sauce on the side');
  await page.screenshot({ path: 'test-results/pos-prototype-arabic-dark.png', fullPage: true });
  await page.getByLabel('المظهر', { exact: true }).selectOption('light');
  await page.screenshot({ path: 'test-results/pos-prototype-arabic-light.png', fullPage: true });
  expect(liveRequests).toEqual([]);
  await page.reload();
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-accent', 'teal');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(
    await page
      .getByTestId('product-grid')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(5);
});

test('table rounds, split checks, partial tender and interrupted-payment recovery', async ({
  page,
}) => {
  await page.goto('/prototype');
  await page.getByRole('button', { name: 'Send new items', exact: false }).click();
  await expect(page.getByRole('status')).toContainText('New items sent');
  await page.getByRole('button', { name: 'Split bill', exact: true }).click();
  const split = page.getByRole('dialog', { name: 'Split the bill', exact: true });
  await page.screenshot({ path: 'test-results/pos-prototype-split.png', fullPage: true });
  await split.getByRole('button', { name: 'Confirm split', exact: true }).click();
  await page.getByRole('button', { name: 'Take payment', exact: false }).click();
  const checkout = page.getByRole('dialog', { name: 'Take payment', exact: true });
  await checkout.getByLabel('Payment amount', { exact: true }).fill('50');
  await checkout.getByLabel('Cash received', { exact: true }).fill('100');
  await checkout.getByLabel('Preview an interrupted payment reply').check();
  await checkout.getByRole('button', { name: 'Record cash payment', exact: false }).click();
  await expect(checkout.getByRole('heading', { name: 'Check the payment result' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/pos-prototype-payment-recovery.png',
    fullPage: true,
  });
  await checkout.getByRole('button', { name: 'Check saved result', exact: false }).click();
  await expect(
    checkout.getByRole('heading', { name: 'Check the payment result' }),
  ).not.toBeVisible();
  await checkout.getByLabel('Preview an interrupted payment reply').uncheck();
  await checkout.getByRole('button', { name: 'External terminal', exact: true }).click();
  await checkout
    .getByRole('button', { name: 'Record confirmed terminal payment', exact: false })
    .click();
  await checkout.getByRole('button', { name: 'Check 2', exact: false }).click();
  await checkout
    .getByRole('button', { name: 'Record confirmed terminal payment', exact: false })
    .click();
  await expect(checkout.getByRole('heading', { name: 'All checks are paid' })).toBeVisible();
  await checkout.getByRole('button', { name: 'View sample receipt' }).click();
  const receipt = page.getByRole('dialog', { name: 'Sample receipt' });
  await expect(receipt).toContainText('SAMPLE · NOT A FISCAL DOCUMENT');
  await expect(receipt.locator('.receipt-paper')).toBeVisible();
  await expect(receipt.locator('.receipt-paper')).toContainText('Change given');
  await page.screenshot({ path: 'test-results/pos-prototype-receipt-80mm.png', fullPage: true });
  await page.evaluate(() => {
    const state = window as Window & { __printCalled?: boolean };
    state.__printCalled = false;
    window.print = () => {
      state.__printCalled = true;
    };
  });
  await receipt.getByRole('button', { name: 'Print 80 mm / save as PDF' }).click();
  expect(
    await page.evaluate(() => (window as Window & { __printCalled?: boolean }).__printCalled),
  ).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'test-results/pos-prototype-receipt-print.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await receipt.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
  await page.screenshot({ path: 'test-results/pos-prototype-kitchen.png', fullPage: true });
  const ticket = page.getByRole('article').filter({ hasText: '#1048' });
  await ticket.getByRole('button', { name: 'Start new items', exact: false }).click();
  await ticket.getByRole('button', { name: 'Mark order ready', exact: false }).click();
  await page.getByRole('button', { name: 'Table 4 In progress', exact: false }).click();
  await page.getByRole('button', { name: 'Confirm handover', exact: false }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Table 4 · Available', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/pos-prototype-tables.png', fullPage: true });
});

test('delivery context requires actionable customer details and occupied tables resume safely', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/prototype');
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
  expect(
    await page
      .getByTestId('product-grid')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(1);
  await page.getByRole('main').getByRole('button', { name: 'New order', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'New order', exact: true });
  await expect(picker).toHaveClass(/pos-context-dialog/);
  await page.screenshot({ path: 'test-results/pos-prototype-context-mobile.png' });
  await picker.getByRole('button', { name: 'Delivery', exact: true }).click();
  await picker.getByLabel('Customer name', { exact: true }).fill('Maha Hassan');
  await picker.getByLabel('Phone number', { exact: true }).fill('+201001234567');
  await picker.getByLabel('Delivery address', { exact: true }).fill('12 Nile Street, Maadi');
  await expect(picker).toContainText('Not configured in this preview');
  await picker.getByRole('button', { name: 'Start order', exact: true }).click();
  await page.getByRole('button', { name: 'View order', exact: false }).click();
  await expect(page.getByRole('complementary', { name: 'Current order' })).toContainText(
    'Maha Hassan',
  );
  await expect(page.getByRole('complementary', { name: 'Current order' })).toContainText(
    'Delivery',
  );
  await page
    .getByRole('button', { name: 'Order type: Delivery · Maha Hassan', exact: true })
    .click();
  const settings = page.getByRole('dialog', { name: 'Order settings', exact: true });
  await settings.getByRole('button', { name: 'Dine in', exact: true }).click();
  await expect(settings.getByRole('button', { name: '#04', exact: false })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page
    .getByRole('complementary', { name: 'Current order' })
    .getByRole('button', { name: 'New order', exact: true })
    .click();
  const newOrder = page.getByRole('dialog', { name: 'New order', exact: true });
  await newOrder.getByRole('button', { name: 'Dine in', exact: true }).click();
  await newOrder.getByRole('button', { name: '#04 Open', exact: true }).click();
  await newOrder.getByRole('button', { name: 'Resume open table', exact: true }).click();
  await page.getByRole('button', { name: 'View order', exact: false }).click();
  await expect(page.getByRole('complementary', { name: 'Current order' })).toContainText(
    'Table 04',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('main').getByRole('button', { name: 'New order', exact: true }).click();
  await expect(page.locator('[data-slot="popover"].pos-context-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slot="popover"].pos-context-popover')).not.toBeVisible();
});

test('search, focus/escape, and narrow touch viewport remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/prototype');
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
  expect(
    await page
      .getByTestId('product-grid')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(3);
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search menu', { exact: true })).toBeFocused();
  await page.getByLabel('Search menu', { exact: true }).fill('no such menu item');
  await expect(page.getByRole('heading', { name: 'No matching items' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Add item: Classic waffle', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Classic waffle' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Classic waffle' })).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add item: Classic waffle', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'View order', exact: false }).click();
  await expect(page.getByRole('complementary', { name: 'Current order' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-prototype-tablet.png', fullPage: true });
});

test('small Arabic touch screen, system theme, and visible order access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/prototype');
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  await expect(page.locator('.pos-theme')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch language', exact: true }).click();
  await page.getByRole('button', { name: 'عرض الطلب', exact: false }).click();
  const orderPanel = page.getByRole('complementary', { name: 'الطلب الحالي' });
  await expect(orderPanel).toBeVisible();
  const draftLine = orderPanel.getByTestId('order-draft-line');
  expect(await draftLine.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('0px');
  expect(
    await draftLine.evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBeLessThanOrEqual(68);
  expect(
    await orderPanel
      .getByTestId('order-line-control-surface')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBe(28);
  expect(
    await orderPanel
      .getByTestId('increase-order-line')
      .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBeGreaterThanOrEqual(44);
  expect(
    await orderPanel
      .getByTestId('order-sent-line-row')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBeLessThanOrEqual(28);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/pos-prototype-phone-arabic.png', fullPage: true });
});
