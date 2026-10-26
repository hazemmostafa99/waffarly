import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCents, requireEgpCurrency } from '../../src/common/money/money.js';

describe('money formatting', () => {
  it('accepts only EGP before mapping or recording money', () => {
    assert.equal(requireEgpCurrency('EGP'), 'EGP');
    for (const currency of ['USD', 'EUR', 'egp', '', 'XYZ']) {
      assert.throws(() => requireEgpCurrency(currency), /Currency must be EGP/);
    }
  });

  it('formats negative cent movements as ordinary signed decimal amounts', () => {
    assert.equal(formatCents(-15n), '-0.15');
    assert.equal(formatCents(-1200n), '-12.00');
    assert.equal(formatCents(1200n), '12.00');
  });
});
