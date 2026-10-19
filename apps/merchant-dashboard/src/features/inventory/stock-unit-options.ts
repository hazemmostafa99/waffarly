import type { StockItem } from '@waffarly/contracts';

const standardUnits = {
  piece: ['piece'],
  g: ['g', 'kg'],
  kg: ['g', 'kg'],
  ml: ['ml', 'l'],
  l: ['ml', 'l'],
} as const;

export function stockUnitOptions(
  item: StockItem | undefined,
): Array<{ code: string; name: string }> {
  if (!item) return [];
  return [
    ...standardUnits[item.baseUnit].map((code) => ({ code, name: code })),
    ...item.units.map(({ code, name }) => ({ code, name })),
  ];
}

export function cacheStockItem(items: StockItem[], item: StockItem): StockItem[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

export function stockUnitLabel(code: string, locale: string, fallback = code): string {
  const labels: Record<string, [string, string]> = {
    piece: ['piece', 'قطعة'],
    g: ['gram', 'جرام'],
    kg: ['kilogram', 'كيلوجرام'],
    ml: ['millilitre', 'ملليلتر'],
    l: ['litre', 'لتر'],
  };
  return labels[code]?.[locale === 'ar' ? 1 : 0] ?? fallback;
}
