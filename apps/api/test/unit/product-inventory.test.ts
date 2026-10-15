import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateInventoryRequirements } from '../../src/modules/catalog/products/product-inventory.calculator.js';
import {
  assertInventoryConfigurationShape,
  defaultInventoryModeForActivity,
} from '../../src/modules/catalog/products/product-inventory.rules.js';

describe('product inventory rules', () => {
  it('defaults restaurant products to recipes and other activities to direct items', () => {
    assert.equal(defaultInventoryModeForActivity('restaurant'), 'RECIPE');
    assert.equal(defaultInventoryModeForActivity('clothing'), 'DIRECT');
    assert.equal(defaultInventoryModeForActivity('other'), 'DIRECT');
  });

  it('validates direct and recipe targets while permitting repeated ingredients', () => {
    assert.doesNotThrow(() =>
      assertInventoryConfigurationShape({
        mode: 'DIRECT',
        targets: [
          {
            variantId: null,
            components: [{ stockItemId: 'item-a', unitCode: 'piece', quantity: '1' }],
          },
        ],
      }),
    );
    assert.throws(
      () =>
        assertInventoryConfigurationShape({
          mode: 'DIRECT',
          targets: [
            {
              variantId: null,
              components: [
                { stockItemId: 'item-a', unitCode: 'piece', quantity: '1' },
                { stockItemId: 'item-b', unitCode: 'piece', quantity: '1' },
              ],
            },
          ],
        }),
      /exactly one stock item/i,
    );
    assert.doesNotThrow(() =>
      assertInventoryConfigurationShape({
        mode: 'RECIPE',
        targets: [
          {
            variantId: 'variant-a',
            components: [
              { stockItemId: 'item-a', unitCode: 'g', quantity: '0.125' },
              { stockItemId: 'item-a', unitCode: 'g', quantity: '0.375' },
            ],
          },
        ],
      }),
    );
  });

  it('scales exact base quantities and aggregates shared Stock Items', () => {
    assert.deepEqual(
      calculateInventoryRequirements(
        [
          { stockItemId: 'flour', baseUnit: 'g', baseQuantity: '125.25' },
          { stockItemId: 'flour', baseUnit: 'g', baseQuantity: '74.75' },
          { stockItemId: 'oil', baseUnit: 'ml', baseQuantity: '10.5' },
        ],
        3,
      ),
      [
        { stockItemId: 'flour', baseUnit: 'g', quantity: '600' },
        { stockItemId: 'oil', baseUnit: 'ml', quantity: '31.5' },
      ],
    );
  });

  it('multiplies an item pack by sold quantity without changing product pricing', () => {
    assert.deepEqual(
      calculateInventoryRequirements(
        [{ stockItemId: 'bottle', baseUnit: 'piece', baseQuantity: '6' }],
        3,
      ),
      [{ stockItemId: 'bottle', baseUnit: 'piece', quantity: '18' }],
    );
  });

  it('rejects invalid multipliers, inconsistent item units, and overflow', () => {
    assert.throws(() => calculateInventoryRequirements([], 0), /positive whole number/i);
    assert.throws(
      () =>
        calculateInventoryRequirements(
          [
            { stockItemId: 'water', baseUnit: 'ml', baseQuantity: '1' },
            { stockItemId: 'water', baseUnit: 'l', baseQuantity: '1' },
          ],
          1,
        ),
      /multiple base units/i,
    );
    assert.throws(
      () =>
        calculateInventoryRequirements(
          [{ stockItemId: 'flour', baseUnit: 'g', baseQuantity: '999999999999' }],
          2,
        ),
      /supported range/i,
    );
  });
});
