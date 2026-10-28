/** Keep Western digits while localizing the currency label and reading direction. */
export function formatSubscriptionMoney(amount: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
