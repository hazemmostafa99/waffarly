import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  convertToBaseQuantity,
  normalizeStockQuantity,
} from '../../src/modules/inventory/stock-quantity.js';

describe('stock quantity arithmetic', () => {
  it('converts compatible standard units using up to six exact decimal places', () => {
    assert.equal(convertToBaseQuantity('1.5', 'kg', 'g', []), '1500');
    assert.equal(convertToBaseQuantity('1250', 'g', 'kg', []), '1.25');
    assert.equal(convertToBaseQuantity('0.000001', 'kg', 'g', []), '0.001');
    assert.equal(normalizeStockQuantity('12.500000'), '12.5');
  });

  it('converts item-specific packs and rejects incompatible or inexact conversions', () => {
    const packs = [{ code: 'case', name: 'Case', baseQuantity: '12' }];
    assert.equal(convertToBaseQuantity('1.5', 'case', 'piece', packs), '18');
    assert.equal(convertToBaseQuantity('0.5', 'kg', 'kg', []), '0.5');
    assert.throws(
      () =>
        convertToBaseQuantity('0.000001', 'case', 'piece', [
          { code: 'case', name: 'Case', baseQuantity: '0.000001' },
        ]),
      /rounding/i,
    );
    assert.throws(() => convertToBaseQuantity('1', 'l', 'piece', []), /incompatible/i);
    assert.throws(() => convertToBaseQuantity('1', 'crate', 'piece', packs), /does not belong/i);
  });

  it('rejects zero, signs, exponents, excess precision, and out-of-range values', () => {
    for (const value of ['0', '0.000000', '-1', '+1', '1e3', '1.0000001', '1000000000000']) {
      assert.throws(() => normalizeStockQuantity(value), /quantity/i, value);
    }
    assert.throws(() => convertToBaseQuantity('0.000001', 'g', 'kg', []), /rounding/i);
  });
});
