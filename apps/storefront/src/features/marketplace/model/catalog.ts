import data from '../data/reference.json';

export type MarketplaceProduct = (typeof data.products)[number];
export function filterProducts(category: string, term: string) {
  return data.products.filter(
    (p) => (category === 'all' || p.category === category) && p.searchName.includes(term.trim()),
  );
}
export function cartProducts(ids: string[]) {
  return ids.flatMap((id) => {
    const product = data.products.find((p) => p.id === id);
    return product ? [product] : [];
  });
}
export const money = (value: number) => new Intl.NumberFormat('ar-EG').format(value) + ' ج.م';
