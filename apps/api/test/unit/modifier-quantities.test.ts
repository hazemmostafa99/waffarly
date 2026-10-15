import assert from 'node:assert/strict';
import { it } from 'node:test';
import { selectedOptionQuantities } from '../../src/modules/catalog/pricing/modifier-selections.js';
import { ProductPricingService } from '../../src/modules/catalog/pricing/product-pricing.service.js';
import { calculateInventoryRequirements } from '../../src/modules/catalog/products/product-inventory.calculator.js';

it('normalizes legacy quantities and rejects duplicate, unselected, fractional and excessive metadata', () => {
  assert.deepEqual(
    [
      ...selectedOptionQuantities({
        groupId: 'g',
        optionIds: ['a', 'b'],
        optionQuantities: [{ optionId: 'a', quantity: 3 }],
      }),
    ],
    [
      ['a', 3],
      ['b', 1],
    ],
  );
  for (const optionQuantities of [
    [{ optionId: 'foreign', quantity: 1 }],
    [{ optionId: 'a', quantity: 1.1 }],
    [{ optionId: 'a', quantity: 0 }],
    [{ optionId: 'a', quantity: 100 }],
    [
      { optionId: 'a', quantity: 1 },
      { optionId: 'a', quantity: 2 },
    ],
  ]) {
    assert.throws(() =>
      selectedOptionQuantities({ groupId: 'g', optionIds: ['a'], optionQuantities }),
    );
  }
  assert.throws(() => selectedOptionQuantities({ groupId: 'g', optionIds: ['a', 'a'] }));
});

it('prices quantities 3 and 2 as two distinct choices with variant prices and caps', async () => {
  const group = {
    id: 'assignment',
    modifierGroupId: 'definition',
    selectionMode: 'multiple',
    minSelections: 2,
    maxSelections: 2,
    variantOverrides: [] as Array<{ variantId: string; available: boolean }>,
    modifierGroup: { name: 'Extras' },
    options: [
      {
        optionId: 'a',
        defaultSelected: true,
        maxQuantity: 3,
        priceAdjustment: '2.10',
        variantOverrides: [
          { variantId: 'v', available: true, priceAdjustment: '3.15', effectsOverride: false },
        ],
        effects: [],
      },
      {
        optionId: 'b',
        defaultSelected: true,
        maxQuantity: 2,
        priceAdjustment: '0.25',
        variantOverrides: [],
        effects: [],
      },
    ],
  };
  const product = {
    id: 'p',
    revision: 1,
    availability: 'available',
    basePrice: '99.00',
    variants: [
      {
        id: 'v',
        name: 'Variant',
        availability: 'available',
        stockQuantity: null,
        price: '10.00',
        attributeSelections: [],
      },
    ],
    modifierGroups: [group],
  };
  const pricing = new ProductPricingService({
    product: { findFirst: async () => product },
  } as never);
  const selections = [
    {
      groupId: 'assignment',
      optionIds: ['a', 'b'],
      optionQuantities: [
        { optionId: 'a', quantity: 3 },
        { optionId: 'b', quantity: 2 },
      ],
    },
  ];
  const quote = await pricing.quote('p', selections, 'v');
  assert.equal(quote.totalPrice, '19.95');
  assert.equal(quote.selections[0]?.options?.[0]?.quantity, 3);
  await assert.rejects(
    pricing.quote(
      'p',
      [{ ...selections[0]!, optionQuantities: [{ optionId: 'a', quantity: 4 }] }],
      'v',
    ),
    /cap/,
  );
  group.options[0]!.variantOverrides[0]!.available = false;
  group.minSelections = 1;
  const filteredDefault = await pricing.quote('p', [], 'v');
  assert.deepEqual(filteredDefault.selections[0]?.optionIds, ['b']);
  await assert.rejects(pricing.quote('p', selections, 'v'), /unavailable/);
  group.variantOverrides.push({ variantId: 'v', available: false });
  assert.deepEqual((await pricing.quote('p', [], 'v')).selections, []);
});

it('aggregates signed effects exactly before rejecting negatives and scales both quantities', () => {
  const base = [{ stockItemId: 'cheese', baseUnit: 'g' as const, baseQuantity: '10' }];
  const removal = {
    stockItemId: 'cheese',
    baseUnit: 'g' as const,
    baseQuantity: '1.25',
    direction: 'REMOVE' as const,
    optionQuantity: 3,
  };
  assert.deepEqual(calculateInventoryRequirements(base, 2, [removal]), [
    { stockItemId: 'cheese', baseUnit: 'g', quantity: '12.5' },
  ]);
  assert.throws(
    () => calculateInventoryRequirements(base, 1, [{ ...removal, baseQuantity: '4' }]),
    /negative/,
  );
  assert.deepEqual(
    calculateInventoryRequirements(base, 1, [
      { ...removal, baseQuantity: '10', optionQuantity: 1 },
    ]),
    [],
  );
  assert.deepEqual(
    calculateInventoryRequirements(base, 1, [
      { ...removal, baseQuantity: '11', optionQuantity: 1 },
      { ...removal, direction: 'ADD', baseQuantity: '2', optionQuantity: 1 },
    ]),
    [{ stockItemId: 'cheese', baseUnit: 'g', quantity: '1' }],
  );
});
