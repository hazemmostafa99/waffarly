/**
 * Recognizes the signed-in customer or this browser guest so each can see their own orders.
 */
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@waffarly/database';
import type { CustomerProfile } from '@waffarly/contracts';
import { CustomerAuthService } from '../../auth/index.js';

import { AppConfiguration } from '../../../config/app-configuration.js';

import {
  type OrderIdentity,
  orderIdentityWhere,
  readOrderCookie,
  guestOrderCookieName,
  guestOrderLifetimeMs,
  hashGuestOrderToken,
} from './order-identity.rules.js';

export class CustomerOrderSession {
  private readonly accounts = new WeakMap<Request, Promise<CustomerProfile | null>>();
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly config: AppConfiguration,
  ) {}
  resolveAccount(request: Request): Promise<CustomerProfile | null> {
    const cached = this.accounts.get(request);
    if (cached) return cached;
    const result = readOrderCookie(request, 'waffarly_customer_session')
      ? this.auth.me(request)
      : Promise.resolve(null);
    this.accounts.set(request, result);
    return result;
  }
  readGuestIdentity(request: Request): OrderIdentity | null {
    const token = readOrderCookie(request, guestOrderCookieName);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? {
          guestHash: hashGuestOrderToken(token),
          guestExpiresAt: new Date(Date.now() + guestOrderLifetimeMs),
        }
      : null;
  }
  async prepareOrderSession(request: Request, response: Response) {
    const account = await this.resolveAccount(request);
    // Re-send the existing guest token (or a new one) on every checkout review. Each order is
    // followable for 30 days, so the browser cookie must also restart its 30 days; otherwise a
    // cookie from an older order would expire before the newest order's tracking period ends.
    const token = this.readGuestIdentity(request)
      ? readOrderCookie(request, guestOrderCookieName)!
      : randomBytes(32).toString('base64url');
    response.cookie(guestOrderCookieName, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: guestOrderLifetimeMs,
    });
    return { signedIn: account !== null, guestLifetimeDays: 30 };
  }
  async resolveOrderIdentity(request: Request): Promise<OrderIdentity> {
    const account = await this.resolveAccount(request);
    if (account) return { accountId: account.id };
    const guest = this.readGuestIdentity(request);
    if (!guest)
      throw new UnauthorizedException('Review checkout again to prepare secure order access.');
    return guest;
  }
  async buildOrderAccessScope(request: Request): Promise<Prisma.CustomerOrderAccessWhereInput> {
    const account = await this.resolveAccount(request);
    const guest = this.readGuestIdentity(request);
    const choices: Prisma.CustomerOrderAccessWhereInput[] = [];
    if (account) choices.push({ accountId: account.id });
    if (guest) choices.push(orderIdentityWhere(guest));
    return choices.length ? { OR: choices } : { orderId: { in: [] } };
  }
}
