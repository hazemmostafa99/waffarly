# Business reporting center

Date: 2026-11-18. Status: **IMPLEMENTED IN SOURCE — MANUAL ACCEPTANCE PENDING**.

## Owner experience

`/reports` is linked from the Reports sidebar and the existing dashboard. Its
shareable URL contains `month=YYYY-MM`, optional `branchId`, and `view`:

1. Overview: monthly metrics, previous-calendar-month comparisons, daily net
   product sales/consumed-cost/expense chart, sales channels and expense categories.
2. Result: the ordered calculation, costs and product gross-profit ranking.
3. Cash: current safe balances, drawer custody, pending safe handoffs, courier-held
   cash, recorded obligations, open check balances, staff advances and supplier credit.

All views support Arabic/English and RTL/LTR. Charts have named series, exact
amounts and an expandable data table. Negative amounts retain their sign. Missing
costs are gaps, not zero points. Metrics distinguish incomplete data from zero.
Errors and loading states do not substitute invented financial values.

Month/branch selections are carried into the product-profit report and expense
workspace. Payroll links carry the month because the existing payroll workspace
is merchant-wide. Cash-management links open their existing workspaces; current
balance summaries are explicitly independent of the selected reporting month.

## Metric dictionary

| Metric                      | Source and date                                                                  | Meaning                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Product revenue             | Saved order-line recognized revenue and recognition time                         | POS sale confirmation / online acceptance; discounts already allocated           |
| Refund revenue              | Item-attributed reversal amounts, or refund amount when unallocated; issued time | Deducted once; unallocated refunds also appear separately                        |
| Net product sales           | Recognized product revenue minus refund revenue                                  | Excludes delivery fees and collection timing                                     |
| Consumed stock cost         | Saved line cost and consumption timestamp                                        | Existing latest-confirmed-purchase policy; never recomputed from current recipes |
| Product gross profit        | Existing profitability report                                                    | Net sales minus consumed cost; incomplete when included sale cost is unknown     |
| Operating expenses          | `MerchantExpense.amount`, `incurredOn`                                           | Independent of payment date; branch scoped                                       |
| Staff cost                  | Approved/paid payroll month, frozen branch line                                  | Base pay + additions − recorded manual deductions; before advance repayments     |
| Separate waste              | Inventory `waste` batches, movement time                                         | Sum of individually rounded absolute base quantity × saved unit cost             |
| Recorded operating result   | Gross profit − expenses − staff cost − separate waste                            | Management subtotal of recorded product operations, not complete net profit      |
| Current supplier due/credit | Confirmed invoice value + corrections − credit notes − allocated payments        | Positive payable and negative credit separated, priced invoices only             |
| Current expense due         | Expense amount minus all recorded payments                                       | All dates, current state                                                         |
| Current payroll due         | Approved frozen net due minus all salary payments                                | Advances already deducted; unapproved pay is not included                        |
| Current advances            | Non-cancelled corrected amount minus approved repayments                         | Receivable, never an operating expense                                           |
| Open check due              | Non-cancelled recorded bill amount minus tender payments                         | Recorded checks only, not a complete customer receivables ledger                 |

An independent inventory waste batch is deducted separately. Physical customer
item returns describe products already consumed by the original sale and are not
deducted again. Cash refunds alone do not reverse consumed stock cost.

Staff cost is incomplete if an employee whose employment overlaps the month and
selected branch lacks an approved frozen payroll line. No employees means no
required payroll cost. Manual deductions retain the existing payroll semantics;
the system does not infer tax/insurance withholding classifications.

## Cancellation and historical interpretation

Cancelled/rejected revenue is excluded using the order's **current** status.
Consumed cost is excluded for a cancelled order only when its stock was restored;
otherwise the saved consumption remains a cost. The same predicates apply to
product rows, totals, dimensions and the daily chart.

This is a recalculable management report, not an immutable accounting close.
Cancellation can restate the original sale period. Existing expense edits can
also change historical results. No cancellation journal, synthetic cash movement,
backfill or historical snapshot rewrite is introduced. Revenue and consumption
can fall in different periods under the existing recognition policy.

Comparison is against the complete previous calendar month, not an equal-length
period-to-date. In-progress months are labelled. Percentage changes are omitted
for incomplete amounts and zero/negative previous values.

## Cash custody

Drawer custody mirrors the existing ledger: opening float + signed cash-sale and
refund movements + courier remittances + manual cash-in − cash-out/drop + physical
close variance − post-close handoffs/carryovers. Pre-close drops are already
debited and are not subtracted a second time. Pending handoffs are shown separately
and do not credit safes before receipt. Open drawers are expected amounts, closed
drawers incorporate the recorded count.

Safes sum signed existing safe movements. Courier cash is original courier-custody
payments minus recorded remittances. Supplier payments allocate existing cash
withdrawals and are not deducted again. Historical unverified drops and unresolved
receipt differences are surfaced separately; they are not fabricated as available
cash. No total mixes confirmed cash, expected custody and receivables.

Bank/terminal settlement balances, legal financial statements, delivery income,
commissions, depreciation, tax calculation, missing/unrecorded expenses, inventory
accounting valuation and a full customer credit ledger are outside this release.

## Architecture and data flow

`GET /owner/reports/business?month=YYYY-MM&branchId=...` uses `OwnerGuard` and derives
`merchantId` from the authenticated owner. Strict query validation rejects a
caller-supplied tenant identity. Branch metadata includes archived branches so
historical records remain selectable. Foreign-merchant branches fail with 404.

`BusinessReportService` owns one RepeatableRead read transaction, composes the
existing profitability service and focused SQL query functions, and returns
`OwnerBusinessReport`. Every query scopes its source records and joins by tenant.
It does not call private helpers from other business modules, add dependencies,
modify database structure or perform writes.

Monthly charts contain at most 31 days. Expense categories include the top eight
plus an aggregated remainder. Product rows use the existing 100-row bound;
headline totals remain independent of row limits. CSV contains the returned rows,
scope, generated time, calculation basis and completeness/truncation markers.
Text cells are protected against spreadsheet formula injection.

Frontend ownership:

- `BusinessReportsPage`: URL scope, request lifecycle, status/quality notices.
- `BusinessReportOverview`, `BusinessReportResult`, `BusinessReportCash`: focused views.
- `ReportComponents`: reusable metrics, panels, bars, notices and trend chart.
- `business-report-presenter`: ordered result explanation.
- `report-helpers`: exact decimal display, comparison, links and CSV encoding.
- `business-report-export`: export layout; no duplicate financial calculation.

## Delivery and verification

- Source implementation and formatting completed; formatting is not runtime QA.
- Added focused unit cases for calendar boundaries, losses, incomplete data and
  strict query scope. **Not executed**, following the no-automated-checks preference.
- No tests, typecheck, lint or build were run. No migrations or financial writes.
- An in-app browser request to `/reports` reached `/login`; the separate preview
  has no authenticated session. No credentials were read or entered. Charts and
  API query results have **not** received visual/runtime acceptance.
- A later attempt to inspect the existing desktop browser session failed because
  the computer-use continuation expired. It did not produce a usable observation
  or establish acceptance.
- Follow [MANUAL_QA.md](MANUAL_QA.md) in an authenticated, authorized local session
  before marking this feature complete or relying on its totals operationally.


## Compact report redesign — 2026-11-18

User-approved presentation update: Noto Sans Arabic replaces IBM Plex Sans Arabic
in the merchant dashboard, with explicit numeric/native-control inheritance.
Shared report styles reduce headings, card heights and filter dimensions across
business, product-profit and POS reports. Filters and actions share a toolbar;
calculation explanations are collapsed, missing-data notices are consolidated
and omitted from the unrelated cash view. Current obligations use numeric lists;
daily sales use columns with cost/expense lines and exact values in the data table.
Unavailable amounts are named explicitly rather than drawn as empty bars.
Business calculations and API contracts are unchanged.

Source review and formatting completed. No automated tests, typecheck or build
were run, following the existing preference. Authenticated visual acceptance
remains pending; this entry does not claim the rendered result was verified.

## Reference report alignment — 2026-11-18

The report overview now places daily chart/table and the operating calculation
side by side, followed by channel/expense distributions and four current-balance
groups. The calculation and balances have explanation drawers; product and return
rows open their recorded details in drawers. Existing result/cash deep links remain.
All five reports share navigation and an explicitly labelled scenario preview.
Preview fixtures never replace server responses or create business transactions.
The seven preview scenarios cover complete, missing cost, unapproved payroll,
empty, negative, loading and error states. Preview CSV is labelled separately.
POS adds an overview showing all existing detail sections and completed orders
per cashier. Shift and return exports explicitly cover the current cursor page.

Shifts owns additive full-period summary metadata on its existing owner report
response: closed/matched/differing counts and net variance. List and aggregate
reads share a RepeatableRead transaction and tenant/branch/date predicates;
summary totals are independent of pagination. Reports owns the additive cashier
completed-order count using the same cancellation predicate as overall completion.
No schema migration, financial writes or new dependencies were introduced.

Verification: source formatting completed using locally installed Prettier.
The package-manager wrapper could not fetch its pinned version, so formatting
used the installed library directly. No tests, lint, typecheck or build executed,
following the existing preference. The existing POS unit fixture/expectations
include the additive completed-order field. Added shift summary scope/snapshot and
foreign-branch rejection unit cases. These tests were not run. Native browser
inspection was denied with "Computer Use was not approved to use Google Chrome".
Visual, runtime, SQL and numeric reconciliation acceptance remain PENDING.

## Replacement in the existing dashboard — 2026-11-18

This section supersedes the earlier presentation notes. The five original
sidebar destinations now render `ReferenceReportsPage` through the ordinary
`MerchantLayout` Outlet. The existing dashboard sidebar, topbar, breadcrumbs,
authentication, subscription notice and account controls remain the enclosing UI.
There is no report-only shell, extra sidebar, separate app or production preview
route. The old report view tabs are replaced by the supplied reference's content.

Sidebar mapping:
- `/reports`: monthly report center, calculation, daily chart and current balances.
- `/pos-shift-reports`: closed shifts, full-period KPIs and review drawer.
- `/pos-item-returns`: physical returns and their recorded details.
- `/pos-operations`: POS orders, collections, preparation and cashier activity.
- `/profitability`: product/category/branch profitability.

`ReferenceReportsWorkspace` selects the screen from the existing pathname.
`useReferenceReport` performs the existing owner API reads and aborts stale
requests. Reference CSS is scoped under `.reports-v2`; embedded mode delegates
outer page padding/navigation to the dashboard. The supplied HTML's content
layout, card dimensions, tables, controls and drawers were ported to React.
Demo scenarios are entered explicitly; normal routes start with real API data,
and navigating to another report leaves demo mode.

Manual UI review observed all five screens in an isolated, explicitly labelled
fictional-data preview. Chart/table switching and calculation/product/shift/return
drawers were observed, including Escape dismissal and missing-cost presentation.
The supplied original HTML was opened alongside the React preview for comparison.
This establishes preview-level behavior only. The in-app browser has no owner
session and redirects the actual `/reports` route to `/login`; authenticated
API totals/reconciliation and the final embedded layout remain pending.
The viewport override did not change observed width, so mobile acceptance is
not claimed. No automated tests, lint, typecheck or application build were run.
Temporary public preview assets were removed after the review.

## Compact real-data reporting — 2026-11-18

User-approved update superseding the scenario-preview and completeness-notice UI:
removed the repeated title/eyebrow/description, scenario picker and fixtures,
period/timezone helper copy, missing-cost/payroll notices and overview intro/footer.
Month/branch controls and Refresh/CSV actions now share one responsive toolbar.
The dashboard's existing breadcrumb remains the page identifier.

Reports now exposes additive recorded-cost/gross-profit/margin subtotals from the
existing database aggregates, across all rows. Canonical complete-only amounts
and completeness metadata remain unchanged. Business periods add `recorded`
with known consumed cost, current gross profit, recorded approved payroll cost,
known independent waste and the corresponding current operating result. Daily
points also expose their known consumed-cost subtotal. No migrations or financial
writes are performed, and unknown amounts are never filled with an invented zero.

Presentation and CSV select those recorded subtotals when complete-only amounts
are null. Cards say Recorded cost / Current profit / Current operating result.
Updating source records and refreshing recomputes the amounts. Export retains
scope and coverage metadata so recorded subtotals are not represented as a final
accounting close. Missing data from older server versions remains a dash.

Added rule coverage for partial recorded costs/payroll/waste, preserved canonical
nulls and old responses without recorded subtotals. Expanded profitability
assertions for totals/products/dimensions. Tests were not executed; no automated
checks, typecheck or application build run per the existing preference.
Final authenticated visual/data acceptance remains pending.
