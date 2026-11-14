# Marketplace customer order ownership and tracking

Implemented source changes on 2026-11-13 after explicit user authorization.

## Ownership and boundaries

Orders owns CustomerOrderAccess, a one-order grant with a same-merchant compound
order foreign key and an optional global CustomerAccount relation. Exactly one
owner form is allowed: account, or hashed guest token with expiry. Auth exports
CustomerAuthService for session identity; Orders already imports Auth. Customer
contact details and tenant-local MerchantCustomer associations are independent.
No phone/email matching or historical ownership backfill is performed.

Marketplace restaurant checkout now uses the explicit identity-aware
POST /catalog/stores/:slug/orders/customer endpoint. It validates the existing
order schema and requires requestId. It derives account identity from the existing
HttpOnly customer session or requires a prepared guest cookie. Order ownership is
written inside the existing order/stock/discount transaction. Replay returns a
receipt only with current account or valid original guest access. Logging in
between a guest command and its retry does not create another order. Existing
public tenant-storefront checkout endpoints/behavior remain unchanged in this
slice; their new orders are not automatically added to Marketplace history.

## Guest access

POST /customer/orders/session prepares a 256-bit random browser token before
submission. The cookie is HttpOnly, SameSite=Lax and Secure in production, with
a 30-day maximum lifetime. Only its SHA-256 digest is stored with an order. Guest
reads additionally require an unclaimed grant whose stored expiry is in the
future. The browser capability is not a customer account and conveys no ownership
of arbitrary orders sharing phone or email. Tokens are not returned in JSON,
URLs or localStorage. Clearing cookies/changing browser loses guest access;
OTP recovery is deliberately not implemented. Invalid existing account sessions
are rejected rather than silently downgrading checkout to guest ownership.

## Customer reads and explicit claim

GET /customer/orders returns bounded 20-order cursor pages for the current
account plus valid guest grants on the current browser. Cursor and detail lookups
AND the requested order ID with the authorization scope. GET /customer/orders/:id
returns explicit customer-safe product/price/status/date projections, excluding
contact PII, employee IDs, internal notes and stock/payment operational records.
Unknown/unowned orders return 404. Reads and session/claim responses use no-store.

POST /customer/orders/:id/claim requires a signed-in account AND the original
unexpired guest grant, atomically sets accountId and clears guest access. A
repeated claim by the same owner is read-only and idempotent; other accounts
cannot take an already claimed order. Ownership/claim time are persisted.

## Frontend

Marketplace restaurant review prepares guest access before sending an order;
creation and history requests include credentials through a dedicated transport.
The confirmation links to real details. /orders reads account/browser history,
shows pagination/loading/error/empty states, and explains guest access limits.
Real detail/tracking routes show authoritative state, poll every 15 seconds while
active, and stop polling terminal or error states. Guest details offer explicit
account attachment after login. Query keys are account-scoped to avoid rendering
a prior account's cached history after logout/login. Local demo order list/detail/
tracking remain separately labeled and use their original local state.

## Database and verification

Applied 20261113160000_customer_order_access locally. Prisma generation required
a compound unique declaration for the one-to-one tenant relation; added and
applied 20261113161000_customer_order_access_unique without rewriting the first
migration, then generated Prisma successfully. No old orders were linked.

Focused regression tests cover ownership scope, anonymous access, guest digest
and expiry predicates, cookie flags, invalid authentication, explicit claims and
foreign cursor rejection. Existing HTTP controller fixtures include the new
access-service dependency. No tests, lint, typecheck, build, browser automation,
real orders or financial actions were run under the manual-QA instruction.
HTTP behavior, multi-account isolation and full checkout/tracking acceptance
remain manually unverified. Runtime packages/API must load the current generated
client and contracts when the user performs acceptance.

## Customer order presentation update

Order history now uses a bounded 1120px content area, compact responsive cards,
restaurant icons (no invented product imagery), readable dates with Western
digits, order previews, status badges and all/active/past filters over loaded
pages. Pagination and the scope of filtering remain explicit. Signed-in users
without guest orders no longer see an irrelevant guest-access notice.

Details use a main progress/items column plus a separate receipt summary on
desktop, stacked on mobile. The timeline reflects the server status and provided
timestamps; it does not invent ETA, courier movement or payment completion. Full
UUID remains available behind disclosure and copy, with an abbreviated reference
in the heading. Guest claim and access controls remain unchanged. Detail refresh
and terminal/error polling behavior are preserved.

Loading skeletons, genuine empty vs filtered-empty states, authorization/not-found
and connection errors now have distinct presentation and recovery actions.
Page titles/descriptions were corrected, the obsolete demo tracking title was
removed, and private order pages remain noindex/nofollow. Local demo history
retains its original functionality with a separate accessible section.

No backend, database, financial rules or access policy changed in this design
slice. No tests, browser automation, typecheck or builds were run, following the
manual-QA instruction. Source/diff review only; responsive visual acceptance
remains pending.

## Order history layout refinement

Replaced the two-column card grid with single-column responsive order rows in a
1040px content area. Desktop rows group restaurant/status/date/items alongside a
compact total/action area; mobile moves the latter into an inline footer. A
single order now occupies the available row instead of leaving an empty grid
column. Removed the separate filled filter control and used lightweight underline
filters aligned with the list. Counts refer only to loaded orders, as indicated
when pagination remains. Reduced title/toolbar spacing and matched list loading
skeletons to the row layout. Embedded account usage remains supported.

No data, ownership or backend behavior changed. Source/diff reviewed; browser
visual acceptance and automated checks were not run per manual-QA preference.
