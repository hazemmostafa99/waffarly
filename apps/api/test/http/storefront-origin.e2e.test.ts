import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { configureHttpApplication } from '../../src/configure-http-application.js';
import type { AppConfiguration } from '../../src/config/app-configuration.js';
import type { StructuredLogger } from '../../src/common/logging/structured-logger.js';
import { MerchantService } from '../../src/modules/merchants/index.js';

@Controller()
class OriginProbeController {
  @Get('catalog/stores/:slug') get() {
    return { ok: true };
  }
  @Post('catalog/stores/:slug/orders') checkout() {
    return { ok: true };
  }
  @Post('admin/probe') admin() {
    return { ok: true };
  }
}

describe('registered local storefront origin policy', () => {
  let app: INestApplication;
  let development: boolean;
  let baseDomain: string | undefined;
  let lookups: number;
  const origin = 'http://abo-ali.localhost:3000';
  beforeEach(async () => {
    development = true;
    baseDomain = undefined;
    lookups = 0;
    const module = await Test.createTestingModule({
      controllers: [OriginProbeController],
      providers: [
        {
          provide: MerchantService,
          useValue: {
            resolveStorefrontHandle: async (handle: string) => {
              lookups++;
              if (handle !== 'abo-ali') throw new Error('Unknown merchant');
              return { handle, storefrontSlug: 'technical-store' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureHttpApplication(
      app,
      {
        corsOrigins: ['http://localhost:3000', 'http://localhost:5173', 'https://wfarly.com'],
        get storefrontBaseDomain() {
          return baseDomain;
        },
        get isDevelopment() {
          return development;
        },
        mediaStorageDirectory: 'unused-test-media',
      } as AppConfiguration,
      { log() {}, warn() {}, error() {} } as unknown as StructuredLogger,
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('permits its own public catalog/checkout and preflight without credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/catalog/stores/technical-store/orders')
      .set('Origin', origin)
      .send({})
      .expect(201);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.equal(response.headers['access-control-allow-credentials'], undefined);
    assert.equal(lookups, 1); // CORS and unsafe-request protection reuse one decision.
    await request(app.getHttpServer())
      .options('/catalog/stores/technical-store/orders')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', origin);
    await request(app.getHttpServer())
      .get('/catalog/stores/technical-store')
      .set('Origin', origin)
      .expect(200)
      .expect('Access-Control-Allow-Origin', origin);
  });
  it('does not authorize another tenant, unknown handle, untrusted port or admin write', async () => {
    for (const [path, source] of [
      ['/catalog/stores/other-technical-store/orders', origin],
      ['/catalog/stores/technical-store/orders', 'http://unknown.localhost:3000'],
      ['/catalog/stores/technical-store/orders', 'http://abo-ali.localhost:9999'],
      ['/admin/probe', origin],
      ['/catalog/stores/technical-store/orders', 'http://abo-ali.localhost.evil.example:3000'],
      ['/catalog/stores/technical-store/orders', 'http://pos.localhost:3000'],
    ]) {
      const response = await request(app.getHttpServer())
        .post(path!)
        .set('Origin', source!)
        .send({})
        .expect(403);
      assert.equal(response.headers['access-control-allow-origin'], undefined);
    }
  });
  it('keeps existing trusted application origins and disables dynamic origins outside development', async () => {
    development = false;
    await request(app.getHttpServer())
      .post('/catalog/stores/technical-store/orders')
      .set('Origin', origin)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/admin/probe')
      .set('Origin', 'http://localhost:5173')
      .send({})
      .expect(201)
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('permits only registered HTTPS production stores to access their own catalog', async () => {
    development = false;
    baseDomain = 'wfarly.com';
    const source = 'https://abo-ali.wfarly.com';
    await request(app.getHttpServer())
      .post('/catalog/stores/technical-store/orders')
      .set('Origin', source)
      .send({})
      .expect(201)
      .expect('Access-Control-Allow-Origin', source);
    for (const denied of [
      'https://unknown.wfarly.com',
      'https://abo-ali.wfarly.com.evil.example',
      'https://nested.abo-ali.wfarly.com',
      'http://abo-ali.wfarly.com',
      'https://abo-ali.wfarly.com:444',
      'https://pos.wfarly.com',
    ]) {
      await request(app.getHttpServer())
        .post('/catalog/stores/technical-store/orders')
        .set('Origin', denied)
        .send({})
        .expect(403);
    }
    await request(app.getHttpServer())
      .post('/catalog/stores/other-store/orders')
      .set('Origin', source)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/admin/probe')
      .set('Origin', source)
      .send({})
      .expect(403);
  });

  it('allows customer auth preflight with credentials only for registered storefronts', async () => {
    development = false;
    baseDomain = 'wfarly.com';
    await request(app.getHttpServer())
      .options('/auth/customer/login')
      .set('Origin', 'https://abo-ali.wfarly.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'https://abo-ali.wfarly.com')
      .expect('Access-Control-Allow-Credentials', 'true');
    const denied = await request(app.getHttpServer())
      .post('/auth/customer/login')
      .set('Origin', 'https://unknown.wfarly.com')
      .send({})
      .expect(403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  });
});
