# Merchant subscriptions

Implemented 2026-10-28 following the owner's request for independent 1/3/6/12/24-month prices and approval of the proposed administration workflow. This specification supersedes the monthly-only and first-month-timestamp access rules in earlier discovery documents.

## Offers and coverage

- Existing monthly offers retain their IDs, monthly prices and EGP currency. Optional 3, 6, 12 and 24-month prices are independent total amounts. An unavailable offer cannot be assigned, activated or renewed; existing paid coverage remains intact. No commercial prices are seeded.
- Each merchant has one subscription account, created by a database insert trigger, including merchants approved through applications. Super Admin creation can assign an offer/duration atomically with merchant and owner provisioning. Assignment does not activate access or record payment.
- Each paid period snapshots offer ID/name, duration, total price, credit, collected amount, start, original end and effective coverage end. Editing offers never rewrites these snapshots.
- Months are calendar months in Africa/Cairo, clamped to the final day of the target month. Repeated wall times use their earlier occurrence; nonexistent spring-forward wall times move forward. Timestamps are stored in UTC. Coverage is start-inclusive/end-exclusive.
- Activation starts a new paid period now, after explicit external collection confirmation. Prices use decimal strings and integer cents; zero prices are supported. No payment provider, invoice, tax, refund, or automatic collection is introduced.

## Lifecycle and administration

Stored account states are pending, active, suspended, cancelled and legacy. Active without current paid coverage is reported as expired, without depending on a background job.

| Action          | Behavior                                                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assign          | Pending/legacy accounts only; choose an available offer and duration.                                                                                                                                                                                                                                                  |
| Activate        | Pending, legacy or cancelled accounts; review price/dates and confirm external collection. Starts now.                                                                                                                                                                                                                 |
| Renew           | Active/expired accounts with renewal enabled. Early renewal starts after all existing paid coverage; late renewal starts now. Choosing another offer schedules a prepaid change. Only one future renewal may be queued.                                                                                                |
| Change now      | Active current coverage, without a queued renewal or scheduled cancellation. Replace remaining coverage with a new term starting at the reviewed quote instant. Credit is the remaining fraction of the old period's snapshotted price, rounded down to cents. Credit plus newly collected money equals the new price. |
| Suspend         | Active/expired/legacy accounts. Stops new operations immediately on subsequent authorized requests. Time continues.                                                                                                                                                                                                    |
| Resume          | Suspended only. Retains the existing dates; expired coverage stays expired. A suspended legacy account returns to legacy review.                                                                                                                                                                                       |
| Cancel now      | Stops all current/future coverage. Original period end dates and collections remain in history. No refund is inferred.                                                                                                                                                                                                 |
| Cancel at end   | Preserves every already-paid period; blocks additional renewal. Access expires at the last coverage end.                                                                                                                                                                                                               |
| Restore renewal | Removes scheduled cancellation; never creates paid coverage itself.                                                                                                                                                                                                                                                    |

Immediate changes requiring a negative collection/refund are rejected; use a change at renewal. Immediate quotes are valid for five minutes. Every financial command checks the expected subscription revision, offer revision and exact reviewed amount; immediate changes recompute credit at the reviewed instant. Administrative actions require a reason or collection reference.

## Access and existing work

Auth depends on the Subscriptions core module for current eligibility on every owner/POS request, including existing sessions. Authentication remains separate: inactive owners can sign in and read records, and a notice explains renewal/reactivation. Pending owners cannot configure their business or create employees/products. Inactive POS sessions can read records and settle existing work, but cannot quote/confirm new sales, amend order lines, or open shifts.

The explicit recovery route allowlist permits existing check payments/refunds, order acceptance/preparation/readiness/handover/cancellation, kitchen dispatch/cancellation acknowledgements, check splitting, shift close/cash movements, delivery reconciliation and cash custody receipt/transfer actions. Existing permission and tenant guards still apply. Unlisted writes, including configuration and new sales, remain blocked. Requests already admitted before suspension may finish; public checkout additionally checks eligibility under a merchant shared lock in its write transaction, serializing against subscription actions. Public browsing remains available.

The historical `activate-first-month` route now returns a conflict directing callers to subscription management. Updating its timestamp cannot override a suspended/expired/cancelled subscription. New activation maintains the timestamp only for historical compatibility; it is not the authority for access.

## Migration and review

Migration `20261028120000_subscriptions` is additive. Existing activated merchants receive `legacy` status and retain access. Unactivated merchants receive `pending`. No historical price, receipt, coverage start/end or debt is invented. The admin dashboard lists legacy accounts separately for review; assigning a plan alone preserves legacy access. A newly collected term can then be activated. Historical paid-date correction/backdating is not exposed by this release; legacy accounts remain available for manual commercial review instead of receiving a guessed expiry.

## Ownership, API and consistency

The `subscriptions` business module owns accounts, timing, eligibility, pricing quotes, period snapshots and administration events. It has no Auth dependency. Plans owns the guarded administration controllers and catalog definitions; Auth and Merchants consume the Subscriptions public entry point. Orders consumes it for transactional public checkout enforcement. This keeps the module graph acyclic.

| Route                                                | Contract                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing `/admin/plans` create/list/update           | Adds optional `terms` and `available`; omitted update fields preserve current terms/availability. One-month price remains `monthlyPrice` for compatibility. |
| `GET /admin/subscriptions`                           | 50-record keyset pages; optional merchant search, status, current plan and seven-day expiry filters.                                                        |
| `GET /admin/subscriptions/dashboard`                 | Database aggregates for effective states, expiring coverage and recorded external collections. Collection totals are not recurring revenue.                 |
| `GET /admin/subscriptions/:merchantId`               | Current state, assignment, latest 50 periods/events and older-history cursors.                                                                              |
| `GET /admin/subscriptions/:merchantId/history/:kind` | 50-record pages of periods/events; history cursors must belong to that merchant.                                                                            |
| `POST /admin/subscriptions/:merchantId/quote`        | Server-calculated price, credit, collection due, dates, action and offer/subscription revisions.                                                            |
| `POST /admin/subscriptions/:merchantId/actions`      | Validated action, revision, request UUID and reason; monetary actions require reviewed amount/offer revision and external collection confirmation.          |

All administration routes require AdminGuard. The merchant path is the account scope; request bodies cannot substitute another tenant or administrator. Merchant summaries include effective `subscriptionStatus`; OwnerProfile includes nullable historical activation and effective subscription status.

Actions lock the merchant row before checking request IDs/revisions and write state, coverage and attributed events in one transaction. Offer rows are share-locked during purchase so concurrent price edits cannot silently change a confirmed offer. Identical request retries return their original saved result; reuse with different facts/actor conflicts. History and dashboard queries are bounded/aggregated. Events preserve action, actor, reason, timestamp and collection independently from mutable offer prices.

## Verification

The admin UI separates the filtered account overview from the selected merchant's
workspace, preserving filters when returning. Four compact summary cards highlight
active coverage, upcoming expiry, legacy review and recorded collections; status
filters retain the full state breakdown. The workspace prefills an available
assigned plan, presents independent duration prices as keyboard-accessible radio
cards, and keeps the server-reviewed amount, dates and collection confirmation in
one review panel. Changing the action, plan or duration clears the prior review
and collection confirmation. Action-specific buttons explain the final operation;
history is available in an expandable section. Arabic labels, currency, RTL layout
and compact checkbox alignment are covered by desktop/mobile browser checks.

Focused unit tests cover calendar/DST boundaries, integer credit and recovery route authorization. HTTP tests cover Admin authentication, validation and bounded query contracts. Database tests cover independent term prices, activation, renewal, price snapshots, suspension/resume, cancellation, immediate changes, stale revisions/quotes, effective expiry, existing owner sessions, foreign history cursors and concurrent/duplicate commands. Public checkout regression runs against the migrated database. UI tests cover duration editing, reviewed collection, renewal, stop/resume and cancellation in desktop/mobile layouts and Arabic.
