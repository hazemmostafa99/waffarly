import type { SubmitMerchantApplicationRequest } from '@waffarly/contracts';
import { apiPost } from '@/lib/api-client';

export async function submitMerchantApplication(input: SubmitMerchantApplicationRequest) {
  const result = await apiPost<{ received: true }>('merchant-applications', input);
  if (result.received !== true) throw new Error('Application receipt was not confirmed.');
}
