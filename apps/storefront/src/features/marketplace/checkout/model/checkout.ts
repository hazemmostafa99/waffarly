import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import type { MealSelection } from '@/features/marketplace/restaurants/model/meal-options';

export type Fulfillment = 'delivery' | 'pickup';
export interface CheckoutDraft {
  name: string;
  phone: string;
  fulfillment: Fulfillment;
  address: string;
}
export type CheckoutErrors = Partial<Record<'name' | 'phone' | 'address', string>>;
export type CheckoutItem = MarketplaceProduct & {
  quantity: number;
  lineId?: string;
  selection?: MealSelection;
  optionsLabel?: string;
};
export const EMPTY_CHECKOUT: CheckoutDraft = {
  name: '',
  phone: '',
  fulfillment: 'delivery',
  address: '',
};

export function validateCheckout(draft: CheckoutDraft, demo = true): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (draft.name.trim().length < 2)
    errors.name = demo
      ? 'اكتب اسمًا تجريبيًا من حرفين على الأقل.'
      : 'اكتب اسمًا من حرفين على الأقل.';
  const digits = draft.phone.replace(/\D/g, '');
  if (!/^[+\d\s()-]+$/.test(draft.phone.trim()) || digits.length < 7 || digits.length > 15) {
    errors.phone = demo
      ? 'اكتب رقمًا تجريبيًا من 7 إلى 15 رقمًا، ويمكن استخدام + والمسافات.'
      : 'اكتب رقم موبايل من 7 إلى 15 رقمًا، ويمكن استخدام + والمسافات.';
  }
  if (draft.fulfillment === 'delivery' && draft.address.trim().length < 8) {
    errors.address = demo
      ? 'اكتب عنوانًا تجريبيًا واضحًا من 8 حروف على الأقل.'
      : 'اكتب عنوانًا واضحًا من 8 حروف على الأقل.';
  }
  return errors;
}
