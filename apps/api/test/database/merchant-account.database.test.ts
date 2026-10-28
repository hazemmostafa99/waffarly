import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient, type Prisma } from '@waffarly/database';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MerchantAccountService } from '../../src/modules/merchants/merchant-account.service.js';
import { SubscriptionService } from '../../src/modules/subscriptions/subscription.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import type { Request } from 'express';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
function scoped(tx: Prisma.TransactionClient): PrismaService {
  return new Proxy(tx, {
    get(target, key) {
      if (key === '$transaction')
        return (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx);
      return Reflect.get(target, key, target);
    },
  }) as unknown as PrismaService;
}

it(
  'persists scoped profile changes and projects exact owner billing facts without internal notes',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback merchant account fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const client = scoped(tx);
            const subscriptions = new SubscriptionService(client);
            const account = new MerchantAccountService(client, subscriptions);
            const merchantData = () => ({
              name: 'Account test',
              storefrontSlug: `account-${randomUUID()}`,
              contactPhone: '01000000000',
              ownerName: 'Owner',
              ownerMobile: '01100000000',
              activity: 'restaurant',
            });
            const merchant = await tx.merchant.create({
              data: {
                ...merchantData(),
                owner: {
                  create: {
                    username: `account-${randomUUID()}`,
                    passwordHash: 'private-secret-hash',
                  },
                },
              },
            });
            const other = await tx.merchant.create({ data: merchantData() });
            const initial = await account.get(merchant.id);
            assert.equal(initial.subscription.status, 'pending');
            assert.equal(initial.profile.storefrontSlug, merchant.storefrontSlug);
            assert.equal(initial.profile.revision, 1);
            assert.ok(!JSON.stringify(initial).includes('private-secret-hash'));

            const draft = {
              merchantName: ' Updated business ',
              ownerName: ' Updated owner ',
              contactPhone: ' 01234567890 ',
              ownerMobile: ' 01123456789 ',
              revision: 1,
            };
            const saved = await account.update(merchant.id, initial.profile.username, draft);
            assert.equal(saved.merchantName, 'Updated business');
            assert.equal(saved.ownerName, 'Updated owner');
            assert.equal(saved.revision, 2);
            assert.equal(saved.storefrontSlug, merchant.storefrontSlug);
            assert.ok(saved.updatedAt);
            const stored = await tx.merchant.findUniqueOrThrow({ where: { id: merchant.id } });
            assert.equal(stored.profileUpdatedBy, initial.profile.username);
            assert.equal(stored.contactPhone, '01234567890');
            await assert.rejects(
              account.update(merchant.id, initial.profile.username, draft),
              /Account details have changed/,
            );
            assert.equal((await account.get(other.id)).profile.revision, 1);
            assert.equal((await account.get(other.id)).profile.ownerName, 'Owner');

            const plan = await tx.monthlyPlan.create({
              data: {
                creationRequest: randomUUID(),
                name: 'Edited current catalog name',
                description: '',
                monthlyPrice: '999.00',
                createdBy: 'test-admin',
                updatedBy: 'test-admin',
              },
            });
            const now = Date.now();
            const start = new Date(now - 86400000);
            const end = new Date(now + 7 * 86400000);
            await tx.subscription.update({
              where: { merchantId: merchant.id },
              data: { status: 'active', assignedPlanId: plan.id, assignedMonths: 3 },
            });
            const current = await tx.subscriptionPeriod.create({
              data: {
                merchantId: merchant.id,
                planId: plan.id,
                planName: 'Purchased plan name',
                months: 3,
                price: '600.00',
                collected: '580.00',
                credit: '20.00',
                startsAt: start,
                endsAt: end,
                coverageEndsAt: end,
              },
            });
            const next = await tx.subscriptionPeriod.create({
              data: {
                merchantId: merchant.id,
                planId: plan.id,
                planName: 'Prepaid next plan',
                months: 1,
                price: '250.00',
                collected: '250.00',
                credit: '0.00',
                startsAt: end,
                endsAt: new Date(now + 37 * 86400000),
                coverageEndsAt: new Date(now + 37 * 86400000),
              },
            });
            await tx.subscriptionEvent.create({
              data: {
                merchantId: merchant.id,
                requestId: randomUUID(),
                fingerprint: 'private-fingerprint',
                administrator: 'private-admin',
                action: 'activate',
                reason: 'private-internal-note',
                result: {},
              },
            });
            const active = await account.get(merchant.id);
            assert.equal(active.subscription.status, 'active');
            assert.equal(active.subscription.currentPeriod?.planName, 'Purchased plan name');
            assert.equal(active.subscription.currentPeriod?.price, '600.00');
            assert.equal(active.subscription.currentPeriod?.collected, '580.00');
            assert.equal(active.subscription.currentPeriod?.credit, '20.00');
            assert.equal(active.subscription.nextPeriod?.id, next.id);
            assert.equal(active.subscription.coverageEndsAt, next.coverageEndsAt.toISOString());
            assert.ok(!JSON.stringify(active).includes('private-internal-note'));
            assert.ok(!JSON.stringify(active).includes('private-admin'));
            assert.equal((await account.get(other.id)).subscription.currentPeriod, null);
            await assert.rejects(account.history(other.id, current.id), /Invalid history cursor/);
            const history = await account.history(merchant.id);
            assert.equal(history.items.length, 2);
            assert.equal(history.items[0]?.id, next.id);
            assert.equal(history.nextCursor, null);

            await tx.subscription.update({
              where: { merchantId: merchant.id },
              data: { status: 'suspended', cancelAtEnd: true },
            });
            const suspended = (await account.get(merchant.id)).subscription;
            assert.equal(suspended.status, 'suspended');
            assert.equal(suspended.cancelAtEnd, true);
            assert.equal(suspended.currentPeriod?.id, current.id);
            await tx.subscriptionPeriod.updateMany({
              where: { merchantId: merchant.id },
              data: {
                startsAt: new Date(now - 10 * 86400000),
                coverageEndsAt: new Date(now - 86400000),
              },
            });
            await tx.subscription.update({
              where: { merchantId: merchant.id },
              data: { status: 'active' },
            });
            const expired = (await account.get(merchant.id)).subscription;
            assert.equal(expired.status, 'expired');
            assert.equal(expired.currentPeriod, null);
            assert.equal(expired.nextPeriod, null);
            assert.ok(expired.latestPeriod);
            const owner = await tx.ownerAccount.findUniqueOrThrow({
              where: { merchantId: merchant.id },
            });
            const token = randomUUID();
            await tx.authSession.create({
              data: {
                subjectKind: 'OWNER',
                subjectId: owner.id,
                tokenHash: createHash('sha256').update(token).digest('hex'),
                expiresAt: new Date(Date.now() + 60000),
              },
            });
            const auth = new AuthService(client, {} as never, subscriptions);
            const request = (method: string, path: string) =>
              ({ method, path, headers: { cookie: `waffarly_owner_session=${token}` } }) as Request;
            assert.equal(
              (await auth.requireOwner(request('GET', '/owner/account'))).subscriptionStatus,
              'expired',
            );
            assert.equal(
              (await auth.requireOwner(request('GET', '/owner/account/subscription/periods')))
                .merchantId,
              merchant.id,
            );
            await assert.rejects(
              auth.requireOwner(request('PATCH', '/owner/account')),
              /not active/,
            );

            await tx.subscriptionPeriod.createMany({
              data: Array.from({ length: 51 }, (_, index) => ({
                merchantId: merchant.id,
                planId: plan.id,
                planName: 'Older paid period',
                months: 1,
                price: '250.00',
                collected: '250.00',
                credit: '0.00',
                startsAt: new Date(now - (index + 40) * 86400000),
                endsAt: new Date(now - (index + 39) * 86400000),
                coverageEndsAt: new Date(now - (index + 39) * 86400000),
              })),
            });
            const firstPage = await account.history(merchant.id);
            assert.equal(firstPage.items.length, 50);
            assert.ok(firstPage.nextCursor);
            const secondPage = await account.history(merchant.id, firstPage.nextCursor);
            assert.equal(secondPage.items.length, 3);
            assert.equal(secondPage.nextCursor, null);
            assert.equal(
              new Set([...firstPage.items, ...secondPage.items].map((p) => p.id)).size,
              53,
            );
            await tx.subscription.update({
              where: { merchantId: merchant.id },
              data: { status: 'legacy' },
            });
            assert.equal((await account.get(merchant.id)).subscription.status, 'legacy');
            throw rollback;
          },
          { timeout: 20_000 },
        ),
        rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
