# Following an API operation

Use these traces with the [module map](API_MODULE_GUIDE.md). The controller
recognizes HTTP input and the current actor, the application entry point selects
an operation, and the operation owns related database writes. Cashier operations now call their
responsible service directly; the former cashier forwarding facade is removed.
Other legacy service entry points remain where their migration is still pending.

## Pairing a POS browser with its cashier register

1. `POST /auth/pos/login` authenticates the employee, reuses or creates the
   browser's HttpOnly `waffarly_pos_device` UUID, stores it in the new POS
   `AuthSession.deviceId` column and issues the POS session cookie.
2. `GET /auth/pos/me` returns the employee's one assigned branch and the
   register associated with the browser UUID. If no register is paired, the POS
   layout shows setup instead of the selling workspace.
3. Setup calls `GET /pos/registers?branchId=...`; Shifts returns only active,
   unpaired registers from that branch. `POST /pos/registers/bind` locks and
   assigns the chosen register, with a unique tenant/device constraint handling
   concurrent pairing attempts.
4. `PosEmployeeGuard` blocks other POS routes until pairing and rejects a
   mismatched requested `registerId` after pairing. Shift and financial
   operations also check the assigned register in their owning service or
   transaction, so a stale or altered client request cannot redirect a write.
5. The owner can unpair a register from POS Registers after its shift is closed.
   Unpairing checks the register revision, updates its audit actor, and makes
   the browser eligible to pair again at the employee's assigned branch.

The device UUID survives POS logout. Clearing the browser cookie creates a new
browser identity; if the old UUID is still paired, the owner must unpair it
after the shift closes before that browser profile can be set up again.

## Confirming a cashier sale

1. `POST /pos/orders` enters
   [the cashier controller](../../apps/api/src/modules/orders/http/pos/pos-orders.controller.ts).
   Auth supplies the current employee and its single assigned branch.
2. The controller calls
   [`PosSaleService.create`](../../apps/api/src/modules/orders/pos-sales/pos-sale.service.ts).
   Nest injects the operation dependencies. The service validates the command and
   keeps its request identity.
3. Inside the existing sale transaction, the operation checks saved retries,
   locks the open register shift, reviews current catalog pricing and product
   revisions, and saves immutable line details. Catalog owns authoritative pricing.
4. The operation saves the order/check and applicable dining or kitchen facts.
   Direct stock effects and frozen recipe requirements use Orders' stock helpers
   and Inventory's ledger on that same transaction.
5. It stores the action result and returns the confirmed order. An exact retry
   returns the earlier result rather than another sale. Sale confirmation itself
   does not represent a payment.

Useful checks: `pos-orders.test.ts`, `pos-kitchen.test.ts`, and the Catalog,
POS dining, stock and order-number database suites. This trace describes current
behavior, including restaurant-oriented kitchen dispatch; it does not establish
complete support for other business activities.

## Collecting an order bill

1. `POST /pos/orders/:id/checks/:checkId/payments` enters the
   [cashier billing controller](../../apps/api/src/modules/orders/http/pos/pos-order-billing.controller.ts),
   then calls `CheckPaymentService.recordCheckPayment` directly.
2. [`CheckPaymentService`](../../apps/api/src/modules/orders/billing/check-payment.service.ts)
   validates the tender request and its exact retry identity, checks order/branch
   scope, and locks the relevant shift/order/check in its existing order.
3. [Payments](../../apps/api/src/modules/payments/payments.service.ts) records
   tender rows. Shifts records any drawer cash effect using the supplied active
   transaction. Courier-held cash retains its distinct custody behavior.
4. If the bill is fully settled,
   [receipt issuance](../../apps/api/src/modules/orders/receipts/order-receipts.ts)
   saves the receipt in the same transaction as the payment and settlement facts.
5. The operation saves its replay result. Reopening a receipt reads the stored
   snapshot; it does not reconstruct a receipt from subsequently edited products.

Ready website pickups call `PickupCollectionService.preparePickupCollection`
directly before collection,
and retain their storefront source. Refunds and physical item returns are separate
operations with separate money/stock meanings.

Useful checks: `pos-payments.e2e.test.ts`, the POS dining, shift reconciliation,
delivery and cash custody database suites. External terminal payments record
operator-confirmed movement; the API does not call a payment processor.

## Placing a website or Marketplace restaurant order

1. `/catalog/stores/:slug/orders` and its existing `/customer` variant enter
   [the storefront controller](../../apps/api/src/modules/orders/http/storefront/storefront-orders.controller.ts).
   The customer variant resolves the signed-in account or prepared browser guest
   through [customer order access](../../apps/api/src/modules/orders/customers/customer-order-access.service.ts).
2. `StorefrontOrdersService.create` in
   [checkout](../../apps/api/src/modules/orders/checkout/storefront-orders.service.ts)
   checks matching saved requests and ownership before returning a replay.
3. It reviews Catalog prices and opens the existing checkout transaction.
   Subscription eligibility is checked there.
4. [`saveCheckoutLine`](../../apps/api/src/modules/orders/checkout/save-checkout-line.ts)
   validates current product versions, saves line names/choices/prices and
   reserves finished stock or freezes ingredient requirements.
5. Checkout discount and restaurant operating/fulfillment policies determine the
   final total and receiving branch. A supplied reviewed total must still match.
6. The order total and applicable customer/guest access are saved with the stock
   and discount effects. The returned receipt confirms an order, not collected money.

Later acceptance/preparation/handover use
[`OrderLifecycleService`](../../apps/api/src/modules/orders/fulfillment/order-lifecycle.service.ts)
and its named action helpers. Routed web status operations require an open
receiving-branch shift; readiness is not inferred from elapsed time.

Useful checks: `storefront-orders.e2e.test.ts`, `restaurant-checkout.test.ts`,
`customer-order-access.test.ts`, `order-lifecycle.test.ts` and the website/recipe
database suite. Marketplace customer ownership and tenant-local customer
associations are different concepts.
