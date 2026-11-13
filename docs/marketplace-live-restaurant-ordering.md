# Persisted restaurant ordering

2026-11-13: the user authorized real backend order submission for every persisted
restaurant, including the imported reference restaurants. Reference metadata is
provenance, not an order simulation flag.

## Direct local database inspection

All twelve reference restaurants have owner accounts and active subscriptions
with coverage ending 2026-12-11. No new subscriptions, plans, collection records
or merchant data were created. Earlier delivery notes saying these tenants
have no owners/subscriptions no longer reflect the database.

Eleven profiles are published, always open and unpaused. The twelfth remains
closed/paused; these settings were not overridden. None has an active branch.
No existing storefront orders were present at inspection time.

## Implementation

- API-backed restaurant checkout always sends the existing real create-order
  command after reviewing the authoritative basket quote. There is no reference-
  restaurant local-confirmation branch or insertion into demo history.
- Orders owns checkout. Quote now checks subscription eligibility under the
  transaction's merchant shared lock, before presenting a confirmable total.
  Creation keeps its subscription, restaurant policy, stock, price,
  reviewed-total, revision, request-ID and fingerprint checks.
- The existing demo quote field is retained for compatibility, deprecated,
  and returned as false. Reference data does not choose order behavior.
- Receipt comes from the server. It reports pending restaurant review, absence
  of electronic payment, and the limitation of customer history/tracking.
- Restaurant product, cart, meal and checkout copy reflects backend ordering.
  Local fixture-only/non-restaurant flows keep their demonstration labels.
- The legacy reference importer refuses to overwrite tenants with owners,
  subscriptions or orders. Update operational restaurants through owner/catalog
  workflows instead of resetting their reference settings.

## Remaining operational work

Orders are visible through the existing merchant-scoped owner order list.
Full POS preparation is a separate unfinished slice: the imported tenants have
no branches, and their unconfigured inventory lines use legacy stock handling.
The current POS kitchen queue primarily selects recipe-acceptance lines.
Do not claim orders already reach the POS kitchen or progress through its full
workflow. Customer-protected order lookup/history/tracking, refresh-safe
uncertain-command recovery and electronic payment remain unfinished.

## Verification

Inspected the local database read-only and reviewed the source changes.
Focused quote regression tests were added, but no tests, lint, typecheck, build,
browser automation or order submission were run, honoring the manual-QA preference.
HTTP/UI behavior remains manually unverified.
