import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarketplaceStore } from './marketplace-store';
import { cartProducts, filterProducts } from './catalog';
import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
  productCategory,
} from '../search/search-state';

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

test('cart preserves duplicate lines, removes the selected occurrence and isolates stores', () => {
  const store = createMarketplaceStore();
  const otherStore = createMarketplaceStore();
  const headphone = filterProducts('all', 'سماعة')[0]!;
  const phone = filterProducts('all', 'هاتف')[0]!;
  store.getState().addToCart(headphone.id);
  store.getState().addToCart(phone.id);
  store.getState().addToCart(headphone.id);
  assert.equal(
    cartProducts(store.getState().cart).reduce((sum, p) => sum + p.price, 0),
    11348,
  );
  store.getState().removeCartItem(1);
  assert.deepEqual(store.getState().cart, [headphone.id, headphone.id]);
  assert.equal(
    cartProducts(store.getState().cart).reduce((sum, p) => sum + p.price, 0),
    2598,
  );
  assert.deepEqual(otherStore.getState().cart, []);
});

test('favorites toggle independently of the cart', () => {
  const store = createMarketplaceStore();
  store.getState().toggleFavorite('0');
  assert.deepEqual(store.getState().favorites, ['0']);
  assert.deepEqual(store.getState().cart, []);
  store.getState().toggleFavorite('0');
  assert.deepEqual(store.getState().favorites, []);
});
