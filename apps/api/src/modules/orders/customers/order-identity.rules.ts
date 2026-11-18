/**
 * Recognizes a browser guest and describes which orders belong to an account or an unexpired guest.
 */
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import type { Prisma } from '@waffarly/database';

export type OrderIdentity = { accountId: string } | { guestHash: string; guestExpiresAt: Date };
export const guestOrderCookieName = 'waffarly_guest_orders';
export const guestOrderLifetimeMs = 30 * 24 * 60 * 60 * 1000;
export function readOrderCookie(request: Request, name: string) {
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + '='))
    ?.slice(name.length + 1);
}
export const hashGuestOrderToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function orderIdentityWhere(identity: OrderIdentity): Prisma.CustomerOrderAccessWhereInput {
  return 'accountId' in identity
    ? { accountId: identity.accountId }
    : { accountId: null, guestHash: identity.guestHash, guestExpiresAt: { gt: new Date() } };
}
