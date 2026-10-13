import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { StructuredLogger } from '../src/common/logging/structured-logger.js';
import { configureHttpApplication } from '../src/configure-http-application.js';
import { AppConfiguration } from '../src/config/app-configuration.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';

const { AppModule } = await import('../src/app.module.js');

async function createTestApplication(queryRaw: () => Promise<unknown>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ $queryRaw: queryRaw })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureHttpApplication(app, app.get(AppConfiguration), new StructuredLogger());
  await app.init();
  return app;
}

describe('health endpoints', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('initializes Nest and returns liveness', async () => {
    app = await createTestApplication(async () => []);
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    assert.deepEqual(response.body, { status: 'ok', service: 'waffarly-api' });
  });

  it('reports a successful PostgreSQL connectivity query', async () => {
    app = await createTestApplication(async () => [{ '?column?': 1 }]);
    const response = await request(app.getHttpServer()).get('/health/db').expect(200);
    assert.deepEqual(response.body, { status: 'ok', database: 'connected' });
  });

  it('returns 503 when PostgreSQL connectivity fails', async () => {
    app = await createTestApplication(async () => {
      throw new Error('connection refused');
    });
    const response = await request(app.getHttpServer()).get('/health/db').expect(503);
    assert.equal(response.body.errorCode, 'DATABASE_UNAVAILABLE');
    assert.equal(response.body.message, 'Database is unavailable.');
  });
});
