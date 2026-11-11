import type {
  CustomerProfile,
  CustomerSignInRequest,
  CustomerSignUpRequest,
} from '@waffarly/contracts';
import { ApiError, apiBaseUrl } from '@/lib/api-client';

export const customerSessionKey = ['customer-auth-session'] as const;

async function customerRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    new URL(`auth/customer/${path}`, `${apiBaseUrl().replace(/\/$/, '')}/`),
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) throw new ApiError('Customer authentication failed.', response.status);
  return response.json() as Promise<T>;
}

export async function loadCustomer(): Promise<CustomerProfile | null> {
  try {
    return await customerRequest<CustomerProfile>('me');
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) return null;
    throw error;
  }
}

export const signInCustomer = (data: CustomerSignInRequest) =>
  customerRequest<CustomerProfile>('login', data);
export const signUpCustomer = (data: CustomerSignUpRequest) =>
  customerRequest<CustomerProfile>('sign-up', data);
export const signOutCustomer = () => customerRequest<{ authenticated: false }>('logout', {});

export function customerAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return 'البريد أو الموبايل أو كلمة المرور غير صحيحة.';
    if (error.statusCode === 409) return 'يوجد حساب بهذه البيانات بالفعل. جرّب تسجيل الدخول.';
    if (error.statusCode === 429) return 'محاولات كتير في وقت قصير. جرّب مرة تانية لاحقًا.';
    if (error.statusCode === 400)
      return 'راجع البيانات: بريد صحيح، وموبايل مصري أو بصيغة دولية، وكلمة مرور من 8 إلى 128 حرفًا.';
  }
  return 'تعذّر الاتصال بخدمة الحسابات. حاول مرة أخرى.';
}
