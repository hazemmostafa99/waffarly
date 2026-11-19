import type {
  CursorPage,
  CustomerOrderSummary,
  CustomerSignInRequest,
  CustomerSignUpRequest,
  StorefrontCustomerProfile,
  StorefrontCustomerAddress,
  CreateStorefrontCustomerAddressRequest,
  DeleteStorefrontCustomerAddressRequest,
  UpdateStorefrontCustomerAddressRequest,
  UpdateStorefrontCustomerProfileRequest,
} from '@waffarly/contracts';
import { ApiError } from '@/lib/api-client';

export const storefrontCustomerSessionKey = (slug: string) =>
  ['storefront-customer-session', slug] as const;
export const storefrontCustomerOrdersKey = (slug: string, customerId?: string) =>
  ['storefront-customer-orders', slug, customerId ?? 'signed-out'] as const;
export const storefrontCustomerAddressesKey = (slug: string, customerId?: string) =>
  ['storefront-customer-addresses', slug, customerId ?? 'signed-out'] as const;

async function request<T>(
  slug: string,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    `/storefront-api/auth/stores/${encodeURIComponent(slug)}/customer/${path}`,
    {
      method,
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? 'Store customer request failed.');
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function loadStorefrontCustomer(
  slug: string,
): Promise<StorefrontCustomerProfile | null> {
  try {
    return await request<StorefrontCustomerProfile>(slug, 'me');
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) return null;
    throw error;
  }
}

export function isStorefrontCustomerServiceUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.statusCode === 404 || error.statusCode >= 500);
}

export function isStorefrontCustomerNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export const signInStorefrontCustomer = (slug: string, data: CustomerSignInRequest) =>
  request<StorefrontCustomerProfile>(slug, 'login', 'POST', data);
export const signUpStorefrontCustomer = (slug: string, data: CustomerSignUpRequest) =>
  request<StorefrontCustomerProfile>(slug, 'sign-up', 'POST', data);
export const signOutStorefrontCustomer = (slug: string) =>
  request<{ authenticated: false }>(slug, 'logout', 'POST', {});

export function updateStorefrontCustomerProfile(
  slug: string,
  data: UpdateStorefrontCustomerProfileRequest,
) {
  return request<StorefrontCustomerProfile>(slug, 'profile', 'PATCH', data);
}

export function loadStorefrontCustomerAddresses(slug: string) {
  return request<StorefrontCustomerAddress[]>(slug, 'addresses');
}

export function createStorefrontCustomerAddress(
  slug: string,
  data: CreateStorefrontCustomerAddressRequest,
) {
  return request<StorefrontCustomerAddress>(slug, 'addresses', 'POST', data);
}

export function updateStorefrontCustomerAddress(
  slug: string,
  id: string,
  data: UpdateStorefrontCustomerAddressRequest,
) {
  return request<StorefrontCustomerAddress>(
    slug,
    `addresses/${encodeURIComponent(id)}`,
    'PATCH',
    data,
  );
}

export function deleteStorefrontCustomerAddress(
  slug: string,
  id: string,
  data: DeleteStorefrontCustomerAddressRequest,
) {
  return request<{ deleted: true }>(slug, `addresses/${encodeURIComponent(id)}`, 'DELETE', data);
}

export function loadStorefrontCustomerOrders(slug: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return fetch(
    `/storefront-api/catalog/stores/${encodeURIComponent(slug)}/customer/orders${query}`,
    { credentials: 'include', cache: 'no-store' },
  ).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const message = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message ?? 'Customer orders could not be loaded.');
      throw new ApiError(message, response.status);
    }
    return response.json() as Promise<CursorPage<CustomerOrderSummary>>;
  });
}
