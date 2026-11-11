# Checkout review and submission integration

2026-11-11. Implemented without tests, HTTP verification, lint, typecheck or build.
Migration `20261111190000_storefront_order_retries` was applied locally and Prisma
source generation completed. Manual acceptance is pending.

- `POST /catalog/stores/:slug/orders/quote` re-quotes each configuration, applies
  restaurant operating/fulfillment rules, and returns unit prices, subtotal,
  delivery fee, total, settings revision and explicit reference-demo status.
  Contact details are not needed or persisted by quote.
- Order creation accepts optional `requestId` and `reviewedTotal` for backward
  compatibility. Marketplace supplies both. Tenant/request uniqueness and a
  SHA-256 payload fingerprint bind retries to one command. Replays return the
  existing receipt; changed payloads conflict. Concurrent failures also look for
  a committed matching request before returning an error. Stock/order writes
  remain in the existing transaction.
- The computed total must match reviewedTotal, and a supplied settings revision
  must still match, before committing the order. Subscription checks remain intact.
- API-backed restaurant carts use a checkout flow that reviews the server total,
  shows contact/fulfillment data and asks for explicit confirmation. Named delivery
  areas are selectable where configured. Local non-restaurant checkout is unchanged.
- Reference-demo quotes result ONLY in a labeled local confirmation; no create
  request, payment, subscription activation or owner account is added. Local demo
  receipts retain server-reviewed unit prices and delivery fees.
- Non-demo confirmation submits the command and renders the actual server receipt.
  It is not inserted into fake tracking/history and does not imply payment.
- The command envelope is kept in transient component memory. A network/5xx
  uncertainty locks editing and retries the same request ID/body; definitive
  validation failures return to review. Never persist contact details/passwords.
- Successful creation clears the cart only if it still matches the submitted
  snapshot. The receipt stays rendered even after clearing the remote cart.

Limits: an uncertain command is not recoverable after leaving/reloading this
component; the UI tells the user to resolve it before leaving. Public protected
order lookup/history, durable non-PII recovery, payments and real-world fulfillment
tracking remain separate work. No actual order was submitted by the agent.
