import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { CustomersService } from '../../src/modules/customers/index.js';
import { OrderCustomerService } from '../../src/modules/orders/customers/order-customer.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const url = process.env.DATABASE_URL;

it(
  'customer persistence: isolation, retry, revisions, privacy and immutable order contact',
  { skip: !url },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(url!) });
    const rollback = new Error('Rollback customer fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            const data = {
              name: 'Customer fixture',
              activity: 'restaurant',
              contactPhone: '01000000000',
              ownerName: 'Owner',
              ownerMobile: '01100000000',
            };
            const a = await tx.merchant.create({
              data: { ...data, storefrontSlug: `customers-a-${randomUUID()}` },
            });
            const b = await tx.merchant.create({
              data: { ...data, storefrontSlug: `customers-b-${randomUUID()}` },
            });
            // Share one rollback transaction, including application-owned transaction callbacks.
            const client = new Proxy(tx, {
              get(target, key) {
                if (key === '$transaction') return async (fn: (db: typeof tx) => unknown) => fn(tx);
                return Reflect.get(target, key);
              },
            });
            const customers = new CustomersService(client as never);
            const orders = new OrderCustomerService(client as never, customers);
            const input = { requestId: randomUUID(), name: ' Ahmed ', phone: '01012345678' };
            const first = await customers.create(a.id, 'owner-a', input);
            assert.equal(first.firstChannel, 'manual');
            assert.equal(first.name, 'Ahmed');
            assert.equal('accountId' in first, false);
            assert.equal('creationFingerprint' in first, false);
            assert.equal((await customers.create(a.id, 'owner-a', input)).id, first.id);
            await assert.rejects(
              customers.create(a.id, 'owner-a', { ...input, name: 'Other' }),
              /different customer data/,
            );
            // Shared contact details do not assert that two people own the same account.
            const duplicate = await customers.create(a.id, 'owner-a', {
              ...input,
              requestId: randomUUID(),
            });
            assert.notEqual(duplicate.id, first.id);
            const other = await customers.create(b.id, 'owner-b', input);
            const account = await tx.customerAccount.create({
              data: {
                phone: `+999${randomUUID().replace(/\D/g, '').padEnd(10, '0').slice(0, 10)}`,
                phoneVerifiedAt: new Date(),
                displayName: 'Global name',
              },
            });
            // Only trusted verification/claim code may perform these links, never owner APIs.
            await tx.merchantCustomer.updateMany({
              where: { id: first.id, merchantId: a.id },
              data: { accountId: account.id },
            });
            await tx.merchantCustomer.updateMany({
              where: { id: other.id, merchantId: b.id },
              data: { accountId: account.id },
            });
            assert.equal('accountId' in (await customers.get(a.id, first.id)), false);
            assert.equal('account' in (await customers.get(b.id, other.id)), false);
            await assert.rejects(customers.get(b.id, first.id), /not found/);
            await assert.rejects(
              customers.update(b.id, 'owner-b', first.id, { revision: 1, notes: 'foreign' }),
              /not found/,
            );
            await assert.rejects(
              customers.list(b.id, { limit: 1, search: '', status: 'all', cursor: first.id }),
              /cursor is invalid/,
            );
            const page = await customers.list(a.id, { limit: 1, search: '', status: 'all' });
            assert.equal(page.items.length, 1);
            assert.ok(page.nextCursor);
            const next = await customers.list(a.id, {
              limit: 1,
              search: '',
              status: 'all',
              cursor: page.nextCursor,
            });
            assert.equal(next.items.length, 1);
            assert.notEqual(next.items[0]!.id, page.items[0]!.id);
            const changed = await customers.update(a.id, 'owner-a', first.id, {
              revision: 1,
              notes: 'Private to A',
              segment: 'vip',
            });
            assert.equal(changed.revision, 2);
            assert.equal((await customers.get(b.id, other.id)).notes, '');
            await assert.rejects(
              customers.update(a.id, 'owner-a', first.id, { revision: 1, name: 'stale' }),
              /has changed/,
            );
            const order = await tx.storefrontOrder.create({
              data: {
                merchantId: a.id,
                source: 'storefront',
                customerName: 'Original name',
                customerPhone: '01099999999',
                fulfillmentType: 'pickup',
                total: '35.50',
              },
            });
            await assert.rejects(
              orders.link(a.id, 'owner-a', order.id, { revision: 1, customerId: other.id }),
              /not found/,
            );
            await assert.rejects(
              orders.link(b.id, 'owner-b', order.id, { revision: 1, customerId: other.id }),
              /not found/,
            );
            await assert.rejects(
              orders.link(a.id, 'owner-a', order.id, { revision: 99, customerId: first.id }),
              /has changed/,
            );
            const linked = await orders.link(a.id, 'owner-a', order.id, {
              revision: 1,
              customerId: first.id,
            });
            assert.equal(linked.revision, 2);
            assert.deepEqual(
              await orders.link(a.id, 'owner-a', order.id, { revision: 1, customerId: first.id }),
              linked,
            );
            await assert.rejects(
              orders.link(a.id, 'owner-a', order.id, { revision: 2, customerId: duplicate.id }),
              /another customer/,
            );
            const history = await orders.history(a.id, first.id, { limit: 10 });
            assert.equal(history.items[0]!.total, '35.50');
            assert.equal(history.items[0]!.source, 'storefront');
            assert.deepEqual((await orders.history(b.id, other.id, { limit: 10 })).items, []);
            await customers.update(a.id, 'owner-a', first.id, {
              revision: 2,
              name: 'New name',
              phone: null,
              archived: true,
            });
            const saved = await tx.storefrontOrder.findUniqueOrThrow({ where: { id: order.id } });
            assert.equal(
              (await tx.customerAccount.findUniqueOrThrow({ where: { id: account.id } }))
                .displayName,
              'Global name',
            );
            assert.equal(saved.customerName, 'Original name');
            assert.equal(saved.customerPhone, '01099999999');
            assert.equal(saved.customerLinkedBy, 'owner-a');
            assert.ok(saved.customerLinkedAt);
            const unlinked = await tx.storefrontOrder.create({
              data: { merchantId: a.id, fulfillmentType: 'pickup', total: '0' },
            });
            await assert.rejects(
              orders.link(a.id, 'owner-a', unlinked.id, { revision: 1, customerId: first.id }),
              /not found/,
            );
            throw rollback;
          },
          { timeout: 20000 },
        ),
        rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

it('database rejects an order referencing another tenant customer', { skip: !url }, async () => {
  const prisma = new PrismaClient({ adapter: createPostgresAdapter(url!) });
  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const data = {
          name: 'Constraint fixture',
          contactPhone: '01000000000',
          ownerName: 'Owner',
          ownerMobile: '01100000000',
        };
        const a = await tx.merchant.create({
          data: { ...data, storefrontSlug: `customer-fk-a-${randomUUID()}` },
        });
        const b = await tx.merchant.create({
          data: { ...data, storefrontSlug: `customer-fk-b-${randomUUID()}` },
        });
        const customer = await tx.merchantCustomer.create({
          data: {
            merchantId: a.id,
            name: 'A',
            creationRequest: randomUUID(),
            creationFingerprint: 'a'.repeat(64),
            createdBy: 'test',
            updatedBy: 'test',
          },
        });
        await tx.storefrontOrder.create({
          data: {
            merchantId: b.id,
            merchantCustomerId: customer.id,
            fulfillmentType: 'pickup',
            total: '1',
          },
        });
      }),
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003',
    );
  } finally {
    await prisma.$disconnect();
  }
});
