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
