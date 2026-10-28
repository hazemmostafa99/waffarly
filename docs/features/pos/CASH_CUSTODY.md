# Drawer custody and safe receipts

Shifts owns branch safes, custody transfers and safe movements. The owner dashboard
has **Cash drawers & safes** (`/pos-cash`). The POS shift screen offers named safe
drops, remaining closed-shift custody and supervisor receipt. All amounts are EGP
decimal strings, calculated using integer cents.

## Workflow

1. The owner creates a branch safe with its physically counted opening balance.
   Historical drops and sales are not imported into that balance.
2. During an open shift the cashier selects **Cash dropped to safe**, destination,
   amount, reason and bag/handoff reference. Existing supervisor approval rules
   apply. Record the handoff when the cash physically leaves the drawer.
3. The drop reduces expected drawer cash and creates a pending transfer atomically.
   A pending transfer does not increase the safe balance.
4. A different person confirms the actual receipt: the owner in the dashboard or
   an active same-branch POS employee with `manage_cash_movements`.
5. The actually received amount credits the safe exactly once. A difference
   requires a note and remains visible for owner review. Reviewing it preserves
   the original amounts and does not credit recovered money; record any recovery
   as a separate deposit referencing the original transfer.

The cashier still counts blindly at close. Closing freezes expected cash, actual
count and variance; it does not transfer the counted money. Remaining custody is
visible in both interfaces and supports partial/full post-close safe handoffs.
These are separate records, never changes to the original close report.

Remaining closed custody = counted cash minus post-close handoffs and accepted
carryovers. Pre-close drops are already reflected in the expected count and are
not subtracted twice. Pending handoffs reserve their declared amount; receipt
differences remain separately visible.

When opening, the next employee may explicitly select a closed shift on the same
register, count its opening float and confirm physical acceptance. Opening and
source allocation commit atomically. The new shift counts this money once as its
opening float. Separately supplied new cash is another explicit source and does
not settle old custody. Unallocated custody remains visible after later shifts.

## Statements and compatibility

The owner's drawer statement includes opening float, cash sales/refunds, manual
cash-in/out/drop, received courier cash, count variance and later handoffs or
carryover. SQL calculates running balances before bounded pagination. Courier cash
still held outside the drawer is excluded. The safe statement includes opening
count, confirmed receipts, deposits and withdrawals. Withdrawals cannot overdraw
the safe. Events expose actor, time, reason/reference and balance after movement.

Legacy drops without a destination remain labelled as unverified historical
drops; they are never backfilled as received cash. For compatibility the existing
cash-movement API still accepts an absent `safeId`. The updated POS requires a
safe for new drops and preserves older saved commands for retry. Cashiers cannot
read safe balances or live expected drawer cash.

## HTTP and persistence

Owner routes under `/owner/pos/cash`:

- `GET/POST safes`, `GET drawers`, `GET transfers`.
- `GET drawers/:id/movements`, `GET/POST safes/:id/movements`.
- `POST shifts/:id/transfers`, `POST transfers/:id/receive`,
  `POST transfers/:id/resolve`.

POS routes under `/pos/cash`: `GET safes` (destinations only), `GET drawers`
(own closed shifts), `GET carryover` (closed same-register sources),
`GET my-transfers` (own handoffs and receipt status, including open shifts),
`POST shifts/:id/transfers`, and supervisor `GET transfers` /
`POST transfers/:id/receive?branchId=...`. Lists use scoped UUID cursors with at
most 50 results. Tenant identity comes from the authenticated actor.

Migration `20261027160000_pos_cash_custody` adds three tables with compound tenant
and branch foreign keys, unique request identities and amount/state checks.
Closed allocations lock the source shift, safe withdrawals lock the safe, and
receipts lock their transfer. Treasury mutations use serializable transactions;
concurrent changes return 409 for safe retry. Both frontends persist unresolved
commands before sending and reuse the same request after an ambiguous response.
Supervisor credentials never enter these saved treasury commands.

## Verification

`pnpm --filter @waffarly/api test:cash-db` covers pending/received balances,
tenant/branch isolation, blind-count privacy, immutable close reports, receipt
differences, exact retries, concurrent withdrawals and handoffs, carryover and both
statements. Fixtures clean up only their isolated tenants. `test:shifts-db` also
includes this suite; default API tests include HTTP boundary checks.

Build the merchant dashboard, then run
`pnpm exec playwright test --config playwright.cash-custody.config.ts` for
English/Arabic desktop/mobile owner receipt and network recovery plus POS shift
handoff/carryover regression checks. The suite uses isolated ports 5294/5295 and
`test-results/cash-custody`.

There is no bank integration, hardware drawer balance or automatic physical count.
Receipts are explicit attestations by authorized people.
