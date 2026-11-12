import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { it } from 'node:test';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { isDatabaseUnavailable } from '../../src/infrastructure/database/prisma-errors.js';

it(
  'classifies an actual refused PostgreSQL connection as unavailable',
  { timeout: 5_000 },
  async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const prisma = new PrismaClient({
      adapter: createPostgresAdapter(`postgresql://test:test@127.0.0.1:${address.port}/test`, {
        connectionTimeoutMillis: 100,
      }),
    });
    try {
      await assert.rejects(prisma.$queryRaw`SELECT 1`, (error: unknown) => {
        assert.equal(isDatabaseUnavailable(error), true, String(error));
        return true;
      });
    } finally {
      await prisma.$disconnect();
    }
  },
);

it(
  'bounds connections to an unresponsive database and releases the pool',
  { timeout: 5_000 },
  async () => {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const prisma = new PrismaClient({
      adapter: createPostgresAdapter(`postgresql://test:test@127.0.0.1:${address.port}/test`, {
        max: 1,
        connectionTimeoutMillis: 100,
      }),
    });
    try {
      await assert.rejects(prisma.$queryRaw`SELECT 1`, (error: unknown) => {
        assert.equal(isDatabaseUnavailable(error), true, String(error));
        return true;
      });
    } finally {
      await prisma.$disconnect();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
