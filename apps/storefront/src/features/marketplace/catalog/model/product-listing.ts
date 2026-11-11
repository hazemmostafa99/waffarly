import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import {
  parseCategoryId,
  productCategory,
  type CategoryId,
} from '@/features/marketplace/search/model/search-state';

export type ProductSort =
  | 'recommended'
  | 'price-ascending'
  | 'price-descending'
  | 'discount-descending';

export interface ProductListingState {
  category: CategoryId;
  term: string;
  sort: ProductSort;
  page: number;
}

const validSorts: ProductSort[] = [
  'recommended',
  'price-ascending',
  'price-descending',
  'discount-descending',
];

export function parseProductListingState(params: Pick<URLSearchParams, 'get'>): ProductListingState {
  const requestedSort = params.get('sort') as ProductSort | null;
  const requestedPage = Number.parseInt(params.get('page') ?? '', 10);

  return {
    category: parseCategoryId(params.get('category')),
    term: (params.get('q') ?? '').trim(),
    sort: requestedSort && validSorts.includes(requestedSort) ? requestedSort : 'recommended',
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function filterAndSortProducts(
  products: MarketplaceProduct[],
  state: Pick<ProductListingState, 'category' | 'term' | 'sort'>,
) {
  const category = productCategory(state.category);
  const matching = products.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      product.searchName.includes(state.term.trim()),
  );

  if (state.sort === 'recommended') return matching;

  return [...matching].sort((left, right) => {
    if (state.sort === 'price-ascending') return left.price - right.price;
    if (state.sort === 'price-descending') return right.price - left.price;

    const leftOldPrice = Number(left.oldPrice?.replace(/,/g, ''));
    const rightOldPrice = Number(right.oldPrice?.replace(/,/g, ''));
    const leftDiscount = leftOldPrice > 0 ? (leftOldPrice - left.price) / leftOldPrice : 0;
    const rightDiscount = rightOldPrice > 0 ? (rightOldPrice - right.price) / rightOldPrice : 0;
    return rightDiscount - leftDiscount;
  });
}

export function paginateProducts<T>(items: T[], requestedPage: number, pageSize = 4) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
  };
}

export function productListingHref(
  pathname: string,
  currentParams: string,
  state: ProductListingState,
) {
  const params = new URLSearchParams(currentParams);
  for (const key of ['category', 'q', 'sort', 'page']) params.delete(key);

  if (state.category !== 'all') params.set('category', state.category);
  if (state.term.trim()) params.set('q', state.term.trim());
  if (state.sort !== 'recommended') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}
