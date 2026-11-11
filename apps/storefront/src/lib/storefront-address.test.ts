import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { storefrontHostHandle, storefrontHref, storefrontRequestHandle } from './storefront-address';

test('production storefront routing uses the configured domain and preserves clean links', () => {
  const environment: Record<string, string | undefined> = process.env;
  const original = { NODE_ENV: process.env.NODE_ENV, STOREFRONT_BASE_DOMAIN: process.env.STOREFRONT_BASE_DOMAIN, __NEXT_NO_MIDDLEWARE_URL_NORMALIZE: process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE };
  try {
    environment.NODE_ENV = 'production';
    process.env.STOREFRONT_BASE_DOMAIN = 'wfarly.com';
    process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = '1';
    assert.equal(storefrontHostHandle('abo-ali.wfarly.com'), 'abo-ali');
    assert.equal(storefrontHostHandle('ABO-ALI.WFARLY.COM:443'), 'abo-ali');
    assert.equal(storefrontHostHandle('wfarly.com'), null);
    assert.equal(storefrontHostHandle('abo-ali.wfarly.com.evil.example'), null);
    assert.equal(storefrontHostHandle('abo-ali.localhost:3000'), null);
    assert.equal(storefrontHref('/s/technical-store/cart', 'technical-store', true), '/cart');
    const rewritten = proxy(new NextRequest('http://127.0.0.1:3000/cart', {
      headers: { host: 'abo-ali.wfarly.com', 'x-waffarly-storefront-handle': 'another-store' },
    }));
    assert.equal(rewritten.headers.get('x-middleware-request-x-waffarly-storefront-handle'), 'abo-ali');
    assert.equal(new URL(rewritten.headers.get('x-middleware-rewrite')!).pathname, '/s/abo-ali/cart');
    assert.equal(new URL(rewritten.headers.get('x-middleware-rewrite')!).hostname, '127.0.0.1');
    const main = proxy(new NextRequest('http://localhost:3000/s/technical-store', {
      headers: { host: 'wfarly.com', 'x-waffarly-storefront-handle': 'another-store' },
    }));
    assert.equal(main.headers.get('x-middleware-request-x-waffarly-storefront-handle'), null);
    const legacy = proxy(new NextRequest('http://127.0.0.1:3000/marketplace', {
      headers: { host: 'wfarly.com', 'x-forwarded-proto': 'https' },
    }));
    assert.equal(legacy.headers.get('location'), 'https://wfarly.com/');
    assert.equal(storefrontRequestHandle(new Headers({ host: 'localhost:3000', 'x-waffarly-storefront-handle': 'abo-ali' })), 'abo-ali');
    delete process.env.STOREFRONT_BASE_DOMAIN;
    assert.equal(storefrontHostHandle('abo-ali.wfarly.com'), null);
    environment.NODE_ENV = 'development';
    assert.equal(storefrontHostHandle('abo-ali.localhost:3000'), 'abo-ali');
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
