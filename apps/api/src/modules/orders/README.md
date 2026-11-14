# Orders: where each responsibility lives

Orders remains one Nest business module. HTTP entry points are grouped by the
application using them; business operations are grouped by what they do. Disk
paths do not change HTTP URLs, request/response contracts or order source values.

| Folder             | Responsibility                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `http/storefront`  | Public storefront quote and order submission, including the existing identity-aware Marketplace checkout endpoint. |
| `http/marketplace` | Customer/guest order session, history, details and explicit claim.                                                 |
| `http/pos`         | Cashier sales, order operations, dining, delivery and saved receipt endpoints.                                     |
| `http/owner`       | Owner order operations, customer association and return reports.                                                   |
| `checkout`         | Storefront checkout validation, quote, submission and existing legacy status command.                              |
| `pos-sales`        | Cashier quote/create, active-sale/detail/payment-state reads and immutable sale references.                        |
| `fulfillment`      | Acceptance, preparation, readiness, handover, cancellation and branch operation queues.                            |
| `kitchen`          | Kitchen dispatch, additional items and cancellation acknowledgement.                                               |
| `dining`           | Table configuration, table sessions, attachment and moving sessions.                                               |
| `billing`          | Check allocation, pickup collection preparation, payment and monetary refund commands.                             |
| `receipts`         | Immutable check receipt issuance, saved snapshot parsing and receipt history.                                      |
| `delivery`         | Existing POS delivery queue, dispatch/failure/completion and courier remittance.                                   |
| `returns`          | Physical item returns and their informational waste reports.                                                       |
| `customers`        | Customer/guest ownership and access; separately, merchant-local customer associations.                             |
| `stock`            | Frozen stock requirements, inventory consumption and restoration.                                                  |
| `mapping`          | Existing order receipt/summary transport projections.                                                              |

## How an operation runs

Storefront submission goes through `http/storefront` to `StorefrontOrdersService`.
Marketplace submission uses the existing `/customer` checkout variant, resolves
account/guest identity, and uses the same checkout transaction. Marketplace does
not have a duplicate order engine. Existing legacy storefront submission keeps
its different ownership behavior.

Cashier commands go through `http/pos` to the thin `PosOrdersService` entry point.
It delegates to named operations: `createPosSale`, `amendKitchenOrder`,
`preparePickupCollection`, `recordCheckPayment` and `recordCheckRefund`.
`getPosSaleDetails`, `getOrderPaymentState` and `listActiveSales` handle reads.
The entry point retains its constructor and method signatures for existing callers
and fixtures; business execution no longer lives in that class.

Operations receive only the dependencies they use. These are ordinary typed
functions, not additional Nest modules or service-locator abstractions. The
operation owns its existing transaction. Receipt issuance accepts that active
transaction directly, so settlement and its immutable receipt commit together.
Dining delegates check splitting to `billing/split-order-checks.ts`; storefront
lists delegate to `fulfillment/order-queue.query.ts`.

## Rules for future edits

- Put HTTP parsing and actor extraction in controllers. Keep database access in
  the operation/service. Request schemas remain in the owning feature folder.
- Name files after a business operation and functions after the action performed.
  Avoid adding unrelated behavior to a general order service or a utilities file.
- Keep calculations and replay readers beside the operation they support. Share
  only an actual common business rule, not superficially similar workflows.
- Keep command-specific replay checks, error shapes, tenant and branch predicates,
  revision checks, isolation levels and lock order intact.
- Nested persistence helpers use the supplied transaction. Never silently start
  another transaction or use the root client for part of an atomic command.
- Payments owns tender recording; Shifts owns shifts/cash journals; Inventory
  owns its ledger; Catalog owns product pricing. Orders coordinates their public
  APIs. Cross-module imports continue through each module's `index.ts`.
- Use short English comments for significant steps and reasons, especially
  transaction/lock/replay constraints. Do not narrate every assignment.
- Do not rename Prisma models or shared transport contracts as part of folder
  cleanup. `StorefrontOrder` currently stores both storefront and POS orders.

## Scope and remaining cleanup

This is a structural refactor, not a change in order behavior. The checkout,
lifecycle, delivery and return coordinators still contain substantial business
transactions. Further extraction should target a concrete independent rule;
splitting a transaction into fragments merely to meet a line limit adds indirection.
Customer access still combines guest-session handling and customer reads, and the
POS dining controller file still contains owner table routes. These are explicit
remaining cleanup areas rather than a claim that every boundary is complete.

## Manual acceptance

No automated checks, build, typecheck, lint, tests, database commands or real
financial actions were run for this refactor. Source formatting is not behavioral
verification. Existing test imports were updated to the moved implementations.
Use a disposable local merchant and known fixtures for manual acceptance:

1. Quote and submit storefront and Marketplace orders. Retry the exact request;
   confirm one order and the original receipt. Try a changed payload with that
   request ID; confirm rejection.
2. Confirm subscription, operating-hour, fulfillment, unavailable-stock and
   reviewed-price rejection behavior remains visible. Check the receiving branch.
3. Create a cashier sale, reopen it, dispatch and amend its kitchen ticket, then
   follow acceptance/preparation/readiness/handover. Check quantities and stock.
4. Attach a dining sale, move the session, and split its check. Confirm exact
   totals and rejection of allocation changes after payment begins.
5. With an authorized test shift, prepare a ready web pickup for collection;
   confirm its source remains storefront. Record an explicitly authorized test
   payment, inspect the saved receipt, and retry that exact command only.
6. Exercise authorized test refunds and separate item returns; confirm refunds
   affect cash/payment history while item returns retain informational waste value.
7. Check POS delivery queues/remittance, branch restrictions, and owner queues.
8. Check customer/guest history, details and explicit claim. Confirm a different
   customer or merchant cannot read or claim an unrelated order.

Financial and inventory outcomes remain manually unverified until these flows
are reviewed by the operator.
