import type { ApiValidationIssue } from '../../lib/api-client.js';

export const customerFields = ['customerName', 'customerPhone', 'deliveryAddress'] as const;
export type CustomerField = (typeof customerFields)[number];
export type CustomerErrors = Partial<Record<CustomerField, string>>;

export function validateDeliveryDetails(
  input: Partial<Record<CustomerField, string>>,
): CustomerErrors {
  const errors: CustomerErrors = {};
  const name = input.customerName?.trim() ?? '';
  const phone = input.customerPhone?.trim() ?? '';
  const address = input.deliveryAddress?.trim() ?? '';
  if (name.length < 2 || name.length > 120)
    errors.customerName = 'Enter a customer name between 2 and 120 characters.';
  if (phone.length > 32 || !/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7)
    errors.customerPhone = 'Enter a phone number with at least 7 digits (up to 32 characters).';
  if (address.length < 8 || address.length > 1000)
    errors.deliveryAddress = 'Enter a delivery address between 8 and 1000 characters.';
  return errors;
}

export function customerErrorsFromIssues(issues: ApiValidationIssue[]): CustomerErrors {
  const errors: CustomerErrors = {};
  for (const field of customerFields) {
    if (issues.some((issue) => issue.path.length === 1 && issue.path[0] === field)) {
      // Use actionable, translated copy instead of Zod internals or duplicate phone errors.
      errors[field] = {
        customerName: 'Enter a customer name between 2 and 120 characters.',
        customerPhone: 'Enter a phone number with at least 7 digits (up to 32 characters).',
        deliveryAddress: 'Enter a delivery address between 8 and 1000 characters.',
      }[field];
    }
  }
  return errors;
}
