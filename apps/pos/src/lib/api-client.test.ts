import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiRequestOptions } from './api-client.js';

test('bodyless API requests do not add a JSON content type or use the browser HTTP cache', () => {
  const options = buildApiRequestOptions({ method: 'GET' });
  const headers = new Headers(options.headers);

  assert.equal(headers.has('content-type'), false);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.credentials, 'include');
});

test('JSON API requests keep their content type and preserve caller headers', () => {
  const options = buildApiRequestOptions({
    method: 'POST',
    body: JSON.stringify({ ok: true }),
    headers: { 'X-Request-Id': 'request-1' },
  });
  const headers = new Headers(options.headers);

  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(headers.get('x-request-id'), 'request-1');
  assert.equal(options.cache, 'no-store');
});

test('an explicit content type is preserved', () => {
  const options = buildApiRequestOptions({
    method: 'POST',
    body: 'plain text',
    headers: { 'Content-Type': 'text/plain' },
  });

  assert.equal(new Headers(options.headers).get('content-type'), 'text/plain');
});
