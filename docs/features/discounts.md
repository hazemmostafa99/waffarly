# Merchant discounts

The Discounts module owns coupons and promotional discounts for one merchant.
Owners can list, search, filter, create and revision-update percentage and fixed
EGP discounts. Codes are unique per merchant. Branch selection is stored through
same-merchant compound foreign keys; an empty selection means all branches.

Dates are inclusive Cairo calendar dates. A coupon can be drafted, published,
or paused; scheduled and expired status is derived from its dates and usage cap.
Owner requests derive the merchant from the authenticated actor. Create requests
are idempotent within a merchant. Updates use optimistic revisions.

The `maximum` request field accepts an empty string for no cap, matching the
owner editor and the stored nullable value. A supplied percentage cap must be a
positive monetary amount; fixed discounts reject a supplied cap. Schema regression
coverage includes creation/update, optional caps and invalid cap values.

`GET /owner/discounts` is cursor paginated and accepts `limit`, `cursor`, `search`,
`type`, and `status`. `GET /owner/discounts/stats` returns aggregate redemption
totals, reached customers, and active coupon counts. `GET /owner/discounts/branches`
returns the current merchant's active branches. `GET /owner/discounts/:id` reads
one scoped discount. `POST /owner/discounts` creates one using a `requestId` and
the discount fields; `PATCH /owner/discounts/:id` updates one using its `revision`.

Each discount is tenant-scoped, and selected branches are validated as active
branches belonging to that merchant. Discount values and money use decimal strings
at the HTTP boundary and database decimals. Regular tenant storefront checkout
accepts all-branch codes, checks the authoritative total in the order transaction,
enforces usage caps under concurrent checkout, and records an immutable redemption
snapshot. Marketplace checkout and POS checkout do not apply codes yet.
