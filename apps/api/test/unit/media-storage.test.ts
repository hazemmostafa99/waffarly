import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MediaService } from '../../src/modules/media/media.service.js';

const image = { originalName: 'dish.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) };

it('removes the uploaded bytes when media metadata cannot be persisted', async () => {
  let writtenKey = '';
  let removedKey = '';
  const failure = new Error('Database unavailable');
  const service = new MediaService(
    {
      mediaAsset: {
        create: async () => {
          throw failure;
        },
      },
    } as unknown as PrismaService,
    {
      write: async (key) => {
        writtenKey = key;
      },
      remove: async (key) => {
        removedKey = key;
      },
      publicUrl: (key) => `https://media.example.test/${key}`,
    },
  );
  await assert.rejects(service.upload('merchant', 'owner', image), (error) => error === failure);
  assert.ok(writtenKey.startsWith('merchant/'));
  assert.equal(removedKey, writtenKey);
});

it('does not delete an existing storage object when writing the new bytes fails', async () => {
  let removed = false;
  let persisted = false;
  const failure = new Error('Object already exists');
  const service = new MediaService(
    {
      mediaAsset: {
        create: async () => {
          persisted = true;
        },
      },
    } as unknown as PrismaService,
    {
      write: async () => {
        throw failure;
      },
      remove: async () => {
        removed = true;
      },
      publicUrl: (key) => `https://media.example.test/${key}`,
    },
  );
  await assert.rejects(service.upload('merchant', 'owner', image), (error) => error === failure);
  assert.equal(removed, false);
  assert.equal(persisted, false);
});
