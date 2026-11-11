import data from '@/features/marketplace/data/reference.json';
import merchantScenarios from '@/features/marketplace/data/merchant-detail-scenarios.json';

type ReferenceProduct = (typeof data.products)[number];
type ProductRecord = Omit<ReferenceProduct, 'id' | 'category'> & {
  id: string;
  category: string;
};
type MerchantScenarioProduct = ProductRecord & {
  merchantName: string;
  merchantType: 'store' | 'restaurant';
  origin: 'local-mock';
};

export type MarketplaceProduct = ProductRecord & Partial<MerchantScenarioProduct>;

export const merchantScenarioProducts: MerchantScenarioProduct[] = [
  ...merchantScenarios.storeProducts.map((product) => ({
    ...product,
    merchantType: 'store' as const,
    origin: 'local-mock' as const,
  })),
  ...merchantScenarios.restaurantProducts.map((product) => ({
    ...product,
    merchantType: 'restaurant' as const,
    origin: 'local-mock' as const,
  })),
];

const allProducts: MarketplaceProduct[] = [...data.products, ...merchantScenarioProducts];

export function findProduct(id: string) {
  return allProducts.find((product) => product.id === id);
}
export function filterProducts(category: string, term: string) {
  return data.products.filter(
    (p) => (category === 'all' || p.category === category) && p.searchName.includes(term.trim()),
  );
}
