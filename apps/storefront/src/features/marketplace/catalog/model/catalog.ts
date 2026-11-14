import type { PublicRestaurantProfile, PublicStorefrontProduct } from '@waffarly/contracts';
import data from '@/features/marketplace/data/reference.json';
import merchantScenarios from '@/features/marketplace/data/merchant-detail-scenarios.json';
import { restaurantScenarioProducts } from '@/features/marketplace/data/restaurant-scenarios';

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

export type MarketplaceProduct = ProductRecord &
  Partial<Omit<MerchantScenarioProduct, 'origin'>> & {
    origin?: 'local-mock' | 'api';
    restaurantSlug?: string;
    restaurantSettings?: PublicRestaurantProfile;
    apiVariants?: PublicStorefrontProduct['variants'];
    apiModifierGroups?: PublicStorefrontProduct['modifierGroups'];
    menuSection?: string;
    available?: boolean;
    description?: string;
  };

export const merchantScenarioProducts: (MerchantScenarioProduct & {
  menuSection?: string;
  available?: boolean;
  description?: string;
})[] = [
  ...merchantScenarios.storeProducts.map((product) => ({
    ...product,
    merchantType: 'store' as const,
    origin: 'local-mock' as const,
  })),
  ...restaurantScenarioProducts,
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
