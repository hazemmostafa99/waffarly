import type { MarketplaceProduct } from './catalog';

export type Fulfillment = 'delivery' | 'pickup';
export interface CheckoutDraft {
  name: string;
  phone: string;
  fulfillment: Fulfillment;
  address: string;
}
export type CheckoutErrors = Partial<Record<'name' | 'phone' | 'address', string>>;
export type CheckoutItem = MarketplaceProduct & { quantity: number };
export interface DemoReceipt {
  items: CheckoutItem[];
  fulfillment: Fulfillment;
}
export const EMPTY_CHECKOUT: CheckoutDraft = { name: '', phone: '', fulfillment: 'delivery', address: '' };

export function validateCheckout(draft: CheckoutDraft): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (draft.name.trim().length < 2) errors.name = 'اكتب اسمًا تجريبيًا من حرفين على الأقل.';
  const digits = draft.phone.replace(/\D/g, '');
  if (!/^[+\d\s()-]+$/.test(draft.phone.trim()) || digits.length < 7 || digits.length > 15) {
    errors.phone = 'اكتب رقمًا تجريبيًا من 7 إلى 15 رقمًا، ويمكن استخدام + والمسافات.';
  }
  if (draft.fulfillment === 'delivery' && draft.address.trim().length < 8) {
    errors.address = 'اكتب عنوانًا تجريبيًا واضحًا من 8 حروف على الأقل.';
  }
  return errors;
}
