import { PrismaClient, createPostgresAdapter } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { it } from 'node:test';
import { CustomerAuthService } from '../../src/modules/auth/customer-auth.service.js';
import { verifyPassword } from '../../src/modules/auth/password.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const url = process.env.DATABASE_URL;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

it(
  'customer password persistence, isolated sessions, rotation, expiration and durable limits',
  { skip: !url },
  async () => {
    const prisma = new PrismaClient({ adapter: createPostgresAdapter(url!) });
    const tag = randomUUID();
    const ip = `fixture-${tag}`;
    const email = `${tag}@example.invalid`;
    const phone = `+999${randomInt(100000000, 999999999)}`;
    const request = (token?: string) =>
      ({ ip, headers: token ? { cookie: `waffarly_customer_session=${token}` } : {} }) as Request;
    let cookie = '';
    let cleared = '';
    const response = {
      cookie(name: string, value: string, options: Record<string, unknown>) {
        assert.equal(name, 'waffarly_customer_session');
        assert.equal(options.httpOnly, true);
        assert.equal(options.sameSite, 'lax');
        assert.equal(options.secure, true);
        cookie = value;
      },
      clearCookie(name: string) {
        cleared = name;
      },
    } as unknown as Response;
    const service = new CustomerAuthService(prisma as never, { isProduction: true } as never);
    let accountId: string | undefined;
    const limitKeys = [
      `signup:ip:${ip}`,
      `login:ip:${ip}`,
      `login:identifier:${email}`,
      `login:identifier:${phone}`,
    ].map(digest);
    try {
      const account = await service.signUp(
        { name: 'Auth fixture', email, phone, password: 'fixture-password' },
        request(),
        response,
      );
      accountId = account.id;
      assert.equal(account.phoneVerified, false);
      assert.equal(account.emailVerified, false);
      assert.equal('passwordHash' in account, false);
      const saved = await prisma.customerAccount.findUniqueOrThrow({ where: { id: account.id } });
      assert.equal(saved.phoneVerifiedAt, null);
      assert.equal(saved.emailVerifiedAt, null);
      assert.ok(await verifyPassword('fixture-password', saved.passwordHash!));
      assert.notEqual(saved.passwordHash, 'fixture-password');
      const firstToken = cookie;
      const firstSession = await prisma.authSession.findUniqueOrThrow({
        where: { tokenHash: digest(cookie) },
      });
      assert.equal(firstSession.subjectKind, 'CUSTOMER');
      assert.equal(await prisma.authSession.count({ where: { tokenHash: cookie } }), 0);
      assert.equal((await service.me(request(cookie))).id, account.id);
      await assert.rejects(service.me(request()), /Sign in is required/);
      await assert.rejects(
        service.signIn({ identifier: email, password: 'incorrect' }, request(), response),
        /Invalid credentials/,
      );
      await assert.rejects(
        service.signUp(
          { name: 'Duplicate', email, phone, password: 'another-password' },
          request(),
          response,
        ),
        /already uses/,
      );
      await service.signIn(
        { identifier: email.toUpperCase(), password: 'fixture-password' },
        request(cookie),
        response,
      );
      assert.notEqual(cookie, firstToken);
      await assert.rejects(service.me(request(firstToken)), /expired/);
      await service.signIn(
        { identifier: phone, password: 'fixture-password' },
        request(cookie),
        response,
      );
      await prisma.authSession.update({
        where: { tokenHash: digest(cookie) },
        data: { subjectKind: 'OWNER' },
      });
      await assert.rejects(service.me(request(cookie)), /expired/);
      await service.logout(request(cookie), response);
      // Customer logout must not revoke another actor's session, even with its token in this cookie.
      assert.equal(await prisma.authSession.count({ where: { tokenHash: digest(cookie) } }), 1);
      await prisma.authSession.update({
        where: { tokenHash: digest(cookie) },
        data: { subjectKind: 'CUSTOMER', expiresAt: new Date(0) },
      });
      await assert.rejects(service.me(request(cookie)), /expired/);
      await service.logout(request(cookie), response);
      assert.equal(cleared, 'waffarly_customer_session');
      assert.equal(await prisma.authSession.count({ where: { tokenHash: digest(cookie) } }), 0);
      // A fresh service instance shares the database-backed attempt budget.
      await prisma.customerAuthLimit.update({
        where: { key: digest(`login:identifier:${email}`) },
        data: { attempts: 20 },
      });
      const second = new CustomerAuthService(prisma as never, { isProduction: true } as never);
      await assert.rejects(
        second.signIn({ identifier: email, password: 'fixture-password' }, request(), response),
        /Too many attempts/,
      );
      await prisma.customerAuthLimit.update({
        where: { key: digest(`login:identifier:${email}`) },
        data: { expiresAt: new Date(0) },
      });
      await second.signIn({ identifier: email, password: 'fixture-password' }, request(), response);
      assert.equal(
        (
          await prisma.customerAuthLimit.findUniqueOrThrow({
            where: { key: digest(`login:identifier:${email}`) },
          })
        ).attempts,
        1,
      );
    } finally {
      if (accountId) {
        await prisma.authSession.deleteMany({ where: { subjectId: accountId } });
        await prisma.customerAccount.delete({ where: { id: accountId } });
      }
      await prisma.customerAuthLimit.deleteMany({ where: { key: { in: limitKeys } } });
      await prisma.$disconnect();
    }
  },
);
