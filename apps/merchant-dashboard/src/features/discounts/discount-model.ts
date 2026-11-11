import type { MerchantDiscount, MerchantDiscountInput } from '@waffarly/contracts';
export type { MerchantDiscountInput };
export type Discount = MerchantDiscount & { icon: string; tone: 'pink' | 'orange' | 'blue' | 'green' | 'purple' };

export function presentation(discount: MerchantDiscount): Discount {
  const icons = { percentage: 'percent', fixed: 'ticket' };
  const tones: Discount['tone'][] = ['pink', 'orange', 'blue', 'purple', 'green'];
  const tone = tones[[...discount.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length]!;
  return { ...discount, icon: icons[discount.type], tone };
}

export function cairoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}

export function emptyDiscount(): MerchantDiscountInput {
  return { name: '', description: '', code: '', type: 'percentage', value: '', minimum: '0', maximum: '', startDate: cairoDate(), endDate: '', usageLimit: '', branches: [], terms: '', state: 'published' };
}

export function validateDiscount(draft: MerchantDiscountInput, discounts: MerchantDiscount[], id?: string): string | null {
  if (!draft.name.trim()) return 'Enter a discount name.';
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(draft.code.trim().toUpperCase())) return 'Use 3–32 letters, numbers, hyphens or underscores for the code.';
  if (discounts.some((discount) => discount.id !== id && discount.code.toUpperCase() === draft.code.trim().toUpperCase())) return 'This discount code already exists.';
  const money = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
  if (!money.test(draft.value) || Number(draft.value) <= 0 || (draft.type === 'percentage' && Number(draft.value) > 100)) return 'Enter a valid value; percentages must be between 0 and 100.';
  if (!money.test(draft.minimum)) return 'Enter a valid minimum order amount.';
  if (draft.type === 'percentage' && draft.maximum !== '' && (!money.test(draft.maximum) || Number(draft.maximum) <= 0)) return 'Enter a valid maximum discount amount.';
  if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) return 'Choose an end date on or after the start date.';
  if (draft.usageLimit !== '' && (!/^[1-9]\d{0,8}$/.test(draft.usageLimit) || Number(draft.usageLimit) < (discounts.find((discount) => discount.id === id)?.redemptions ?? 0))) return 'Usage limit must be a positive whole number at least equal to existing redemptions.';
  return null;
}
