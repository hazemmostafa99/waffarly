import { createServer } from 'node:http';

// Read-only catalog fixture for server-rendered Storefront browser regressions.
const product = {
  id: 'product',
  name: 'Recipe bowl',
  description: '',
  basePrice: '20.00',
  currency: 'EGP',
  sellingUnit: 'piece',
  images: [],
  categories: [],
  variants: ['large', 'small'].map((id) => ({
    id,
    name: id,
    price: '20.00',
    availability: 'available',
    position: 0,
    attributes: [],
  })),
  modifierGroups: [
    {
      id: 'assignment',
      modifierGroupId: 'definition',
      name: 'Extras',
      description: null,
      selectionMode: 'multiple',
      minSelections: 1,
      maxSelections: 2,
      position: 0,
      options: [
        {
          id: 'cheese',
          name: 'Cheese',
          priceAdjustment: '2.00',
          defaultSelected: true,
          maxQuantity: 3,
          position: 0,
          variantOverrides: [
            { variantId: 'large', available: true, priceAdjustment: '3.00' },
            { variantId: 'small', available: false },
          ],
        },
        {
          id: 'sauce',
          name: 'Sauce',
          priceAdjustment: '2.00',
          defaultSelected: true,
          maxQuantity: 2,
          position: 1,
        },
      ],
    },
  ],
};
const catalog = {
  slug: 'm5',
  merchantName: 'M5 restaurant',
  activity: 'restaurant',
  accentColor: '#315b43',
  logoData: null,
  template: null,
  categories: [],
  products: [product],
  nextCategoryCursor: null,
  nextProductCursor: null,
};
createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(request.url === '/health' ? { ok: true } : catalog));
}).listen(4019, '127.0.0.1');
