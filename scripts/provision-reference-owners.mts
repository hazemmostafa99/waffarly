import { config } from '../apps/api/node_modules/dotenv/lib/main.js';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PrismaClient, createPostgresAdapter } from '../packages/database/src/index.js';
import { hashPassword } from '../apps/api/src/modules/auth/password.js';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
if (process.env.NODE_ENV === 'production')
  throw new Error('Reference accounts are local/demo only.');
const password = process.env.REFERENCE_OWNER_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set REFERENCE_OWNER_PASSWORD (at least 12 characters).');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const id = (key: string) => {
  const h = createHash('sha256')
    .update('reference-owner-v1:' + key)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const db = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
const planId = id('plan');
const now = new Date();
const endsAt = new Date(now);
endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
try {
  const accounts = await db.$transaction(
    async (tx) => {
      await tx.monthlyPlan.upsert({
        where: { id: planId },
        create: {
          id: planId,
          creationRequest: id('plan-command'),
          name: 'Reference demo access',
          description: 'Local reference owner access. No payment collected.',
          monthlyPrice: '0.00',
          available: false,
          createdBy: 'reference-owner-provision',
          updatedBy: 'reference-owner-provision',
        },
        update: {},
      });
      const result: { username: string; restaurant: string }[] = [];
      for (let index = 1; index <= 12; index++) {
        const merchant = await tx.merchant.findUnique({
          where: { storefrontSlug: `reference-restaurant-${index}` },
          include: { restaurantProfile: true, owner: true },
        });
        const metadata = merchant?.restaurantProfile?.referenceData;
        if (
          !merchant ||
          !metadata ||
          typeof metadata !== 'object' ||
          Array.isArray(metadata) ||
          metadata.origin !== 'local-mock'
        )
          throw new Error('Missing or non-reference merchant; transaction cancelled.');
        const username = `merchant${index}`,
          ownerId = id(`owner:${index}`);
        const collision = await tx.ownerAccount.findUnique({ where: { username } });
        if (collision && collision.merchantId !== merchant.id)
          throw new Error(`Username already belongs to another merchant: ${username}`);
        if (merchant.owner && merchant.owner.id !== ownerId)
          throw new Error('Existing owner is not provisioned by this command.');
        const passwordHash = await hashPassword(password);
        await tx.ownerAccount.upsert({
          where: { merchantId: merchant.id },
          create: { id: ownerId, merchantId: merchant.id, username, passwordHash },
          update: { username, passwordHash },
        });
        await tx.authSession.deleteMany({ where: { subjectKind: 'OWNER', subjectId: ownerId } });
        const subscription = await tx.subscription.findUnique({
          where: { merchantId: merchant.id },
        });
        if (subscription?.assignedPlanId && subscription.assignedPlanId !== planId)
          throw new Error('Existing non-demo subscription will not be replaced.');
        await tx.subscription.upsert({
          where: { merchantId: merchant.id },
          create: {
            merchantId: merchant.id,
            status: 'active',
            assignedPlanId: planId,
            assignedMonths: 1,
          },
          update: {
            status: 'active',
            assignedPlanId: planId,
            assignedMonths: 1,
            revision: { increment: 1 },
          },
        });
        const periodId = id(`period:${index}`);
        await tx.subscriptionPeriod.upsert({
          where: { id: periodId },
          create: {
            id: periodId,
            merchantId: merchant.id,
            planId,
            planName: 'Reference demo access',
            months: 1,
            price: '0.00',
            collected: '0.00',
            credit: '0.00',
            startsAt: now,
            endsAt,
            coverageEndsAt: endsAt,
          },
          update: { startsAt: now, endsAt, coverageEndsAt: endsAt },
        });
        await tx.subscriptionEvent.create({
          data: {
            merchantId: merchant.id,
            requestId: crypto.randomUUID(),
            fingerprint: createHash('sha256')
              .update(ownerId + now.toISOString())
              .digest('hex'),
            action: 'activate',
            administrator: 'reference-owner-provision',
            reason: 'User-authorized local demo access; zero charge.',
            result: { demo: true, endsAt: endsAt.toISOString() },
          },
        });
        result.push({ username, restaurant: merchant.name });
      }
      return result;
    },
    { timeout: 120000 },
  );
  console.log(JSON.stringify({ accounts, accessUntil: endsAt.toISOString() }, null, 2));
} finally {
  await db.$disconnect();
}
