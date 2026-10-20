import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ownerPosItemReturnReportsSchema,
  parseRecordPosItemReturnRequest,
  withoutPosItemReturnApproval,
} from '../../src/modules/orders/pos-returns.schemas.js';

describe('POS item returns', () => {
  const valid = {
    requestId: '11111111-1111-4111-8111-111111111111',
    branchId: '22222222-2222-4222-8222-222222222222',
    reason: 'Customer reported a damaged item',
    lines: [{ orderLineId: '33333333-3333-4333-8333-333333333333', quantity: 1 }],
  };

  it('requires a bounded reason, positive whole quantity, and unique original sale lines', () => {
    assert.deepEqual(parseRecordPosItemReturnRequest(valid), valid);
    assert.throws(
      () => parseRecordPosItemReturnRequest({ ...valid, reason: '  ' }),
      BadRequestException,
    );
    assert.throws(
      () =>
        parseRecordPosItemReturnRequest({ ...valid, lines: [{ ...valid.lines[0], quantity: 0 }] }),
      BadRequestException,
    );
    assert.throws(
      () => parseRecordPosItemReturnRequest({ ...valid, lines: [valid.lines[0], valid.lines[0]] }),
      BadRequestException,
    );
    assert.throws(
      () => parseRecordPosItemReturnRequest({ ...valid, unknown: 'not accepted' }),
      BadRequestException,
    );
  });

  it('accepts immediate supervisor approval but strips credentials from the saved command', () => {
    const request = parseRecordPosItemReturnRequest({
      ...valid,
      approval: { username: 'supervisor', password: 'never-persist-this' },
    });
    assert.deepEqual(withoutPosItemReturnApproval(request), valid);
    assert.equal(
      JSON.stringify(withoutPosItemReturnApproval(request)).includes('never-persist-this'),
      false,
    );
  });

  it('validates owner return report date ranges, branch scope, cursor and bounded page size', () => {
    const query = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-20T00:00:00.000Z',
      branchId: valid.branchId,
      limit: '50',
    };
    assert.deepEqual(ownerPosItemReturnReportsSchema.parse(query), { ...query, limit: 50 });
    assert.equal(
      ownerPosItemReturnReportsSchema.safeParse({
        ...query,
        to: '2026-10-01T00:00:00.000Z',
      }).success,
      false,
    );
    assert.equal(
      ownerPosItemReturnReportsSchema.safeParse({
        ...query,
        from: '2026-01-01T00:00:00.000Z',
      }).success,
      false,
    );
    assert.equal(
      ownerPosItemReturnReportsSchema.safeParse({ ...query, limit: '101' }).success,
      false,
    );
    assert.equal(
      ownerPosItemReturnReportsSchema.safeParse({ ...query, merchantId: 'injected' }).success,
      false,
    );
  });
});
