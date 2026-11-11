import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarketplaceStore } from './marketplace-store';
import { cartProducts, filterProducts } from './catalog';

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
