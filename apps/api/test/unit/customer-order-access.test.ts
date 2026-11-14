import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CustomerOrderAccessService,
  orderIdentityWhere,
} from '../../src/modules/orders/customers/customer-order-access.service.js';
const request = (cookie = '') => ({ headers: { cookie } }) as Request;
function fixture(accountId: string | null = null) {
  const seen: unknown[] = [];
  const db = {
    customerOrderAccess: {
      findFirst: async (input: unknown) => {
        seen.push(input);
        return null;
      },
      updateMany: async (input: unknown) => {
        seen.push(input);
        return { count: 0 };
      },
      findMany: async (input: unknown) => {
        seen.push(input);
        return [];
      },
    },
  };
  const auth = {
    me: async () => {
      if (!accountId) throw new UnauthorizedException();
      return { id: accountId };
    },
  };
  return {
    service: new CustomerOrderAccessService(
      db as never,
      auth as never,
      { isProduction: true } as never,
    ),
    seen,
  };
}
test('anonymous readers without proof receive an empty authorization scope', async () => {
  const { service } = fixture();
  assert.deepEqual(await service.scope(request()), { orderId: { in: [] } });
});
test('an authenticated account is derived from server authentication', async () => {
  const { service } = fixture('account-a');
  assert.deepEqual(await service.identity(request('waffarly_customer_session=session')), {
    accountId: 'account-a',
  });
});
test('expired customer authentication is rejected rather than silently creating a guest order', async () => {
  const { service } = fixture();
  await assert.rejects(
    service.identity(request('waffarly_customer_session=expired')),
    UnauthorizedException,
  );
});
test('guest authorization stores a digest and only reads unclaimed, unexpired grants', () => {
  const { service } = fixture();
  const raw = 'A'.repeat(43);
  const identity = service.guest(request('waffarly_guest_orders=' + raw));
  assert.ok(identity && 'guestHash' in identity);
  assert.equal(identity.guestHash.length, 64);
  assert.notEqual(identity.guestHash, raw);
  const scope = orderIdentityWhere(identity);
  assert.equal(scope.accountId, null);
  assert.ok(scope.guestExpiresAt);
});
test('guest session cookie is HttpOnly, Secure in production and has a bounded lifetime', async () => {
  const { service } = fixture();
  let options: Record<string, unknown> = {};
  const response = {
    cookie: (_name: string, value: string, input: Record<string, unknown>) => {
      assert.equal(value.length, 43);
      options = input;
    },
  } as unknown as Response;
  await service.prepare(request(), response);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.maxAge, 30 * 24 * 60 * 60 * 1000);
});
test('knowing an order UUID does not grant access', async () => {
  const { service, seen } = fixture();
  await assert.rejects(service.detail(request(), 'other-order'), NotFoundException);
  const query = seen[0] as { where: { AND: unknown[] } };
  assert.deepEqual(query.where.AND, [{ orderId: { in: [] } }, { orderId: 'other-order' }]);
});
test('guest cannot claim an order without signing in', async () => {
  const { service, seen } = fixture();
  await assert.rejects(
    service.claim(request('waffarly_guest_orders=' + 'A'.repeat(43)), 'order'),
    UnauthorizedException,
  );
  assert.equal(seen.length, 0);
});

test('claim requires both the signed-in account and unexpired guest proof, and clears the guest grant', async () => {
  const { service, seen } = fixture('account-a');
  await assert.rejects(
    service.claim(
      request('waffarly_customer_session=session; waffarly_guest_orders=' + 'A'.repeat(43)),
      'foreign-order',
    ),
    NotFoundException,
  );
  const write = seen[1] as {
    where: { orderId: string; accountId: unknown; guestHash: string; guestExpiresAt: unknown };
    data: Record<string, unknown>;
  };
  assert.equal(write.where.orderId, 'foreign-order');
  assert.equal(write.where.accountId, null);
  assert.equal(write.where.guestHash.length, 64);
  assert.ok(write.where.guestExpiresAt);
  assert.equal(write.data.accountId, 'account-a');
  assert.equal(write.data.guestHash, null);
  assert.equal(write.data.guestExpiresAt, null);
});
test('a foreign cursor cannot escape account ownership scope', async () => {
  const { service, seen } = fixture('account-a');
  await assert.rejects(
    service.list(request('waffarly_customer_session=session'), 'foreign-cursor'),
    NotFoundException,
  );
  const query = seen[0] as { where: { AND: unknown[] } };
  assert.deepEqual(query.where.AND, [
    { OR: [{ accountId: 'account-a' }] },
    { orderId: 'foreign-cursor' },
  ]);
});
