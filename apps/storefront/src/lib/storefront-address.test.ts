import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storefrontHostHandle, storefrontHref } from './storefront-address';

test('production storefront routing uses the configured domain and preserves clean links', () => {
  const environment: Record<string, string | undefined> = process.env;
  const original = { NODE_ENV: process.env.NODE_ENV, STOREFRONT_BASE_DOMAIN: process.env.STOREFRONT_BASE_DOMAIN };
  try {
    environment.NODE_ENV = 'production';
    process.env.STOREFRONT_BASE_DOMAIN = 'wfarly.com';
    assert.equal(storefrontHostHandle('abo-ali.wfarly.com'), 'abo-ali');
    assert.equal(storefrontHostHandle('ABO-ALI.WFARLY.COM:443'), 'abo-ali');
    assert.equal(storefrontHostHandle('wfarly.com'), null);
    assert.equal(storefrontHostHandle('abo-ali.wfarly.com.evil.example'), null);
    assert.equal(storefrontHostHandle('abo-ali.localhost:3000'), null);
    assert.equal(storefrontHref('/s/technical-store/cart', 'technical-store', true), '/cart');
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
