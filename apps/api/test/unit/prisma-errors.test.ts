import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isDatabaseUnavailable,
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../src/infrastructure/database/prisma-errors.js';

describe('Prisma transaction error classification', () => {
  it('recognizes connectivity failures without treating business errors as outages', () => {
    for (const code of ['P1001', 'P1002', 'P1017', 'P2024']) {
      assert.equal(isDatabaseUnavailable({ code }), true);
    }
    for (const kind of ['DatabaseNotReachable', 'ConnectionClosed', 'SocketTimeout']) {
      assert.equal(
        isDatabaseUnavailable({
          code: 'P2010',
          meta: {
            driverAdapterError: { cause: { kind } },
          },
        }),
        true,
      );
      assert.equal(isDatabaseUnavailable({ name: 'DriverAdapterError', cause: { kind } }), true);
    }
    for (const error of [
      null,
      new Error('connection refused'),
      { code: 'ECONNRESET' },
      { code: 'P2002' },
      { code: 'P2021' },
      { code: 'P2034' },
      { code: 'P2010', meta: { code: '23505' } },
    ]) {
      assert.equal(isDatabaseUnavailable(error), false);
    }
  });
  it('recognizes Prisma serialization failures', () => {
    assert.equal(isSerializationConflict({ code: 'P2034' }), true);
  });

  it('recognizes PostgreSQL serialization failures wrapped as raw-query errors', () => {
    assert.equal(isSerializationConflict({ code: 'P2010', meta: { code: '40001' } }), true);
    assert.equal(
      isSerializationConflict({
        code: 'P2010',
        meta: { driverAdapterError: { cause: { kind: 'TransactionWriteConflict' } } },
      }),
      true,
    );
  });

  it('does not misclassify unrelated raw-query or unique errors', () => {
    assert.equal(isSerializationConflict({ code: 'P2010', meta: { code: '23505' } }), false);
    assert.equal(isSerializationConflict({ code: 'P2002' }), false);
    assert.equal(isUniqueConstraintError({ code: 'P2002' }), true);
  });
});
