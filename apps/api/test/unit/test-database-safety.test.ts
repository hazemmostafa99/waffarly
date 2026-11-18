import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTestDatabaseUrl } from '../support/test-database-environment.js';
import { deleteTestMerchantSubscriptions } from '../support/merchant-fixtures.js';
import { selectDatabaseTestFiles } from '../support/database-test-suites.js';

const testUrl = 'postgresql://test_user:local@localhost:5434/waffarly_test?schema=public';

test('database tests require an explicit test URL and never fall back to the application URL', () => {
  assert.throws(() => resolveTestDatabaseUrl({ DATABASE_URL: testUrl }), /Set TEST_DATABASE_URL/);
  assert.equal(resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl }), testUrl);
  for (const value of [
    'invalid',
    'https://localhost/waffarly_test',
    'postgresql://localhost/waffarly',
  ]) {
    assert.throws(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: value }));
  }
});

test('database separation ignores credentials, schema and equivalent loopback spellings', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.throws(
      () =>
        resolveTestDatabaseUrl({
          TEST_DATABASE_URL: testUrl,
          DATABASE_URL: `postgres://other:secret@${host}:5434/waffarly_test?schema=other`,
        }),
      /different database/,
    );
  }
  assert.equal(
    resolveTestDatabaseUrl({
      TEST_DATABASE_URL: testUrl,
      DATABASE_URL: 'postgresql://localhost:5434/waffarly',
    }),
    testUrl,
  );
  assert.throws(
    () => resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DATABASE_URL: 'bad' }),
    /cannot confirm/,
  );
});

test('unsafe database configuration errors do not expose connection credentials', () => {
  assert.throws(
    () =>
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: 'https://user:private-password@localhost/test' }),
    (error: unknown) => error instanceof Error && !error.message.includes('private-password'),
  );
});

test('test database targets cannot be overridden through connection query parameters', () => {
  for (const key of ['host', 'hostaddr', 'port', 'database', 'dbname', 'service']) {
    assert.throws(
      () => resolveTestDatabaseUrl({ TEST_DATABASE_URL: `${testUrl}&${key}=other` }),
      /without query overrides/,
    );
  }
});

test('database suite selection is explicit and rejects unknown or missing tests', () => {
  const files = ['customers.database.test.ts', 'catalog.database.test.ts'];
  assert.deepEqual(selectDatabaseTestFiles('customers', files), [files[0]]);
  assert.deepEqual(selectDatabaseTestFiles('all', files), [...files].sort());
  assert.throws(() => selectDatabaseTestFiles('../other', files), /Unknown database suite/);
  assert.throws(() => selectDatabaseTestFiles('catalog', files), /missing/);
});

test('subscription cleanup is a no-op for no tenants and rejects unscoped input before any query', async () => {
  const client = {} as Parameters<typeof deleteTestMerchantSubscriptions>[0];
  await deleteTestMerchantSubscriptions(client, []);
  await assert.rejects(deleteTestMerchantSubscriptions(client, ['']), /explicit merchant UUIDs/);
});

test('subscription cleanup deletes children before their parent and only for the supplied tenants', async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const table = (name: string) => ({
    deleteMany: async (input: unknown) => {
      calls.push({ name, input });
    },
  });
  const client = {
    subscriptionEvent: table('events'),
    subscriptionPeriod: table('periods'),
    subscription: table('subscriptions'),
  } as unknown as Parameters<typeof deleteTestMerchantSubscriptions>[0];
  const id = '11111111-1111-4111-8111-111111111111';
  await deleteTestMerchantSubscriptions(client, [id, id]);
  assert.deepEqual(
    calls,
    ['events', 'periods', 'subscriptions'].map((name) => ({
      name,
      input: { where: { merchantId: { in: [id] } } },
    })),
  );
});
