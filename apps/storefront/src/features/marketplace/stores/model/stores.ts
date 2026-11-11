import data from '@/features/marketplace/data/reference.json';
import {
  merchantScenarioProducts,
  type MarketplaceProduct,
} from '@/features/marketplace/catalog/model/catalog';

export type MarketplaceStore = (typeof data.stores)[number];

function decodeStoreId(storeId: string) {
  try {
    return decodeURIComponent(storeId);
  } catch {
    return storeId;
  }
}

export function findStore(storeId: string) {
  const name = decodeStoreId(storeId);
  return data.stores.find((store) => store.name === name);
}

export function storeHref(store: Pick<MarketplaceStore, 'name'>) {
  return `/stores/${encodeURIComponent(store.name)}`;
}

export function productsForStore(store: Pick<MarketplaceStore, 'name'>): MarketplaceProduct[] {
  return [
    ...data.products.filter(
      (product) => product.seller.replace(/^✓\s*/u, '').trim() === store.name,
    ),
    ...merchantScenarioProducts.filter(
      (product) => product.merchantType === 'store' && product.merchantName === store.name,
    ),
  ];
}
