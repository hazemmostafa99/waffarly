export { PrismaClient } from '../generated/client/client.js';
export { PrismaPg } from '@prisma/adapter-pg';

import { PrismaPg } from '@prisma/adapter-pg';

export function createPostgresAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString });
}
