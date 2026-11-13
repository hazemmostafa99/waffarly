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

## Branch routing foundation — 2026-11-13

Orders now resolves a single active same-tenant branch during restaurant quote
and again during creation, within the existing serializable transactions. The
order stores that branch ID and name atomically. Zero or multiple active branches
reject checkout instead of saving an unrouted order. Non-restaurant storefronts
retain existing behavior. This is an initial single-branch rule; explicit owner
branch selection, POS queue/lifecycle changes and cross-step branch-review binding
remain unfinished. Existing reference restaurants have no branches and therefore
cannot confirm orders until operational setup is completed. No branches or
employees were fabricated, and no database records were changed.

No automated checks or actual order submission were run.

## Routed storefront POS queue

The existing POS queue now includes pending/accepted/preparing/ready storefront
orders assigned to the requested same-tenant branch, including non-recipe lines.
The existing permission/assigned-branch controller guards remain in effect.
Lifecycle commands permit routed storefront acceptance, preparation and readiness
without inventing recipe stock requirements. Recipe consumption stays unchanged.
POS lifecycle reads check receiving-branch assignment and active branch before
returning saved retry results. Acceptance cannot redirect an assigned order.

Branch creation/employee assignments, final storefront handover/payment policy,
customer tracking and end-to-end acceptance remain unfinished. No branches were
created, and no automated checks or real orders were run in this slice.

## Applied local reception setup — 2026-11-13

Executed scripts/prepare-marketplace-reception.mts --apply against the local
database through InventoryLocationsService.createBranch. All twelve reference
restaurants now have one active main branch and its default consumption warehouse.
The command validates deterministic merchant identities, rejects production and
remote database hosts, reuses existing active branches, and does not change
subscriptions, restaurant settings or employee permissions. Earlier no-branch
statements above describe the state before this operation.

The returned setup report shows zero active POS employees for all twelve tenants.
POS employee provisioning/branch assignment is the next operational prerequisite;
no employee accounts or credentials were created. No tests, builds or actual
orders were run. The twelfth restaurant remains closed/paused.

## Applied POS account provisioning — 2026-11-13

Created twelve active cashier accounts using Auth PosEmployeeService.create,
one per reference restaurant, each assigned exclusively to its main branch.
Username is waffarly-cashier in each tenant. Existing cashier grants provide
sales, order acceptance and preparation; view-orders access is implied by the
existing permission resolver. No administrator or supervisor privileges were added.

Each account has an independently generated 32-character password. Credentials
were encrypted with Windows DPAPI CurrentUser and saved outside the repository
under LOCALAPPDATA/Waffarly/local-pos-credentials. No plaintext passwords were
logged or written to source. The provisioning command reuses its own existing
accounts and rejects unexpected account/branch state instead of resetting it.
The initial encryption attempt failed before account creation; the subsequent
run created all twelve accounts successfully using direct DPAPI calls.

Use Windows PowerShell with -STA -File scripts/copy-marketplace-pos-password.ps1
-Restaurant 1 (replace 1 with 1–12) to copy that restaurant's password to the
clipboard under the same Windows user. The helper does not print passwords.
No actual login, order submission or automated checks were performed. Final
storefront handover, customer tracking and full acceptance remain unfinished.
