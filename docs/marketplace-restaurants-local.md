# Restaurant-first Marketplace UI

Implemented as a local-only extension of the existing Marketplace identity.
The broad homepage and other application surfaces remain in place. This does not
declare the restaurant launch or Marketplace acceptance complete.

## Delivered behavior

- `/restaurants`: reference restaurants, name/cuisine search, cuisine filter,
  local-open filter, name sort, result count, reset and empty state. Query state
  uses the URL so navigation and direct links can retain it.
- Homepage and primary restaurant navigation lead to this listing.
- Restaurant detail: searchable, sectioned local menu, delivery/pickup information,
  local opening state, example delivery fee and minimum delivery subtotal.
- Meal selection: required size, optional extras, quantity and displayed configured
  total. The same selector is used in menu dialogs and direct product pages.
- Cart: separate lines for different configurations, merged quantities for matching
  configurations, option labels and configured prices in drawer/review/checkout.
- Restaurant carts contain one restaurant. Adding another restaurant requires an
  explicit replacement choice. Cancelling preserves the existing cart. Adding a
  store product to a restaurant cart explains the conflict and links to review.
  Existing non-restaurant Marketplace carts can still mix store products.
- Checkout: local delivery/pickup, delivery minimum validation, explicit mock fee,
  restaurant name and configured line summary. Confirmation and order details
  retain configurations and the delivery fee without storing contact details.
- Tracking: existing local progression plus cancellation/rejection demonstration
  while confirmed or preparing. Stopped orders cannot advance normally.
- Reorder: uses current local catalog prices and original selections; checks all
  lines before changing the cart. A conflicting cart needs explicit replacement.
  Unavailable lines or quantity limits leave the cart intact.

## Fixture choices, not production policies

`reference.json` remains the restaurant source. `data/restaurant-scenarios.ts`
builds clearly identified sample menus from the existing local meal templates.
Menus outside the burger example use generic demonstration dish names, not
claimed restaurant menus. The last reference restaurant is closed; the burger
example's side dish is unavailable. Other examples have available side dishes.
Every size/extra group is illustrative and intentionally shares one mock template.

Delivery costs 25 EGP in this scenario; pickup has no delivery fee. Delivery has a
100 EGP meal subtotal minimum. Reference promotion badges do not apply to these
mock prices; the menu explains this. These assumptions do not define backend
contracts or approved production pricing, availability or fulfillment rules.

All state stays in the existing in-memory Marketplace store. Refresh clears carts
and orders. No API, route-handler backend, database integration or payment added.
No sensitive form input is recorded in the order snapshot.

## Manual review handoff — not executed

Per user instruction, no tests, browser suites, typecheck, lint or build were run.
All browser, responsive, RTL and keyboard acceptance remains open for user review.

1. Start at `/restaurants`. Search, filter, sort, reset; exercise Back/Forward,
   reload with a query URL and a query with no results.
2. Open بيت البرجر. Try adding without selecting a size, then add a regular
   classic burger and a large classic burger with cheese. They should remain
   separate; matching choices should merge. The sample subtotal for one of each
   is 430 EGP, delivery total 455 EGP, pickup total 430 EGP.
3. Change quantities and remove only one configuration in the drawer/review page.
   Check the other configuration and totals remain intact.
4. Open another restaurant and add a meal. Decline replacement first, then accept
   it; check the cart preserves or replaces the original lines respectively.
5. Review the closed restaurant and unavailable side dish. Direct meal URLs must
   also prevent ordering these examples.
6. With an empty cart, choose only a 75 EGP side dish from an open restaurant
   other than the burger example. Delivery should explain the minimum; pickup
   should permit the local journey. Use fictitious contact details only.
7. Confirm a demo order, inspect its receipt/detail/list, then advance tracking.
   Use separate orders to demonstrate cancellation and restaurant rejection.
8. Reorder configured meals into an empty/same-restaurant/conflicting cart;
   confirm original options survive and replacement is deliberate.
9. Review phone/desktop layouts, RTL, keyboard focus and dialog close/return focus.
   Check existing Marketplace store-product shopping separately.

Backend integration still requires UI acceptance and a separate explicit user
instruction under the root roadmap.
