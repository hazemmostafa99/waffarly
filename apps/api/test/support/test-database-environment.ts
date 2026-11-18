/** Selects an explicitly designated test database before any test can connect. */
import { config } from 'dotenv';

type DatabaseEnvironment = {
  DATABASE_URL?: string | undefined;
  TEST_DATABASE_URL?: string | undefined;
};

function databaseTarget(url: URL): string {
  const host = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ? 'loopback'
    : url.hostname;
  return `${host}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function resolveTestDatabaseUrl(environment: DatabaseEnvironment): string {
  const value = environment.TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      'Set TEST_DATABASE_URL in the root .env.test or environment before running database tests.',
    );
  }
  let testUrl: URL;
  try {
    testUrl = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(testUrl.protocol)) throw new Error();
    if (!testUrl.hostname || !testUrl.pathname.slice(1)) throw new Error();
    decodeURIComponent(testUrl.pathname);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  const name = decodeURIComponent(testUrl.pathname.slice(1));
  if (
    ['host', 'hostaddr', 'port', 'database', 'dbname', 'service'].some((key) =>
      testUrl.searchParams.has(key),
    )
  ) {
    throw new Error(
      'TEST_DATABASE_URL must specify its database target in the URL, without query overrides.',
    );
  }
  if (!/(?:^|_)(?:test|tests|ci|e2e)(?:_|$)/i.test(name)) {
    throw new Error('The test database name must contain a test, tests, ci or e2e segment.');
  }
  if (environment.DATABASE_URL) {
    let applicationUrl: URL;
    try {
      applicationUrl = new URL(environment.DATABASE_URL);
      databaseTarget(applicationUrl);
    } catch {
      throw new Error('DATABASE_URL is invalid; cannot confirm test database separation.');
    }
    if (databaseTarget(testUrl) === databaseTarget(applicationUrl)) {
      throw new Error(
        'TEST_DATABASE_URL must point to a different database from DATABASE_URL, even when users or schemas differ.',
      );
    }
  }
  return value;
}

export function getTestDatabaseUrl(): string {
  // Environment/CI values win. Loading these files never prints their values.
  config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
  config({ path: new URL('../../../../.env.test', import.meta.url), quiet: true });
  return resolveTestDatabaseUrl({
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });
}
