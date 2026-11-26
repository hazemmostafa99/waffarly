/**
 * Recognizes a shopper who orders from a merchant website without signing in, using a
 * browser cookie kept apart from the Marketplace guest cookie so the two order lists never mix.
 */
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

import {
  type OrderIdentity,
  guestOrderLifetimeMs,
  hashGuestOrderToken,
  readOrderCookie,
} from './order-identity.rules.js';

export const storefrontGuestOrderCookieName = 'waffarly_store_guest_orders';

/** Returns this browser's guest identity, or null when it has no valid guest cookie. */
export function readStorefrontGuest(request: Request): OrderIdentity | null {
  const token = readOrderCookie(request, storefrontGuestOrderCookieName);
  // A token is 32 random bytes written as base64url: exactly 43 letters, digits, "_" or "-".
  // Example: "q3Zb...-_x" (43 characters) is accepted; "abc" or a value with "=" is ignored.
  return token && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? {
        guestHash: hashGuestOrderToken(token),
        guestExpiresAt: new Date(Date.now() + guestOrderLifetimeMs),
      }
    : null;
}

/**
 * Keeps (or starts) this browser's guest cookie and returns its identity. Sending it again on
 * every checkout restarts its 30 days, so the newest order stays followable for its full period.
 */
export function keepStorefrontGuest(
  request: Request,
  response: Response,
  secure: boolean,
): OrderIdentity {
  const token =
    (readStorefrontGuest(request) && readOrderCookie(request, storefrontGuestOrderCookieName)) ||
    randomBytes(32).toString('base64url');
  response.cookie(storefrontGuestOrderCookieName, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: guestOrderLifetimeMs,
  });
  return {
    guestHash: hashGuestOrderToken(token),
    guestExpiresAt: new Date(Date.now() + guestOrderLifetimeMs),
  };
}
