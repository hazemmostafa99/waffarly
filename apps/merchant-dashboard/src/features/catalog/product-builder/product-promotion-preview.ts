export function productPreviewPrice(
  basePrice: string,
  enabled: boolean,
  type: 'percentage' | 'amount',
  value: string,
): number | null {
  if (!enabled || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(basePrice)) return null;
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0) return null;
  const cents = (amount: string) => {
    const [whole = '0', fraction = ''] = amount.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  };
  const baseCents = cents(basePrice);
  const valueCents = cents(value);
  const discountCents =
    type === 'amount' ? valueCents : Math.floor((baseCents * valueCents + 5_000) / 10_000);
  return discountCents >= baseCents ? null : (baseCents - discountCents) / 100;
}
