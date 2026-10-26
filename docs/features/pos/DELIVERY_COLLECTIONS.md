# POS delivery collections across shifts

Approved direction: 2026-10-26. Implements an explicit delivery-only exception to
POS-D05 (unpaid close block) and POS-D06 (paid handover). All other fulfillment
types keep their current gates. Preserve POS-D07: shared register shifts and
individual operator attribution.

Orders owns delivery dispatch, manually confirmed customer delivery/failure,
custodian assignment and courier cash remittance. Payments owns immutable customer
tenders. Shifts owns drawer reconciliation and immutable close/handover snapshots.
Extend the existing modules; do not introduce a reverse Shifts -> Orders import.

## Money and attribution

- Order creation keeps its original shift/operator. A tracked delivery can receive
  a later drawer payment into an explicitly selected open same-branch shift.
- A cash customer payment may be recorded as `cashCustody=courier`. Its shift is
  the original order's attribution, even when closed; it never posts drawer cash.
  Terminal payments never use courier cash custody.
- Courier remittance references an original courier-held payment, supports partial
  receipt, and posts only the actual received amount into the receiving open shift.
  It is not another payment/sale. Customer collection and drawer receipt are
  separate report measures. Refund of courier-held cash requires full remittance
  first, then uses the existing approved original-payment refund workflow.
- Delivery completion and customer settlement are separate. Only ready tracked
  delivery orders can leave with a courier. Delivery success can be confirmed while
  COD remains due. Failure records a required reason, changes neither money nor
  inventory, and remains visible for supervisor follow-up/re-dispatch.

## Shift close and responsibility

Ordinary unpaid checks continue to block close. Tracked dispatched deliveries may
be carried forward only with an explicit handover, a different active supervisor's
`approve_shift_close` approval, and a named different active same-branch employee
with sell/register permission. Freeze order/check balances, courier-held cash,
courier name/status and recipient/approver names in the close report. The old
report never changes when collection happens later. Cash outside the drawer is
never counted as drawer cash or variance.

The recipient can explicitly accept follow-up into a new open same-branch shift.
While the current follow-up shift is still open, moving it or receiving its cash
into a different drawer is rejected: close with an approved handover first. This
prevents an ordinary claim/payment from bypassing the frozen handover record.
An authorized supervisor can take over. Receipt of partial courier cash also binds
remaining follow-up to the receiving shift. No open next shift is required when
the previous shift assigns a named responsible recipient.

## Safety and acceptance

Every write is merchant/assigned-active-branch scoped, currently authorized,
revision checked, actor-bound and replayable with an exact request ID. Lock shifts
before orders before delivery/payment rows; close takes an exclusive shift lock.
Cash receipt and its audit action commit atomically. Never persist credentials in
recovery storage. Keep a bounded server queue accessible across devices and show
uncertain writes with an explicit exact retry.

Required evidence: cross-shift COD, partial customer payment/remittance, mixed
prepayment, failure/re-dispatch, normal unpaid close blocking, exact retry after a
lost response, foreign tenant/branch/recipient denial, concurrent receipts and
close-vs-payment/remittance rollback/serialization, unchanged old reports and
single-counted operation/shift aggregates. Preserve existing receipts/refunds,
stock, storefront and dining tests. Test Arabic/English UI and mobile layout.

## Implemented operator flow

1. Open **Delivery follow-up** (`/deliveries`) as an assigned cashier/supervisor.
   Pick the branch and the drawer that will physically receive cash. Outgoing
   delivery candidates are ready POS delivery orders; enter a courier name/reference.
2. Record **delivered to customer** or **failed**, with a mandatory failure reason.
   Both events are distinct from customer payment. Outgoing tickets move out of the
   kitchen queue into delivery follow-up. A failed order remains ready for explicit
   redispatch; no inventory restoration, cancellation or refund is implied.
3. Record a customer cash payment as **paid to courier**. It settles the check and
   can issue its ordinary customer receipt, labeled courier custody. Drawer cash
   remains unchanged. Direct drawer cash or confirmed manual-terminal payment uses
   the selected open same-branch shift. No payment-provider integration was added.
4. In `/shift`, ordinary unpaid checks still block close. For pending tracked
   deliveries, enter the receiving employee's username and different supervisor's
   credentials, then submit the physical count. Outside cash is shown separately
   and is excluded from the drawer expectation. Up to 500 pending deliveries can be
   frozen into one handover; larger sets must be reduced before close. Count and
   exposure totals are SQL aggregates over the complete pending set, not the page.
5. The named employee signs in, opens the next shift, and accepts follow-up into
   that shift. Receive courier cash against the original payment, fully or partly.
   Only received cash increases that drawer. A branch supervisor may take over.
6. **Include completed follow-up and receipt history** makes resolved deliveries
   visible again. Receipt history shows amount, receiving employee, shift and time.
   Queue pages are 25 by default, maximum 100, with tenant/branch-scoped cursors.
7. An uncertain action stays saved for an explicit exact retry after reload. The
   server can confirm an already committed result. Dismissing a definitively rejected
   action reserves its request ID under the order lock, preventing a late original
   write from committing after the recovery is cleared. Credentials never enter
   the delivery recovery or saved shift-close command.

Owner **POS Shift Reports** adds courier cash received and frozen handover details.
**POS Operations** separates customer cash paid to couriers from drawer receipts,
and attributes receipts to the receiving employee, including CSV. Remittances never
increase sales, customer collections or net collected a second time.

## Rollout and acceptance

Migration `20261026090000_pos_delivery_collections` is additive and preserves
historical amounts/custody. It was applied only to the configured development
PostgreSQL `waffarly` at `localhost:5433`, without reset. There are 54 migrations.
Deploy contracts/database/API before clients. Existing payments default to drawer
custody; old orders are not automatically assigned couriers or new responsibilities.
After real remittances exist, rolling back to old financial code requires an
explicit reconciliation plan; old code does not understand the new drawer entries.

Local automated verification (2026-10-26):

- API typecheck/lint/build and default HTTP/unit suite: 194/194 passed.
- POS typecheck/lint/build and unit suite: 33/33 passed.
- Merchant dashboard typecheck/lint/build passed; shared contracts/UI built.
- PostgreSQL: `test:shifts-db` 3/3 (now includes opening concurrency and delivery),
  `test:pos-db` 2/2, `test:pos-returns-db` 2/2 and `test:storefront-orders-db` 6/6.
- Shift/delivery Playwright runs use intercepted API responses on desktop/phone;
  final shift/delivery result: **34/34**; owner report result: **10/10**.
  they are separate from real PostgreSQL transaction evidence. The new tests cover
  English/Arabic balance/custody display, lost-response reload/replay, named close
  handover without credential storage and safe rejection dismissal. Owner report
  tests additionally exercise frozen recipient details and separate CSV amounts.
- Existing Vite large-chunk advisories remain. No production deployment, physical
  drawer/printer check, real courier payment, or cashier/operator acceptance occurred.

An intermediate parallel browser run collided on the default shared trace folder
(ENOENT during context teardown, with no assertion failure). The final POS suite
was rerun with `--output test-results/delivery-pos-ui` and passed 34/34; the final
owner suite passed 10/10 with explicit handover/CSV fixtures.

Manual acceptance remains pending. With disposable data, create a 300 EGP ready
delivery in shift A with 50 EGP float; dispatch it and close A with an approved
handover to B. Confirm A expects 50 EGP and freezes 300 EGP customer due. Open B
with 20 EGP float; claim the delivery, confirm delivery, record 200 EGP paid to the
courier, receive it in parts (75 + 100 + 25), then receive the remaining 100 EGP
customer payment directly into B. B must expect 320 EGP, A must remain unchanged,
and Operations must report 300 EGP collections plus a separately labeled 200 EGP
courier-to-drawer transfer. Repeat failure/redispatch, supervisor denial, partial
payment, reload during a lost response, both themes, Arabic/English and the target
touchscreen. This manual gate is not replaced by mocked browser tests.
