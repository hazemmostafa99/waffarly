import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDiscountSchema,
  updateDiscountSchema,
} from '../../src/modules/discounts/discount.schemas.js';

const discount = {
  name: 'Welcome',
  description: '',
  code: 'WELCOME20',
  type: 'percentage',
  value: '20',
  minimum: '0',
  maximum: '',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  usageLimit: '',
  branches: [],
  terms: '',
  state: 'published',
};

describe('discount request schemas', () => {
  it('accepts an optional percentage cap and fixed discounts without a cap', () => {
    assert.equal(
      updateDiscountSchema.safeParse({ ...discount, maximum: '25.00', revision: 1 }).success,
      true,
    );
    assert.equal(
      updateDiscountSchema.safeParse({ ...discount, type: 'fixed', maximum: '', revision: 1 })
        .success,
      true,
    );
  });

  it('rejects invalid caps and a cap on a fixed discount', () => {
    for (const maximum of ['0', '-1', 'invalid', '1.234']) {
      assert.equal(
        updateDiscountSchema.safeParse({ ...discount, maximum, revision: 1 }).success,
        false,
      );
    }
    assert.equal(
      updateDiscountSchema.safeParse({ ...discount, type: 'fixed', maximum: '10', revision: 1 })
        .success,
      false,
    );
  });
  it('accepts a create request id with the discount fields', () => {
    assert.equal(
      createDiscountSchema.safeParse({
        ...discount,
        requestId: '44be187b-df73-45f2-8894-749f5146bfe1',
      }).success,
      true,
    );
  });

  it('accepts a revision with discount fields and still rejects unknown keys', () => {
    assert.equal(updateDiscountSchema.safeParse({ ...discount, revision: 1 }).success, true);
    assert.equal(
      updateDiscountSchema.safeParse({ ...discount, revision: 1, unexpected: true }).success,
      false,
    );
  });
});
