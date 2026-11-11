# Local checkout demo

Route: `/marketplace/checkout`, reached from the cart review CTA. This entire
flow is in-process UI simulation over the current local basket. No backend/API,
mock HTTP server, database, real order, payment, inventory reservation or notification
is involved. No package was added.

## Steps and responsibilities

- `components/checkout/checkout-page.tsx`: step composition, progress, empty basket,
  heading focus and confirmation-first rendering after the local cart is cleared.
- `checkout-contact-form.tsx`: transient demo name/phone fields, error messages and
  first-invalid-field focus; `checkout-fulfillment-fields.tsx`: delivery/pickup choice
  and conditional demo address. Pickup clears the address draft.
- `checkout-review.tsx`: local contact/fulfillment review, edit/back controls and
  explicitly simulated confirmation. No payment card fields exist.
- `checkout-order-summary.tsx`: existing fixture products/quantities, item subtotals,
  unit count and fee-exclusion notice; reused by review and confirmation.
- `checkout-confirmation.tsx`: explicit demo success and temporary product-only
  summary, without fabricated order number, delivery deadline or payment claim.
- `use-local-checkout.ts`: local state machine, validation, synchronous double-click
  guard, short cancellable in-process delay and sensitive-draft clearing.
- `model/checkout.ts`: local UI types/defaults and validation; not a shared production
  transport contract. `marketplace-store.ts` clears only an unchanged basket snapshot.

Demo validation: name at least 2 characters; phone 7-15 Western digits with optional
plus/spaces/parentheses/hyphens; delivery address at least 8 characters. These are
local UX rules, not verified production fulfillment/contact requirements.

## State and privacy

Contact data stays in component state only, never URLs, Zustand, browser storage,
logs or a server. Forms ask for fake data and disable autocomplete. Leaving the
route/unmounting or reloading drops the draft; successful demo confirmation clears
it. The temporary receipt retains only fixture products, quantities and fulfillment
type. The delay is cancelled on unmount, preserving the cart if the user exits.

During review, totals reflect the current shared cart. Confirm captures a snapshot;
if the cart changes during the local pending delay, it is not cleared and an error
asks the shopper to review again. An unchanged snapshot is cleared once, and the
page renders the local confirmation even though the basket is then empty. Buttons
prevent duplicate submission/editing while pending. No request retry or idempotent
server-order contract is implied.

Shipping, tax, payment methods, pickup branches, real stock and delivery dates are
not invented. All amounts use the shared Western-digit formatter. Empty checkout
links back to browsing. Cart review remains available for editing; navigating to
it intentionally discards contact data. Existing tenant checkout is untouched.

## Verification and manual review

No automated tests, browser runs, typecheck or build were executed for this slice,
per the user's instruction. Manual acceptance remains pending.

Manual journey: add a product -> Review Cart -> Continue -> try missing/invalid
fields -> use fake details -> switch pickup/delivery -> Review -> Edit -> Confirm
Demo. Confirm the no-real-order message, cleared cart and absence of personal data
in confirmation. Also try an empty cart, refresh/route exit, rapid double-clicks,
and changing cart quantity in the drawer while confirmation is pending. Check mobile
layout and Western price digits. Nothing should contact a backend or charge money.
