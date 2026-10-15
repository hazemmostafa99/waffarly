import { ConflictException } from '@nestjs/common';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ActivitiesModulesService } from '../../src/modules/activities/activities-modules.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

it('persists catalog overrides and enforces SQL constraints in a rolled-back transaction', async () => {
  assert.ok(process.env.DATABASE_URL, 'Configure DATABASE_URL and apply migrations first.');
  const client = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
  const service = new ActivitiesModulesService(client as PrismaService);
  const rollback = new Error('Rollback verification fixtures');
  try {
    const initial = await service.catalog();
    await assert.rejects(
      client.$transaction(async (transaction) => {
        const testService = new ActivitiesModulesService({
          businessActivity: transaction.businessActivity,
          platformModule: transaction.platformModule,
          $transaction: async <T>(fn: (value: typeof transaction) => Promise<T>) => fn(transaction),
        } as unknown as PrismaService);
        const activity = initial.activities[0];
        const module = initial.modules[1];
        assert.ok(activity && module);
        const saved = await testService.updateActivity(
          'restaurant',
          {
            name: 'Database verification restaurant',
            description: 'Temporary fixture',
            moduleKeys: ['storefront-design'],
            revision: activity.revision,
          },
          'database-verification',
        );
        assert.equal(saved.revision, activity.revision + 1);
        assert.equal(saved.updatedBy, 'database-verification');
        const edited = await testService.updateModule(
          module.key,
          {
            name: 'Database verification design',
            description: 'Temporary fixture',
            revision: module.revision,
          },
          'database-verification',
        );
        assert.equal(edited.revision, module.revision + 1);
        await assert.rejects(
          testService.updateActivity(
            'restaurant',
            {
              name: 'Stale',
              description: saved.description,
              moduleKeys: saved.moduleKeys,
              revision: saved.revision + 5,
            },
            'database-verification',
          ),
          ConflictException,
        );
        const latest = await testService.catalog();
        assert.equal(latest.modules[1]?.name, edited.name);
        assert.deepEqual(latest.activities[0]?.moduleKeys, ['storefront-design']);

        await transaction.$executeRawUnsafe('SAVEPOINT invalid_activity');
        await assert.rejects(
          transaction.$executeRawUnsafe(
            "UPDATE business_activities SET \"moduleKeys\" = ARRAY['orders'] WHERE key = 'restaurant'",
          ),
          /business_activities_modules_check/,
        );
        await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_activity');
        await transaction.$executeRawUnsafe('SAVEPOINT invalid_module');
        await assert.rejects(
          transaction.$executeRawUnsafe(
            "UPDATE platform_modules SET revision = 0 WHERE key = 'storefront-design'",
          ),
          /platform_modules_revision_check/,
        );
        await transaction.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_module');
        throw rollback;
      }),
      (cause) => cause === rollback,
    );
    assert.deepEqual(
      await service.catalog(),
      initial,
      'Verification must leave saved catalog values unchanged.',
    );
  } finally {
    await client.$disconnect();
  }
});
