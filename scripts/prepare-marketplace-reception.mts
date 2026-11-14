import '../apps/api/node_modules/reflect-metadata/Reflect.js';
import { config } from '../apps/api/node_modules/dotenv/lib/main.js';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PrismaClient, createPostgresAdapter } from '../packages/database/src/index.js';
import { InventoryLocationsService } from '../apps/api/src/modules/inventory/inventory-locations.service.js';
import type { PrismaService } from '../apps/api/src/infrastructure/database/prisma.service.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const host = new URL(process.env.DATABASE_URL).hostname;
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(host))
  throw new Error('This preparation command is restricted to the local database.');
const apply = process.argv.includes('--apply');
const client = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
const actor = 'marketplace-reception-20261113';
function referenceId(index: number) {
  const h = createHash('sha256')
    .update('waffarly-reference-v1:merchant:' + index)
    .digest('hex');
  return (
    h.slice(0, 8) +
    '-' +
    h.slice(8, 12) +
    '-4' +
    h.slice(13, 16) +
    '-a' +
    h.slice(17, 20) +
    '-' +
    h.slice(20, 32)
  );
}
try {
  const locations = new InventoryLocationsService(client as unknown as PrismaService);
  const merchants = await client.merchant.findMany({
    where: {
      storefrontSlug: {
        in: Array.from({ length: 12 }, (_, i) => 'reference-restaurant-' + (i + 1)),
      },
    },
    select: {
      id: true,
      storefrontSlug: true,
      branches: { select: { id: true, archivedAt: true } },
      posEmployees: {
        where: { active: true },
        select: { id: true, branches: { select: { branchId: true } } },
      },
    },
  });
  if (merchants.length !== 12)
    throw new Error('Expected all twelve persisted restaurants; no preparation performed.');
  for (const merchant of merchants) {
    const index = Number(merchant.storefrontSlug.replace('reference-restaurant-', '')) - 1;
    if (merchant.id !== referenceId(index)) throw new Error('Reference tenant identity mismatch.');
    if (merchant.branches.length > 0 && !merchant.branches.some((branch) => !branch.archivedAt))
      throw new Error('A restaurant has archived branches; owner review is required.');
  }
  for (const merchant of merchants) {
    let branches = merchant.branches.filter((branch) => !branch.archivedAt);
    if (!branches.length && apply) {
      const branch = await locations.createBranch(merchant.id, actor, {
        name: 'الفرع الرئيسي',
        defaultWarehouseName: 'المخزن الرئيسي',
      });
      branches = [{ id: branch.id, archivedAt: null }];
    }
    const assigned = merchant.posEmployees.filter((employee) =>
      employee.branches.some((link) => branches.some((branch) => branch.id === link.branchId)),
    ).length;
    console.log(
      JSON.stringify({
        slug: merchant.storefrontSlug,
        mode: apply ? 'applied' : 'read-only',
        activeBranches: branches.length,
        activeEmployees: merchant.posEmployees.length,
        assignedEmployees: assigned,
        routingReady: branches.length === 1,
        posLoginSetupNeeded: assigned === 0,
      }),
    );
  }
} catch (error) {
  // Do not print connection errors, database URLs or credentials.
  console.error(
    'Reception preparation did not complete. Existing successful branch creations are safe to reuse on retry.',
  );
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}
