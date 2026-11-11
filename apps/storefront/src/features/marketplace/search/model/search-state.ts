import data from '@/features/marketplace/data/reference.json';

const categoryIds = [
  'all',
  'mobiles',
  'electronics',
  'fashion',
  'home',
  'food',
  'grocery',
  'beauty',
] as const;
export type CategoryId = (typeof categoryIds)[number];
export interface MarketplaceSearchState {
  category: CategoryId;
  term: string;
}

export function parseCategoryId(value: string | null): CategoryId {
  return categoryIds.find((id) => id === value) ?? 'all';
}

// Stable local UI identifiers. Mobiles/electronics share the reference's product category.
export const marketplaceCategories = data.categories.map((category, index) => ({
  ...category,
  id: categoryIds[index]!,
}));

export function parseMarketplaceSearch(
  params: Pick<URLSearchParams, 'get'>,
): MarketplaceSearchState {
  const category = params.get('category');
  return {
    category: parseCategoryId(category),
    term: (params.get('q') ?? '').trim(),
  };
}

export function productCategory(id: CategoryId): string {
  return marketplaceCategories.find((category) => category.id === id)?.category ?? 'all';
}

export function marketplaceSearchHref(
  pathname: string,
  currentParams: string,
  state: MarketplaceSearchState,
  section = 'deals',
): string {
  const params = new URLSearchParams(currentParams);
  params.delete('category');
  params.delete('q');
  if (state.category !== 'all') params.set('category', state.category);
  if (state.term.trim()) params.set('q', state.term.trim());
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}#${section}`;
}
