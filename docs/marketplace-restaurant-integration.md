# Restaurant browsing integration

Implemented source changes, 2026-11-11. No tests, browser automation, lint,
typecheck or application build were run. Manual acceptance is pending.

## Connected

- Homepage restaurant cards and `/restaurants` read the paginated public
  restaurant API through React Query, with loading/error/retry states. Directory
  URL filters currently filter the downloaded restaurant pages on the client.
- Restaurant detail reads its profile and all menu pages server-side with
  revalidation disabled for current operating state. Slug routes are canonical;
  old name-based links resolve to published API restaurants by displayed name.
- Meal links carry `restaurant=<slug>` for tenant-scoped product lookup. Existing
  local restaurant product links resolve their reference keys against API data;
  they do not fall back to fixture content if the API fails.
- Product page content, same-restaurant recommendations, opening state, delivery
  fee, variants and modifier groups use the API projection. The design and fixed
  menu-card/modal widths remain unchanged.
- First available variant is selected by position. Required selections initialize
  from available choices; optional extras start empty. Variant-specific group,
  option availability and price overrides are reflected. Changing size clears
  extras to avoid retaining incompatible options.
- Configured unit price comes from the existing public quote endpoint. Add is
  disabled while pricing is pending or failed; retry is available. Only actual
  variant and assignment/option IDs are sent.
- In-memory demo cart lines retain the API product snapshot and quoted unit price
  so real IDs still display names/images/options during local cart/checkout.
  These snapshots are display facts, not authority for a future real order.

## Still demonstrations / operational requirements

Checkout, payment, customer account and order tracking are still explicitly local
demonstrations. No real order endpoint is called. Existing storefront/POS behavior
and non-restaurant Marketplace catalog data sources remain unchanged.

Real order creation still needs server enforcement of operating settings,
fulfillment, fees/minimums and idempotency before it can be enabled. The seeded
reference tenants remain demonstration records without owner credentials or
active subscriptions. Do not treat successful catalog quotation as permission
to submit a real order.

The existing `NEXT_PUBLIC_API_BASE_URL` and API process must serve the new routes.
Package artifacts/generated client used by that process must include the new
restaurant models/contracts. No build or server restart was performed here.

Remote favorite/reorder reconciliation beyond the browsing/cart slice remains
open: legacy local lookup cannot restore arbitrary server product IDs. No silent
substitution of local product data is implemented for those IDs.

## Manual handoff

Open homepage, directory and a restaurant; compare reference images/content and
closed/unavailable states. Open a meal, change size/extras, observe server pricing,
then add to the demo cart. Follow old name/reference links and copy a new meal URL
including its restaurant query. Exercise API-down/retry and mobile layouts.
These steps are provided for the user; they were not executed by the agent.
