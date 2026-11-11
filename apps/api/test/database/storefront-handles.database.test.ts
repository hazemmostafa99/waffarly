import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { config } from 'dotenv';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MerchantService } from '../../src/modules/merchants/merchant.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;

it(
  'reserves public handles atomically, preserves POS codes and prevents replacement',
  { skip: !databaseUrl },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl!) });
    const service = new MerchantService(prisma as unknown as PrismaService);
    const ids: string[] = [randomUUID(), randomUUID(), randomUUID()];
    const handle = `address-${randomUUID()}`;
    try {
      for (const id of ids)
        await prisma.merchant.create({
          data: {
            id,
            name: 'Address test fixture',
            storefrontSlug: `technical-${id}`,
            contactPhone: '000000',
            ownerName: 'Test fixture',
            ownerMobile: '000000',
          },
        });
      const results = await Promise.allSettled(
        ids.slice(0, 2).map((id) => service.assignStorefrontHandle(id!, handle, 'address-test')),
      );
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = results.find((result) => result.status === 'rejected');
      assert.equal(rejected?.status === 'rejected' && rejected.reason.getStatus(), 409);
      const winner = await prisma.merchant.findUniqueOrThrow({
        where: { storefrontHandle: handle },
      });
      assert.equal(winner.storefrontSlug, `technical-${winner.id}`);
      assert.equal(winner.storefrontHandleAssignedBy, 'address-test');
      assert.ok(winner.storefrontHandleAssignedAt);
      assert.deepEqual(await service.resolveStorefrontHandle(handle), {
        handle,
        storefrontSlug: winner.storefrontSlug,
      });
      await service.assignStorefrontHandle(winner.id, handle, 'other-admin');
      const replay = await prisma.merchant.findUniqueOrThrow({ where: { id: winner.id } });
      assert.equal(replay.storefrontHandleAssignedBy, 'address-test');
      await assert.rejects(
        service.assignStorefrontHandle(winner.id, `replacement-${randomUUID()}`, 'address-test'),
        { status: 409 },
      );
      await assert.rejects(service.assignStorefrontHandle(ids[2]!, 'admin', 'address-test'), {
        status: 400,
      });
      await assert.rejects(service.resolveStorefrontHandle('admin'), { status: 404 });
      await assert.rejects(service.resolveStorefrontHandle(`missing-${randomUUID()}`), {
        status: 404,
      });
      await assert.rejects(
        service.assignStorefrontHandle(randomUUID(), `absent-${randomUUID()}`, 'address-test'),
        { status: 404 },
      );
      const race = await Promise.allSettled([
        service.assignStorefrontHandle(ids[2]!, `first-${randomUUID()}`, 'first-admin'),
        service.assignStorefrontHandle(ids[2]!, `second-${randomUUID()}`, 'second-admin'),
      ]);
      assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
      const username = `address-owner-${randomUUID()}`;
      const creation = {
        name: 'Address test fixture',
        contactPhone: '000000',
        ownerName: 'Test fixture',
        ownerMobile: '000000',
        username,
        password: 'test-fixture-password',
        storefrontHandle: handle,
      };
      await assert.rejects(service.create(creation, 'address-test'), { status: 409 });
      assert.equal(await prisma.ownerAccount.findUnique({ where: { username } }), null);
      const created = await service.create(
        { ...creation, storefrontHandle: `created-${randomUUID()}` },
        'address-test',
      );
      ids.push(created.id);
      assert.ok(created.storefrontHandle);
      assert.equal(
        (await service.resolveStorefrontHandle(created.storefrontHandle!)).storefrontSlug,
        created.businessCode,
      );
    } finally {
      try {
        await prisma.ownerAccount.deleteMany({ where: { merchantId: { in: ids } } });
        await prisma.subscription.deleteMany({ where: { merchantId: { in: ids } } });
        await prisma.merchant.deleteMany({ where: { id: { in: ids } } });
      } finally {
        await prisma.$disconnect();
      }
    }
  },
);
