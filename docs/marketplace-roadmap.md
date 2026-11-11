# Marketplace completion roadmap

## Active decision: UI first, backend later

The user explicitly requires completing every Marketplace screen and user flow
with the existing local data before backend integration. This supersedes the
previous integration-first phase order. Missing APIs are not blockers for the UI.
Backend integration starts only after UI-flow completion and a separate explicit
user instruction; it must not begin automatically.

Use `apps/storefront/src/features/marketplace/data/reference.json` as the current
data source. Additional scenarios may be created locally to exercise empty/error,
product options, checkout, account and tracking states; label them as mock scenarios,
never as extracted original-site records or production facts. No backend fetches,
API/database startup, schema/contract edits, new Next route handlers or mock HTTP
servers are needed. Existing external reference image URLs may remain.

The reference only proves the homepage and its local interactions. New detail,
checkout and account screens extend the established identity; do not claim they
were extracted pixel-perfect from an unavailable original screen.

## UI delivery order

Local checkout slice implemented at `/marketplace/checkout`: transient demo contact
fields, pickup/delivery selection, review/edit, pending/double-click handling,
changed-cart protection and explicit simulated confirmation. A product-only demo
record now feeds the local `/marketplace/orders` history and
`/marketplace/orders/[orderId]` detail view. Contact fields are not recorded; the
history is cleared on refresh. No automated checks were run per user request; manual
acceptance is pending. Backend integration is still deferred. See
[local checkout](marketplace-local-checkout.md) and [routes](routes-map.md).

Cart-review slice implemented locally at `/marketplace/cart`, with named item,
summary and empty-state components, reused quantity/cart functions and drawer entry.
See [cart review](marketplace-cart-review.md).

Product details slice delivered locally: existing product cards link to details,
quantity controls, related products and merged cart lines are implemented, and return
links preserve search/category. Local checkout and order list/detail are also present.
The original product page does not establish additional option behavior. Store and
restaurant detail routes now use the existing local records; the restaurant menu
shown is an explicitly labeled UI sample because the fixture has no menu data.
Order tracking/reorder, account and browser acceptance
remain open. Historical checks apply only to the revisions recorded in
[slice evidence](marketplace-product-details.md).

Navigation slice implemented locally: header menu/shared destinations, mobile actions,
URL-backed query/category, direct-link filtering and pending-page feedback. TypeScript,
6 focused tests, production build and direct HTTP query checks passed. Actual browser
Back/Forward, keyboard and responsive/visual checks remain pending. Sorting, pagination
and remaining placeholder destinations are not complete. See [slice evidence](marketplace-navigation.md).

| Phase | Deliverable                          | Completion evidence using local data only                                                                                                                                           |
| ----- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Structure and visual baseline        | Small components grouped by feature, reusable functions, scoped tokens; reference comparison at 1440/1024/768/390/375 when browser works                                            |
| 1     | Navigation and discovery             | Header/mobile menu, category/search/filter/sort URLs, back/forward/reload, working local destinations and clear unavailable states                                                  |
| 2     | Store/restaurant and product details | Existing local records linked to local detail views; explicit mock options where absent; direct URL and not-found states                                                            |
| 3     | Cart and favorites                   | Cart review and favorite list/removal are implemented; explicit product options remain absent from fixture data; empty/unavailable states still need manual review                  |
| 4     | Local checkout and confirmation      | Demo contact/fulfillment/review steps, validation, pending/error/retry/success, duplicate-click prevention and mock receipt; no real order or payment                               |
| 5     | Local account and order journey      | Demo sign-in/out, profile/address forms, local order list/detail/tracking, empty/error states and local reorder; no real session or customer record                                 |
| 6     | Complete local flow and polish       | Every navigation entry has a deliberate outcome; notifications/payment-status UI if included is simulated; seller-entry flow cannot submit to the existing live application API     |
| 7     | UI acceptance                        | Browse -> details/options -> cart -> checkout -> demo confirmation -> tracking/account journey verified; responsive/RTL/keyboard checks, typecheck/build and honest visual evidence |
| 8     | Backend integration (deferred)       | Only after phase 7 completion and explicit user instruction; inventory existing contracts, settle production policies, connect one flow at a time                                   |

Phases may be sliced into small, reviewable changes. Navigation, product details,
cart, checkout, session-only favorites, order history/detail, and store/restaurant
details now have local UI. The next practical slice is local order tracking, followed
by the demo account journey. Do not build empty architecture layers for
features that have no implementation yet.

## Local behavior and state rules

- Components render UI; pure functions handle filtering/formatting/calculations;
  hooks coordinate related local interactions. Keep related files together.
- Use component state for forms and transient presentation, URL state for shareable
  navigation, and feature-owned Zustand slices for non-sensitive cart, favorites
  and local demo orders.
- React Query remains available; use it only if asynchronous local scenario behavior
  benefits from it. An in-process mock function is sufficient; do not add network
  calls merely to exercise a library. Do not duplicate query results in Zustand.
- Clearly identify demo checkout, authentication, payments, order confirmation and
  tracking in rendered UI. No real order/session/charge/notification claims.
- Keep sensitive form inputs transient, clear them on exit/reset, never persist
  passwords/payment credentials/customer PII, and do not collect real card details.
- Demo state is isolated from existing tenant/storefront carts, checkout and APIs.
  Do not connect seller CTA submission to the existing `/join` backend flow now;
  use a labeled local presentation if demonstrating it.
- Preserve the reference design where observed. Quantity changes and newly built
  screens are explicit extensions, not claims about original reference behavior.
- Mock failures are deliberate scenarios, not silent substitutes after production
  failures. Fixtures are the intentional active mode during this phase.

## UI acceptance checklist before considering integration

- [ ] All planned pages are reachable, including direct links and intentional not-found views.
- [ ] Navigation, category/search/filter/sort state and browser back/forward work.
- [ ] Existing fixture content is reused; additional data/states are identified as mock.
- [ ] Cart/favorites, product options and quantity/removal journeys work locally.
- [ ] Checkout validation, pending/error/retry and demo confirmation work end to end.
- [ ] Demo account, addresses, orders and tracking complete the customer journey.
- [ ] Loading/empty/error/disabled/unavailable/success states are covered where applicable.
- [ ] No Marketplace backend data requests or backend service dependency exists.
- [ ] Demo state cannot affect real tenant orders, accounts, payments or applications.
- [ ] Responsive/RTL, accessibility, focused tests, typecheck/build and visual checks have recorded evidence; blocked checks remain explicitly open.
- [ ] The user explicitly instructs beginning backend integration after reviewing UI completion.

## Deferred backend inventory (reference only)

Retained for the later integration phase only. Do not call or extend these endpoints during UI development. Their availability does not authorize integration now. These are local repository capabilities, not reference-site endpoints:

| Capability                 | Existing code                                                                                    | Planning consequence                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Store catalog              | `GET /catalog/stores/:slug` in `apps/api/src/modules/storefront/public-storefront.controller.ts` | One merchant at a time; no global marketplace search contract established by this inspection                                             |
| Category/product pages     | `GET /catalog/stores/:slug/categories` and `/products`                                           | Existing cursor query parsing; inspect bounds/search/filter support before extension                                                     |
| Product quote              | `POST /catalog/stores/:slug/products/:id/quote`                                                  | Reuse Catalog pricing; server checks slug/product/options rather than client display prices                                              |
| Guest order creation       | `POST /catalog/stores/:slug/orders` in `orders/storefront-orders.controller.ts`                  | Supports customerName/customerPhone, pickup/delivery, optional deliveryAddress and configured item quantities; delivery needs an address |
| Existing frontend checkout | `features/checkout/storefront-checkout-page.tsx`                                                 | Reuse behavior/contracts after review, not its unrelated storefront styling or fixture IDs                                               |
| Customer pages             | Existing account/tracking preview features and storefront FEATURE/PROGRESS docs                  | UI presence is not evidence of customer auth/profile/history/tracking APIs; implement contracts before live integration                  |
| Merchant application       | Existing `/join` flow                                                                            | Candidate seller CTA destination, no duplicate onboarding system                                                                         |

Do not fan out over every seller client-side to simulate global search. Define a bounded public composition/listing contract. Storefront owns composition, Catalog owns products and pricing, Orders owns order creation/lifecycle, Auth owns supported actors/sessions, and Payments owns payment behavior. Preserve acyclic dependencies and use module `index.ts` exports. No API/database/contracts were changed by the cleanup.

## Decisions deferred to backend integration

Production seller grouping, customer identity, fulfillment fees, stock, pricing,
request idempotency, order access, payments, cancellation and returns require an
explicit integration design later. Local UX can use clearly documented mock
assumptions without presenting them as approved production contracts.

At that later stage, inspect shared contracts and API ownership again: Storefront
composes public catalog, Catalog owns pricing/options, Orders owns order lifecycle,
Auth owns identities and Payments owns payment behavior. Use tenant-scoped queries,
authoritative money calculations, transaction boundaries and authorization tests.
Do not send fixture IDs to real order endpoints. Follow `apps/api/AGENTS.md` before
planning changes to API/database/shared contracts. This section is future context,
not current work authorization.
