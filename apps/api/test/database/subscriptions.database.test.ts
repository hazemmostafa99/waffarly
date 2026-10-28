import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient, type Prisma } from '@waffarly/database';
import type { Request } from 'express';
import type { SubscriptionCommand } from '@waffarly/contracts';
import { SubscriptionService } from '../../src/modules/subscriptions/subscription.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PlanService } from '../../src/modules/plans/plan.service.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';

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
const merchantData = () => ({
  name: 'Subscription test',
  storefrontSlug: `subscription-test-${randomUUID()}`,
  contactPhone: '01000000000',
  ownerName: 'Subscription owner',
  ownerMobile: '01100000000',
});

it(
  'persists duration pricing, paid coverage, revisions, retries, cancellation, expiry and tenant-scoped access',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback subscription test fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const client = scoped(tx);
            const service = new SubscriptionService(client);
            const plans = new PlanService(client);
            const plan = await plans.create(
              {
                requestId: randomUUID(),
                name: 'Independent duration prices',
                description: '',
                monthlyPrice: '250.00',
                currency: 'EGP',
                billingInterval: 'monthly',
                terms: [
                  { months: 3, price: '600.00' },
                  { months: 6, price: '1000.00' },
                  { months: 12, price: '2000.00' },
                  { months: 24, price: '3500.00' },
                ],
              },
              'subscription-test',
            );
            assert.deepEqual(
              plan.terms?.map((term) => term.price),
              ['600.00', '1000.00', '2000.00', '3500.00'],
            );
            const merchant = await tx.merchant.create({ data: merchantData() });
            const other = await tx.merchant.create({ data: merchantData() });
            assert.equal((await service.detail(merchant.id)).status, 'pending');
            await assert.rejects(service.requireActive(merchant.id, tx), /not active/);
            let state = await service.detail(merchant.id);
            const act = async (
              input: Omit<SubscriptionCommand, 'requestId' | 'revision' | 'reason'>,
            ) => {
              state = await service.command(
                merchant.id,
                {
                  ...input,
                  requestId: randomUUID(),
                  revision: state.revision,
                  reason: 'Database verification',
                },
                'subscription-test',
              );
              return state;
            };
            await act({ action: 'assign', planId: plan.id, months: 6 });
            assert.equal(state.assignedMonths, 6);
            assert.ok(
              (await service.list({ planId: plan.id, status: 'pending' })).items.some(
                (s) => s.merchantId === merchant.id,
              ),
            );
            assert.equal(
              (await service.list({ planId: plan.id, status: 'suspended', expiring: true })).items
                .length,
              0,
            );
            assert.equal((await service.access(merchant.id)).allowed, false);
            const quote = await service.quote(merchant.id, {
              action: 'activate',
              planId: plan.id,
              months: 6,
            });
            assert.equal(quote.due, '1000.00');
            const activation: SubscriptionCommand = {
              action: 'activate',
              requestId: randomUUID(),
              revision: state.revision,
              reason: 'Receipt external-001',
              planId: plan.id,
              months: 6,
              planRevision: plan.revision,
              expectedDue: quote.due,
              externalCollectionConfirmed: true,
            };
            state = await service.command(merchant.id, activation, 'subscription-test');
            const activated = state;
            assert.equal(state.status, 'active');
            assert.equal(state.currentPeriod?.price, '1000.00');
            await service.requireActive(merchant.id, tx);
            assert.equal((await service.detail(other.id)).status, 'pending');
            await assert.rejects(
              service.history(other.id, 'periods', state.currentPeriod!.id),
              /Invalid history cursor/,
            );
            await assert.rejects(
              service.command(
                merchant.id,
                { ...activation, requestId: randomUUID() },
                'subscription-test',
              ),
              /Subscription changed/,
            );
            await assert.rejects(
              service.command(
                merchant.id,
                { ...activation, reason: 'Different retry' },
                'subscription-test',
              ),
              /different action/,
            );
            const originalEnd = state.endsAt;
            await act({ action: 'suspend' });
            assert.equal((await service.access(merchant.id)).allowed, false);
            await act({ action: 'resume' });
            assert.equal(state.endsAt, originalEnd);
            assert.deepEqual(
              await service.command(merchant.id, activation, 'subscription-test'),
              activated,
            );
            const renewal = await service.quote(merchant.id, {
              action: 'renew',
              planId: plan.id,
              months: 3,
            });
            assert.equal(renewal.startsAt, originalEnd);
            await act({
              action: 'renew',
              planId: plan.id,
              months: 3,
              planRevision: plan.revision,
              expectedDue: renewal.due,
              externalCollectionConfirmed: true,
            });
            assert.equal(state.periods.length, 2);
            await assert.rejects(
              service.quote(merchant.id, { action: 'change', planId: plan.id, months: 12 }),
              /prepaid renewal/,
            );
            await act({ action: 'cancel-at-end' });
            assert.equal(state.cancelAtEnd, true);
            assert.equal((await service.access(merchant.id)).allowed, true);
            await assert.rejects(
              service.quote(merchant.id, { action: 'renew', planId: plan.id, months: 1 }),
              /restore renewal/,
            );
            await act({ action: 'cancel' });
            assert.equal((await service.access(merchant.id)).allowed, false);
            const again = await service.quote(merchant.id, {
              action: 'activate',
              planId: plan.id,
              months: 1,
            });
            await act({
              action: 'activate',
              planId: plan.id,
              months: 1,
              planRevision: plan.revision,
              expectedDue: again.due,
              externalCollectionConfirmed: true,
            });
            assert.equal(
              (await service.quote(merchant.id, { action: 'renew', planId: plan.id, months: 1 }))
                .startsAt,
              state.currentPeriod?.endsAt,
              'Cancelled future periods must not postpone a later renewal.',
            );
            const change = await service.quote(merchant.id, {
              action: 'change',
              planId: plan.id,
              months: 12,
            });
            await act({
              action: 'change',
              planId: plan.id,
              months: 12,
              planRevision: plan.revision,
              expectedDue: change.due,
              effectiveAt: change.startsAt,
              externalCollectionConfirmed: true,
            });
            assert.equal(state.currentPeriod?.price, '2000.00');
            assert.equal(state.currentPeriod?.credit, change.credit);
            const updated = await plans.update(
              plan.id,
              {
                ...plan,
                monthlyPrice: '300.00',
                terms: [{ months: 12, price: '2200.00' }],
                revision: plan.revision,
              },
              'subscription-test',
            );
            assert.equal((await service.detail(merchant.id)).currentPeriod?.price, '2000.00');
            const changedQuote = await service.quote(merchant.id, {
              action: 'change',
              planId: plan.id,
              months: 12,
            });
            await assert.rejects(
              service.command(
                merchant.id,
                {
                  action: 'change',
                  requestId: randomUUID(),
                  revision: state.revision,
                  reason: 'Stale offer',
                  planId: plan.id,
                  months: 12,
                  planRevision: plan.revision,
                  expectedDue: changedQuote.due,
                  effectiveAt: changedQuote.startsAt,
                  externalCollectionConfirmed: true,
                },
                'subscription-test',
              ),
              /price changed/,
            );
            await plans.update(plan.id, { ...updated, available: false }, 'subscription-test');
            await assert.rejects(
              service.quote(other.id, { action: 'activate', planId: plan.id, months: 1 }),
              /available plan/,
            );
            const activePeriod = state.currentPeriod!;
            await tx.subscriptionPeriod.update({
              where: { id: activePeriod.id },
              data: {
                startsAt: new Date('2025-01-01T00:00:00Z'),
                endsAt: new Date('2025-02-01T00:00:00Z'),
                coverageEndsAt: new Date('2025-02-01T00:00:00Z'),
              },
            });
            assert.equal((await service.access(merchant.id)).status, 'expired');
            const owner = await tx.ownerAccount.create({
              data: {
                merchantId: merchant.id,
                username: `subscription-owner-${randomUUID()}`,
                passwordHash: 'unused',
              },
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
            const auth = new AuthService(client, {} as never, service);
            const req = (method: string, path: string) =>
              ({ method, path, headers: { cookie: `waffarly_owner_session=${token}` } }) as Request;
            assert.equal(
              (await auth.requireOwner(req('GET', '/auth/owner/me'))).subscriptionStatus,
              'expired',
            );
            await assert.rejects(auth.requireOwner(req('POST', '/owner/products')), /not active/);
            assert.equal(
              (await auth.requireOwner(req('POST', '/owner/orders/id/cancel'))).merchantId,
              merchant.id,
            );
            const branch = await tx.branch.create({
              data: {
                merchantId: merchant.id,
                name: 'Subscription recovery',
                createdBy: 'subscription-test',
                updatedBy: 'subscription-test',
              },
            });
            const employee = await tx.posEmployee.create({
              data: {
                merchantId: merchant.id,
                username: 'recovery-cashier',
                displayName: 'Recovery cashier',
                passwordHash: 'unused',
                role: 'cashier',
                createdBy: 'subscription-test',
                updatedBy: 'subscription-test',
                branches: {
                  create: {
                    branchId: branch.id,
                    createdBy: 'subscription-test',
                  },
                },
              },
            });
            const posToken = randomUUID();
            await tx.authSession.create({
              data: {
                subjectKind: 'POS',
                subjectId: employee.id,
                tokenHash: createHash('sha256').update(posToken).digest('hex'),
                expiresAt: new Date(Date.now() + 60000),
              },
            });
            const posReq = (path: string) =>
              ({
                method: 'POST',
                path,
                headers: { cookie: `waffarly_pos_session=${posToken}` },
              }) as Request;
            await assert.rejects(auth.requirePosEmployee(posReq('/pos/orders')), /not active/);
            await assert.rejects(auth.requirePosEmployee(posReq('/pos/shifts/open')), /not active/);
            assert.equal(
              (await auth.requirePosEmployee(posReq('/pos/orders/id/checks/check/payments')))
                .merchantId,
              merchant.id,
            );
            await tx.subscriptionEvent.createMany({
              data: Array.from({ length: 55 }, (_, index) => ({
                id: randomUUID(),
                merchantId: merchant.id,
                requestId: randomUUID(),
                fingerprint: createHash('sha256').update(String(index)).digest('hex'),
                action: 'suspend',
                administrator: 'subscription-test',
                reason: 'Pagination fixture',
                result: {},
              })),
            });
            const history = await service.detail(merchant.id);
            assert.equal(history.events.length, 50);
            assert.ok(history.nextEventCursor);
            assert.ok(
              (await service.history(merchant.id, 'events', history.nextEventCursor)).items.length >
                0,
            );
            await assert.rejects(
              service.history(other.id, 'events', history.nextEventCursor),
              /Invalid history cursor/,
            );
            const legacy = await tx.merchant.create({
              data: { ...merchantData(), firstMonthActivatedAt: new Date() },
            });
            assert.equal((await service.access(legacy.id)).status, 'legacy');
            assert.equal((await service.access(legacy.id)).allowed, true);
            assert.ok((await service.dashboard()).counts.expired >= 1);
            throw rollback;
          },
          { timeout: 25000 },
        ),
        rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

it(
  'creates owner and pending plan assignment atomically during onboarding',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const rollback = new Error('Rollback subscription onboarding fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const client = scoped(tx);
            const subscriptions = new SubscriptionService(client);
            const merchants = new MerchantService(client, subscriptions);
            const plan = await tx.monthlyPlan.create({
              data: {
                creationRequest: randomUUID(),
                name: 'Onboarding offer',
                description: '',
                monthlyPrice: '200.00',
                createdBy: 'subscription-test',
                updatedBy: 'subscription-test',
                terms: { create: { months: 6, price: '900.00' } },
              },
            });
            const created = await merchants.create(
              {
                name: 'Subscription onboarding',
                contactPhone: '01000000000',
                ownerName: 'Test owner',
                ownerMobile: '01100000000',
                username: `sub-${randomUUID()}`,
                password: 'Test-only-password-123',
                subscription: { planId: plan.id, months: 6 },
              },
              'onboarding-admin',
            );
            const assigned = await subscriptions.detail(created.id);
            assert.equal(assigned.status, 'pending');
            assert.equal(assigned.assignedMonths, 6);
            assert.equal(assigned.assignedPlanId, plan.id);
            assert.equal(assigned.events[0]?.administrator, 'onboarding-admin');
            assert.equal(assigned.periods.length, 0);
            assert.ok(await tx.ownerAccount.findUnique({ where: { merchantId: created.id } }));
            throw rollback;
          },
          { timeout: 15000 },
        ),
        rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

it(
  'serializes competing activations and exact duplicate retries without double collection',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const service = new SubscriptionService(prisma as unknown as PrismaService);
    const merchant = await prisma.merchant.create({ data: merchantData() });
    const plan = await prisma.monthlyPlan.create({
      data: {
        creationRequest: randomUUID(),
        name: 'Concurrent subscription test',
        description: '',
        monthlyPrice: '100.00',
        createdBy: 'subscription-test',
        updatedBy: 'subscription-test',
      },
    });
    try {
      const quote = await service.quote(merchant.id, {
        action: 'activate',
        planId: plan.id,
        months: 1,
      });
      const input: SubscriptionCommand = {
        action: 'activate',
        revision: 1,
        reason: 'Concurrent receipt',
        requestId: randomUUID(),
        planId: plan.id,
        months: 1,
        planRevision: plan.revision,
        expectedDue: quote.due,
        externalCollectionConfirmed: true,
      };
      const results = await Promise.allSettled([
        service.command(merchant.id, input, 'subscription-test'),
        service.command(merchant.id, { ...input, requestId: randomUUID() }, 'subscription-test'),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        await prisma.subscriptionPeriod.count({ where: { merchantId: merchant.id } }),
        1,
      );
      assert.equal(await prisma.subscriptionEvent.count({ where: { merchantId: merchant.id } }), 1);
      const revision = (await service.detail(merchant.id)).revision;
      const suspend: SubscriptionCommand = {
        action: 'suspend',
        revision,
        requestId: randomUUID(),
        reason: 'Duplicate stop',
      };
      const duplicates = await Promise.all([
        service.command(merchant.id, suspend, 'subscription-test'),
        service.command(merchant.id, suspend, 'subscription-test'),
      ]);
      assert.deepEqual(duplicates[0], duplicates[1]);
      assert.equal(await prisma.subscriptionEvent.count({ where: { merchantId: merchant.id } }), 2);
    } finally {
      await prisma.subscriptionEvent.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.subscriptionPeriod.deleteMany({ where: { merchantId: merchant.id } });
      await prisma.subscription.delete({ where: { merchantId: merchant.id } });
      await prisma.merchant.delete({ where: { id: merchant.id } });
      await prisma.monthlyPlan.delete({ where: { id: plan.id } });
      await prisma.$disconnect();
    }
  },
);
