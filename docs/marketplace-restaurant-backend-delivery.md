# Restaurant fields and reference seed delivery

Development runtime correction: API `dev` now enables the `waffarly-source`
condition, which resolves `@waffarly/database` to its source entry and the current
generated Prisma client instead of stale `dist` artifacts. Production imports
remain compiled. Restart the API dev command to activate this condition. Public
restaurant listing also removes the joined `merchant` field before validating
the strict settings projection. Neither change was exercised through HTTP or
automated checks, per the user's no-testing instruction.

Implemented and applied locally on 2026-11-11. No tests, typecheck, lint or build
were run, as requested. HTTP behavior and UI integration remain unverified.

## Persisted additions

- `RestaurantProfile`, owned by Storefront: description/cuisines, logo/cover URLs
  and alt text, publication/order, timezone, weekly periods, dated exceptions,
  always-open setting, manual pause/reason, fulfillment flags, decimal delivery fee
  and minimum, ETA bounds, named areas and fees, revision/actor and reference metadata.
- Category display order; Product display order, primary menu section constrained
  to the same merchant, and unique reference key.
- Opening state is derived using the restaurant timezone and overnight periods;
  dated exceptions take priority. Pause and publication affect acceptingOrders.
- Fee range is derived from configured areas or the fixed delivery fee.

The additive `20261111150000_restaurant_profiles` migration was successfully
applied to the local PostgreSQL database. Prisma source client generation ran as
required for the importer; this was not an application build.

## Endpoints added

- `GET/PUT /owner/restaurant`: owner-scoped settings; PUT requires the complete
  settings plus revision (0 to create), with validation and revision conflict handling.
- `GET /marketplace/restaurants?q=...&cursor=...`: published list, 24 items/page.
- `GET /marketplace/restaurants/:slug`: profile and initial menu page.
- `GET /marketplace/restaurants/:slug/products?cursor=...`: 40 items/page, includes
  unavailable but excludes archived items and hidden primary menu sections.
- `GET /marketplace/restaurants/:slug/products/:id`: public product detail.

Existing public catalog and POS response behavior is preserved. No module
dependency was added; Storefront continues using Catalog's public service.

## Seed actually imported

`scripts/data/marketplace-restaurants-v1.json` is the versioned materialized
reference snapshot. `scripts/seed-marketplace-restaurants.mts` imports dedicated
demo tenants with deterministic IDs, reserved `reference-restaurant-1` through
`reference-restaurant-12` slugs, and source product keys. It does not modify unrelated
merchants, create owner credentials, or activate subscriptions.

Execution completed: **12 restaurants, 41 products, 82 variants**, with categories,
primary product images, optional modifier assignments and pricing. Original cover,
logo and product image URLs were retained; image bytes were read to obtain real
MIME/size metadata. No replacement image was generated or substituted.

The seed uses full variant prices, with optional modifiers initially unselected.
11 restaurants use always-open demo settings; the final restaurant is closed and
paused. Weekly periods/exceptions initially remain empty because the reference
contains no actual opening times. Delivery is 25 EGP, minimum 100 EGP and each
restaurant retains its original ETA range. Ratings and promotional labels remain
explicit reference metadata, not verified reviews or financially applied discounts.

Re-run, when explicitly desired:

```powershell
node --import tsx scripts/seed-marketplace-restaurants.mts --apply-reference-demo
```

Requires Node 24, migrated local database and root DATABASE_URL loaded internally;
the script does not print its value. Production NODE_ENV requires the additional
explicit `--allow-production-reference-demo` flag. For the deployed demo server,
take and validate a database backup first, then run:

```bash
NODE_ENV=production node --import tsx scripts/seed-marketplace-restaurants.mts --apply-reference-demo --allow-production-reference-demo
```

This imports demonstration data; it does not create real owner credentials or
activate subscriptions. Re-running
updates only this dedicated reference dataset; it intentionally restores its
reference values, not merchant edits made to those demo records.

## Boundaries still open

- Marketplace UI still uses its local data; no frontend network integration added.
- Hours/fees are saved and exposed; existing real order creation has NOT been
  changed to enforce these settings, charge delivery fees or support idempotency.
  This is not a live ordering release. Demo merchants intentionally have no active
  subscriptions, so importing them does not authorize real checkout.
- Customer tracking/auth/payment, real reviews/promotions, geographic pricing,
  owner settings UI, and open/cuisine/sort discovery filters remain separate work.
- Standard package artifacts/server restart must reflect the new generated client
  before using the API; no build was performed in this task.
- User manual review is pending; successful migration and seed execution do not
  assert that HTTP flows or UI behavior have been tested.
