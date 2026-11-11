import assert from 'node:assert/strict';
import {
  productHref,
  productBackHref,
} from '@/features/marketplace/product-detail/model/product-navigation';
import { productRecommendations } from '@/features/marketplace/product-detail/model/product-recommendations';

test('recommendations exclude the current product, prioritize real category matches and avoid duplicates', () => {
  const phone = findProduct('1')!;
  const recommendations = productRecommendations(phone);
  assert.equal(recommendations.length, 4);
  assert.equal(recommendations[0]?.id, '0');
  assert.ok(recommendations.every((item) => item.id !== phone.id));
  assert.equal(new Set(recommendations.map((item) => item.id)).size, recommendations.length);
  assert.equal(productRecommendations(phone, 1)[0]?.category, phone.category);
  assert.deepEqual(productRecommendations(phone, 0), []);
  const fragrance = findProduct('4')!;
  assert.ok(
    productRecommendations(fragrance).every((item) => item.category !== fragrance.category),
  );
});
import { test } from 'node:test';
import { createMarketplaceStore } from '@/features/marketplace/state/create-marketplace-store';
import { cartProducts, cartTotal, cartQuantity } from '@/features/marketplace/cart/model/cart';
import { filterProducts, findProduct } from '@/features/marketplace/catalog/model/catalog';
import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
  productCategory,
} from '@/features/marketplace/search/model/search-state';

test('URL parsing normalizes defaults, invalid categories and Arabic query whitespace', () => {
  assert.deepEqual(parseMarketplaceSearch(new URLSearchParams()), { category: 'all', term: '' });
  assert.deepEqual(parseMarketplaceSearch(new URLSearchParams('category=invalid&q=++')), {
    category: 'all',
    term: '',
  });
  const query = new URLSearchParams({ category: 'mobiles', q: '  هاتف  ' });
  assert.deepEqual(parseMarketplaceSearch(query), { category: 'mobiles', term: 'هاتف' });
  assert.equal(productCategory('mobiles'), 'electronics');
  assert.equal(productCategory('electronics'), 'electronics');
});

test('search URLs round-trip Arabic, preserve unrelated params and reset owned params', () => {
  const href = marketplaceSearchHref('/marketplace', 'campaign=local&q=old&category=home', {
    category: 'electronics',
    term: '  سماعة  ',
  });
  const url = new URL(href, 'http://localhost');
  assert.equal(url.searchParams.get('campaign'), 'local');
  assert.equal(url.hash, '#deals');
  assert.deepEqual(parseMarketplaceSearch(url.searchParams), {
    category: 'electronics',
    term: 'سماعة',
  });
  assert.equal(
    marketplaceSearchHref(
      '/marketplace',
      url.search,
      { category: 'all', term: '' },
      'marketplace-main',
    ),
    '/marketplace?campaign=local#marketplace-main',
  );
});

test('independent history URLs restore previous and next filter results without draft state', () => {
  const searches = [
    '/marketplace',
    marketplaceSearchHref('/marketplace', '', { category: 'mobiles', term: 'هاتف' }),
    marketplaceSearchHref('/marketplace', '', { category: 'fashion', term: '' }),
  ];
  const results = [1, 2, 1, 0].map((index) => {
    const state = parseMarketplaceSearch(
      new URL(searches[index]!, 'http://localhost').searchParams,
    );
    return filterProducts(productCategory(state.category), state.term).map((p) => p.cartName);
  });
  assert.equal(results[0]?.length, 1);
  assert.deepEqual(results[0], results[2]);
  assert.equal(results[1]?.length, 1);
  assert.equal(results[3]?.length, 5);
});

test('search combines source category and trimmed Arabic data-name, including empty results', () => {
  assert.equal(filterProducts('all', '').length, 5);
  assert.equal(filterProducts('electronics', '').length, 2);
  assert.equal(filterProducts('all', '  سماعة  ')[0]?.price, 1299);
  assert.equal(filterProducts('fashion', 'سماعة').length, 0);
  assert.equal(filterProducts('food', '').length, 0);
});

test('cart merges quantities, derives counts/totals, updates and removes by product identity', () => {
  const store = createMarketplaceStore();
  const other = createMarketplaceStore();
  assert.equal(store.getState().addToCart('0', 2), true);
  store.getState().addToCart('1');
  store.getState().addToCart('0', 3);
  assert.deepEqual(store.getState().cart, [
    { productId: '0', quantity: 5 },
    { productId: '1', quantity: 1 },
  ]);
  assert.equal(cartQuantity(store.getState().cart), 6);
  assert.equal(cartTotal(store.getState().cart), 15245);
  store.getState().setCartQuantity('0', 3);
  assert.equal(cartTotal(store.getState().cart), 12647);
  store.getState().removeCartItem('1');
  assert.equal(cartTotal(store.getState().cart), 3897);
  assert.equal(cartProducts(store.getState().cart)[0]?.quantity, 3);
  assert.deepEqual(other.getState().cart, []);
  store.getState().removeCartItem('0');
  assert.equal(cartTotal(store.getState().cart), 0);
});

test('invalid IDs, fractional quantities and UI-limit overflow never mutate the basket', () => {
  const store = createMarketplaceStore();
  assert.equal(store.getState().addToCart('missing'), false);
  for (const value of [0, -1, 1.5, NaN, Infinity, 100])
    assert.equal(store.getState().addToCart('0', value), false);
  assert.deepEqual(store.getState().cart, []);
  store.getState().addToCart('0', 99);
  assert.equal(store.getState().addToCart('0'), false);
  store.getState().setCartQuantity('0', 0);
  store.getState().setCartQuantity('0', 100);
  assert.equal(cartQuantity(store.getState().cart), 99);
  assert.equal(findProduct('missing'), undefined);
});

test('product links preserve normalized browse context without accepting redirect destinations', () => {
  const href = productHref('0', 'category=mobiles&q=phone&redirect=https://example.com');
  const url = new URL(href, 'http://localhost');
  assert.equal(url.pathname, '/marketplace/products/0');
  assert.equal(url.searchParams.get('category'), 'mobiles');
  assert.equal(url.searchParams.has('redirect'), false);
  assert.equal(productBackHref(url.search), '/marketplace?category=mobiles&q=phone#deals');
  assert.equal(productBackHref('category=invalid&redirect=//example.com'), '/marketplace#deals');
});

test('favorites toggle independently of the cart', () => {
  const store = createMarketplaceStore();
  store.getState().toggleFavorite('0');
  assert.deepEqual(store.getState().favorites, ['0']);
  assert.deepEqual(store.getState().cart, []);
  store.getState().toggleFavorite('0');
  assert.deepEqual(store.getState().favorites, []);
});
