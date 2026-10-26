import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, buildApiRequestOptions, parseApiResponse } from './api-client.js';
import {
  customerErrorsFromIssues,
  validateDeliveryDetails,
} from '../features/catalog/pos-customer-validation.js';

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

test('nullable API responses treat an empty successful response as null', async () => {
  const result = await parseApiResponse(new Response(null, { status: 200 }), true);

  assert.equal(result, null);
});

test('nullable API responses keep explicit JSON null as null', async () => {
  const result = await parseApiResponse(new Response('null', { status: 200 }), true);

  assert.equal(result, null);
});

test('non-nullable API responses still reject an empty successful response', async () => {
  await assert.rejects(() => parseApiResponse(new Response(null, { status: 200 })));
});

test('structured validation errors preserve field paths and never stringify objects', async () => {
  const issues = [
    { path: ['customerName'], message: 'Name is too short', code: 'too_small' },
    { path: ['customerPhone'], message: 'Phone is too short' },
    { path: ['customerPhone'], message: 'Invalid input' },
    { path: ['items', 0, 'quantity'], message: 'Quantity is too small' },
  ];
  await assert.rejects(
    () => parseApiResponse(new Response(JSON.stringify({ message: issues }), { status: 400 })),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      assert.deepEqual(error.issues, issues);
      assert.equal(error.message.includes('[object Object]'), false);
      const fields = customerErrorsFromIssues(error.issues);
      assert.deepEqual(Object.keys(fields), ['customerName', 'customerPhone']);
      assert.match(fields.customerPhone!, /7 digits/);
      return true;
    },
  );
});

test('API error parsing supports ordinary messages and malformed validation entries', async () => {
  for (const [message, expected] of [
    ['Forbidden', 'Forbidden'],
    [['First error', 'Second error'], 'First error, Second error'],
    [[null, { message: 'Invalid' }, 42], 'API request failed with status 400.'],
  ] as const) {
    await assert.rejects(
      () => parseApiResponse(new Response(JSON.stringify({ message }), { status: 400 })),
      (error: unknown) => error instanceof ApiError && error.message === expected,
    );
  }
});

test('delivery validation catches the reported payload and accepts trimmed formatted details', () => {
  assert.deepEqual(
    Object.keys(
      validateDeliveryDetails({
        customerName: 'k',
        customerPhone: '01552',
        deliveryAddress: 'cairo',
      }),
    ),
    ['customerName', 'customerPhone', 'deliveryAddress'],
  );
  assert.deepEqual(
    validateDeliveryDetails({
      customerName: '  Karim  ',
      customerPhone: '+20 (155) 123-4567',
      deliveryAddress: '  12 Cairo Street  ',
    }),
    {},
  );
  assert.equal(Object.keys(validateDeliveryDetails({})).length, 3);
  assert.ok(validateDeliveryDetails({ customerPhone: '-------' }).customerPhone);
  assert.ok(validateDeliveryDetails({ customerPhone: '123456a' }).customerPhone);
  assert.ok(
    validateDeliveryDetails({
      customerName: 'a'.repeat(121),
      deliveryAddress: 'a'.repeat(1001),
      customerPhone: '1'.repeat(33),
    }).customerPhone,
  );
});
