export const RESERVED_STOREFRONT_HANDLES = [
  'admin',
  'pos',
  'api',
  'www',
  'dashboard',
  'merchant',
  'marketplace',
  'business',
  'auth',
  'login',
  'support',
  'mail',
  'assets',
  'static',
  'cdn',
] as const;

export function isStorefrontHandle(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !(RESERVED_STOREFRONT_HANDLES as readonly string[]).includes(value)
  );
}

export interface AssignStorefrontHandleRequest {
  handle: string;
}
export interface PublicStorefrontAddress {
  handle: string;
  storefrontSlug: string;
}

/** The name a cashier types to sign in to POS, e.g. ("ahmed-cafe", "ali") -> "ahmed-cafe.ali". */
export function formatPosSignInName(storefrontHandle: string, username: string): string {
  return `${storefrontHandle}.${username}`;
}

/**
 * Splits a POS sign-in name at its first dot. Subdomains never contain dots, so the rest is
 * the username even when it has dots: "ahmed-cafe.ali.m" -> { "ahmed-cafe", "ali.m" }.
 * Returns null when either part is missing, e.g. "ali" or "ahmed-cafe.".
 */
export function parsePosSignInName(
  login: string,
): { storefrontHandle: string; username: string } | null {
  const value = login.trim().toLowerCase();
  const dot = value.indexOf('.');
  if (dot <= 0 || dot === value.length - 1) return null;
  return { storefrontHandle: value.slice(0, dot), username: value.slice(dot + 1) };
}
