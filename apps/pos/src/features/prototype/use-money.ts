import { useLocale } from '@waffarly/ui';

export function useMoney() {
  const { formatNumber } = useLocale();
  return (cents: number) =>
    formatNumber(cents / 100, { style: 'currency', currency: 'EGP', minimumFractionDigits: 2 });
}
