export { PrismaClient } from '../generated/client/client.js';
export { Prisma } from '../generated/client/client.js';
export { PrismaPg } from '@prisma/adapter-pg';

import { PrismaPg } from '@prisma/adapter-pg';

export interface PostgresPoolOptions {
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  onPoolError?: (error: Error) => void;
}

export function createPostgresAdapter(
  connectionString: string,
  options: PostgresPoolOptions = {},
): PrismaPg {
  const { onPoolError, ...poolOptions } = options;
  return new PrismaPg(
    {
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 30_000,
      ...poolOptions,
    },
    onPoolError ? { onPoolError } : undefined,
  );
}
