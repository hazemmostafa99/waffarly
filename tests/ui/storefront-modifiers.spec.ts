import { expect, test } from '@playwright/test';
import type { CatalogProductQuoteRequest } from '@waffarly/contracts';

test('modifier quantities survive distinct cart lines, reload and a variant switch', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('waffarly-locale', 'en'));
  const requests: CatalogProductQuoteRequest[] = [];
  await page.route('**/products/product/quote', async (route) => {
    const request = route.request().postDataJSON() as CatalogProductQuoteRequest;
    requests.push(request);
    const options =
      request.selections?.flatMap((selection) =>
        selection.optionIds.map((optionId) => ({
          optionId,
          quantity:
            selection.optionQuantities?.find((value) => value.optionId === optionId)?.quantity ?? 1,
          unitPriceAdjustment: optionId === 'cheese' ? '3.00' : '2.00',
        })),
      ) ?? [];
    const total = options.reduce(
      (sum, option) => sum + Number(option.unitPriceAdjustment) * option.quantity,
      0,
    );
    await route.fulfill({
      json: {
        productId: 'product',
        productRevision: 1,
        variantId: request.variantId,
        variantName: request.variantId,
        variantAttributes: [],
        currency: 'EGP',
        basePrice: '20.00',
        modifierTotal: total.toFixed(2),
        totalPrice: (20 + total).toFixed(2),
        selections: [
          {
            groupId: 'assignment',
            modifierGroupId: 'definition',
            optionIds: options.map((option) => option.optionId),
            options,
            priceAdjustment: total.toFixed(2),
          },
        ],
      },
    });
  });
  await page.goto('http://127.0.0.1:3101/s/m5/products/product');
  await page.getByRole('spinbutton', { name: 'Cheese Quantity', exact: true }).fill('3');
  await page.getByRole('spinbutton', { name: 'Sauce Quantity', exact: true }).fill('2');
  await page.getByRole('button', { name: /Add to basket/i }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]?.selections?.[0]?.optionQuantities).toEqual([
    { optionId: 'cheese', quantity: 3 },
    { optionId: 'sauce', quantity: 2 },
  ]);
  await page.getByRole('spinbutton', { name: 'Cheese Quantity', exact: true }).fill('1');
  await page.getByRole('button', { name: /Add to basket/i }).click();
  await expect.poll(() => requests.length).toBe(2);
  await page.goto('http://127.0.0.1:3101/s/m5/cart');
  await expect(page.getByText('Extras: Cheese × 3', { exact: false })).toBeVisible();
  await expect(page.getByText('Extras: Cheese × 1', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Extras: Cheese × 3', { exact: false })).toBeVisible();
  await page.goto('http://127.0.0.1:3101/s/m5/products/product');
  await page.getByRole('radio', { name: /small/i }).check();
  await expect(page.getByRole('spinbutton', { name: 'Cheese Quantity', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: /Add to basket/i }).click();
  await expect.poll(() => requests.at(-1)?.variantId).toBe('small');
  expect(requests.at(-1)?.selections?.[0]?.optionIds).toEqual(['sauce']);
});

test('legacy carts retain favorites and merge quantity-one selections after migration', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('waffarly-locale', 'en');
    if (!localStorage.getItem('waffarly:storefront:m5:v1'))
      localStorage.setItem(
        'waffarly:storefront:m5:v1',
        JSON.stringify({
          version: 1,
          state: {
            favorites: ['product'],
            cart: [
              {
                key: 'legacy-key',
                productId: 'product',
                variantId: 'large',
                selections: [{ groupId: 'assignment', optionIds: ['cheese', 'sauce'] }],
                quantity: 1,
                unitPriceSnapshot: '25.00',
              },
            ],
          },
        }),
      );
  });
  await page.route('**/products/product/quote', (route) =>
    route.fulfill({
      json: {
        productId: 'product',
        productRevision: 1,
        variantId: 'large',
        variantName: 'large',
        variantAttributes: [],
        currency: 'EGP',
        basePrice: '20.00',
        modifierTotal: '5.00',
        totalPrice: '25.00',
        selections: [
          {
            groupId: 'assignment',
            modifierGroupId: 'definition',
            optionIds: ['cheese', 'sauce'],
            options: [
              { optionId: 'cheese', quantity: 1, unitPriceAdjustment: '3.00' },
              { optionId: 'sauce', quantity: 1, unitPriceAdjustment: '2.00' },
            ],
            priceAdjustment: '5.00',
          },
        ],
      },
    }),
  );
  await page.goto('http://127.0.0.1:3101/s/m5/cart');
  await expect(page.getByText('Extras: Cheese × 1', { exact: false })).toBeVisible();
  await page.goto('http://127.0.0.1:3101/s/m5/products/product');
  await page.getByRole('button', { name: /Add to basket/i }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('waffarly:storefront:m5:v1')!);
        return {
          version: saved.version,
          favorites: saved.state.favorites,
          quantities: saved.state.cart.map((line: { quantity: number }) => line.quantity),
        };
      }),
    )
    .toEqual({ version: 2, favorites: ['product'], quantities: [2] });
});
