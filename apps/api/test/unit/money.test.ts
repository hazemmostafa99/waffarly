import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCents } from '../../src/common/money/money.js';

describe('money formatting', () => {
  it('formats negative cent movements as ordinary signed decimal amounts', () => {
    assert.equal(formatCents(-15n), '-0.15');
    assert.equal(formatCents(-1200n), '-12.00');
    assert.equal(formatCents(1200n), '12.00');
  });
});
