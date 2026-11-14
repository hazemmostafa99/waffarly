Customer orders update (2026-11-13): Marketplace restaurant orders now have
account/guest ownership, backend history/detail/tracking reads and explicit guest
claim. Historical statements below are superseded for this slice. See
[current customer order delivery](marketplace-customer-orders.md). Manual acceptance is pending.

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

## Pickup collection and completion — 2026-11-13

Orders now exposes POST /pos/orders/:id/pickup-collection with registerId.
A sell-authorized employee explicitly selects a register with an open shift.
The transaction locks the shift and the same-tenant order, requires a ready
storefront pickup at that branch, attaches the shift, creates one whole-order
check and records an attributable action. Repeated preparation reuses the same
check/shift; another shift or unexpected check state is rejected. It creates no
payment and preserves source, order ID, total, stock and original web identity.

The POS kitchen queue offers collection for ready pickup orders through the
existing payment dialog. Payment-state, payment-write and receipt-read endpoints
accept explicitly attached ready/completed web pickups as well as POS orders.
Existing tender, revision, payment retry and cash-journal rules remain. Pickup
receipts retain pickup as their fulfillment type. No electronic payment provider
is introduced. Ready pickup handover requires settled checks and records completed
on the same order. Cash collection and handover remain separate actions.

Shift unsettled-check reconciliation includes attached web pickups, preventing
ordinary close with their unpaid checks. Ordinary cancellation is rejected once
a routed web order has any recorded payment; refund/reversal for web pickup is
not enabled by this change and requires financial review. The existing POS-only
refund/returns/receipt-history and active-sales listing scopes are unchanged.

This slice does not add storefront delivery collection, customer history/tracking,
closed-shift reassignment or multi-branch routing. It does not provision registers
or open shifts or record any payment on the user's behalf. Configure a register
and open its shift through the existing owner/POS flows before manual acceptance.

Source/diff reviewed only; no tests, lint, typecheck, build, browser automation or
real order/payment was run, following the manual-QA preference. Database-backed
concurrency, cross-tenant/branch rejection, exact replay, partial/full payments,
shift close, receipt and handover acceptance remain unverified.

Migration 20261113140000_pickup_collection_action extends the audited action-kind
constraint for pickup_collection; existing actions remain allowed. Focused
preparation regression tests were added but not executed.

The action-kind migration was applied successfully to the local waffarly database
after migrate status confirmed it was the only pending migration. No application
tests or financial operations were executed. Manual acceptance remains pending.

## Open-shift status gate — 2026-11-13

User decision: restaurant web orders may arrive without a cashier shift, but
no new status change may be made until their receiving branch has an open cash
shift. Orders creation, quotation and queue reads remain unchanged. Web order
acceptance, preparation, readiness, handover and cancellation in the lifecycle
service now require a same-tenant, same-branch open shift on an active register
and active branch. Owner restaurant accept/reject uses the same gate. This
requires an open branch shift, not ownership of that shift by the kitchen actor.
Employee/branch permissions remain separately enforced.

Shifts exports lockBranchOperationShift through its public entry point; Orders
already depends on Shifts. The shared shift-row lock is acquired before the
order-row lock and retained through transaction completion, preventing a
simultaneous shift close from crossing the operation. Previously committed
exact lifecycle retries still return saved results without a new status write.
Legacy non-restaurant owner status behavior and existing POS-origin lifecycle
behavior are unchanged. No statuses were reset on existing orders.

Added focused no-shift regression cases for acceptance, preparation, readiness
and handover. Tests/typecheck/lint/build/browser flows were not run per the
manual-QA instruction. Source diff review passed; manual acceptance is pending.

## Open-shift rejection presentation

The shift gate now returns ORDER_SHIFT_REQUIRED with a translatable message.
POS ApiError preserves errorCode, and the kitchen action handler releases the
saved pending command for this explicit pre-write rejection. Network/server
uncertainties retain their retry identity. Both the English message and the
earlier Arabic shift message are registered in the Arabic dictionary, avoiding
the generic unexpected-error fallback. No broad 409 retry behavior was changed.
Source reviewed only; no automated checks or live UI actions were run.

## Shift-error presentation correction

The HTTP exception filter reads exception-body code and emits response errorCode.
Shift rejections now use code accordingly; the earlier errorCode property was
dropped by the filter. POS renders this known rejection locally, independently
of the compiled shared UI translation package, whose source-only dictionary
change did not update dist. English and older Arabic messages are supported;
unknown errors keep the existing safe fallback. The existing ORDER_SHIFT_REQUIRED
handler releases the definitively rejected command while network/5xx uncertainty
stays saved. Regression cases added, not executed; no builds or live actions run.
