import data from '@/features/marketplace/data/reference.json';

export type MarketplaceProduct = (typeof data.products)[number];
export function findProduct(id: string) {
  return data.products.find((product) => product.id === id);
}
export function filterProducts(category: string, term: string) {
  return data.products.filter(
    (p) => (category === 'all' || p.category === category) && p.searchName.includes(term.trim()),
  );
}
