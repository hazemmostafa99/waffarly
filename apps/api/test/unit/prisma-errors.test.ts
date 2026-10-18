import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../src/infrastructure/database/prisma-errors.js';

describe('Prisma transaction error classification', () => {
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
