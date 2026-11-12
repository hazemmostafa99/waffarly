import type { ArgumentsHost } from '@nestjs/common';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import type { StructuredLogger } from '../../src/common/logging/structured-logger.js';

it('returns a safe 503 for database outages and preserves unrelated 500 errors', () => {
  const filter = new HttpExceptionFilter({ error: () => {} } as unknown as StructuredLogger);
  for (const [error, expectedStatus, expectedCode] of [
    [{ code: 'P1001', message: 'private connection details' }, 503, 'DATABASE_UNAVAILABLE'],
    [new Error('Connection terminated due to connection timeout'), 503, 'DATABASE_UNAVAILABLE'],
    [{ code: 'P2021' }, 500, undefined],
    [new Error('unrelated failure'), 500, undefined],
  ] as const) {
    let status: number | undefined;
    let body: Record<string, unknown> = {};
    const response = {
      status(value: number) {
        status = value;
        return response;
      },
      json(value: Record<string, unknown>) {
        body = value;
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', url: '/orders' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    filter.catch(error, host);
    assert.equal(status, expectedStatus);
    assert.equal(body.errorCode, expectedCode);
    assert.equal(
      body.message,
      expectedStatus === 503 ? 'Database is unavailable.' : 'Internal server error',
    );
    assert.ok(!JSON.stringify(body).includes('private'));
  }
});
