/** Opens a guarded test connection and closes it even when fixture cleanup fails. */
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { TestContext } from 'node:test';
import { getTestDatabaseUrl } from './test-database-environment.js';

export function createTestDatabaseClient(context: TestContext): PrismaClient {
  const client = new PrismaClient({ adapter: createPostgresAdapter(getTestDatabaseUrl()) });
  context.after(async () => client.$disconnect());
  return client;
}
