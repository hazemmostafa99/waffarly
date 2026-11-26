import { testStorefrontHandle } from '../support/merchant-fixtures.js';
import { createTestDatabaseClient } from '../support/test-database.js';
import { getTestDatabaseUrl } from '../support/test-database-environment.js';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { MerchantPosAppearanceService } from '../../src/modules/merchants/merchant-pos-appearance.service.js';

const databaseUrl = getTestDatabaseUrl();

it(
  'persists merchant POS accent with revision checks and tenant isolation',
  { skip: !databaseUrl },
  async (testContext) => {
    assert.ok(databaseUrl);
    const prisma = createTestDatabaseClient(testContext);
    const rollback = new Error('Rollback POS appearance fixtures');
    try {
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          const token = randomUUID();
          const merchantData = {
            name: 'POS appearance test',
            activity: 'restaurant',
            contactPhone: '01000000000',
            ownerName: 'Test Owner',
            ownerMobile: '01100000000',
          };
          const merchant = await tx.merchant.create({
            data: { ...merchantData, storefrontSlug: `pos-appearance-${token}`, storefrontHandle: testStorefrontHandle() },
          });
          const other = await tx.merchant.create({
            data: { ...merchantData, storefrontSlug: `pos-appearance-other-${token}`, storefrontHandle: testStorefrontHandle() },
          });
          const service = new MerchantPosAppearanceService(tx as never);

          assert.deepEqual(await service.get(merchant.id), {
            accent: 'orange',
            revision: 1,
            updatedAt: (
              await tx.merchant.findUniqueOrThrow({ where: { id: merchant.id } })
            ).posAppearanceUpdatedAt.toISOString(),
          });
          const updated = await service.update(merchant.id, 'owner-one', {
            accent: 'plum',
            revision: 1,
          });
          assert.equal(updated.accent, 'plum');
          assert.equal(updated.revision, 2);
          assert.equal((await service.get(other.id)).accent, 'orange');
          assert.equal((await service.get(other.id)).revision, 1);
          await assert.rejects(
            service.update(merchant.id, 'owner-one', { accent: 'teal', revision: 1 }),
            /POS appearance has changed/,
          );
          const stored = await tx.merchant.findUniqueOrThrow({ where: { id: merchant.id } });
          assert.equal(stored.posAccent, 'plum');
          assert.equal(stored.posAppearanceRevision, 2);
          assert.equal(stored.posAppearanceUpdatedBy, 'owner-one');
          throw rollback;
        }),
        rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
