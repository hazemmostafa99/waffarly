# Business reports — manual acceptance

Status: **PENDING**, not a record of passed scenarios. Use existing known data or
an explicitly authorized disposable merchant. Do not create production financial
transactions just to exercise this checklist.

## Navigation and presentation

- Open `/reports` from Dashboard and Reports. Check Arabic/English, RTL/LTR,
  narrow/mobile layout, keyboard focus and chart data disclosure.
- Change month and branch, refresh, then use browser back/forward. An old request
  must not replace the newly selected scope. Export must use the displayed scope.
- Direct-open result/cash views. Current balances must say they are independent
  of the selected month. Verify archived and foreign-merchant branch handling.
- Confirm empty sources show a zero/empty state, failed reads show an error/retry,
  and missing financial data shows an incomplete state.

## Numeric reconciliation

For each scenario, record source identifiers, branch, Cairo dates, expected
amounts, observed screen/API/CSV amounts and the reviewer/date.

| Scenario                                           | Expected                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Known sale, discount and known consumption         | Saved revenue/cost match profitability totals and daily chart                                  |
| Refund in next month                               | Original recognized revenue remains in original month; reversal appears in refund month        |
| Unallocated refund                                 | Deducted once from total; visible warning explains mismatch with sum of product rows           |
| Cancelled unpaid POS sale with stock restored      | Revenue and cost excluded across totals, products, dimensions and chart                        |
| Online cancellation without stock restoration      | Revenue excluded; previously consumed cost retained                                            |
| Cancellation in later month                        | Historical management view restates; original snapshots remain unchanged                       |
| Missing historical cost                            | Affected cost/profit/operating result remain null; chart does not draw a zero for missing cost |
| Expense incurred in October, paid in November      | October operating expense; November cash payment; current unpaid falls once                    |
| Payment near Cairo month boundary / DST transition | Included in the correct local month, not UTC month                                             |
| Month with required payroll unapproved             | Staff cost and operating result incomplete                                                     |
| Approved pay with advance instalment               | Staff cost before the instalment; cash due after instalment; advance is not charged again      |
| Corrected/reduced/cancelled advance                | Current advance balance and safe ledger agree; no second subtraction                           |
| Inventory waste with saved cost                    | Deduct independent waste once, rounded per movement                                            |
| Physical customer item return                      | No duplicate expense for stock already consumed in the sale                                    |
| Unknown waste cost                                 | Waste and operating result incomplete                                                          |
| Supplier correction/return/partial settlement      | Due and supplier credit match the original invoice detail; no invented refund                  |
| Old unpriced confirmed invoice                     | Explicit incomplete supplier-balance warning; priced-only totals labelled                      |
| Drawer-to-safe handoff pending then received       | Removed from drawer once, pending shown separately, safe credited on receipt only              |
| Closed drawer carryover                            | Source reduced once; destination opening float counted once                                    |
| Cash receipt difference / unverified legacy drop   | Review notice, not added as confirmed available cash                                           |
| Courier payment and later remittance               | Held cash falls as drawer cash rises; no second revenue                                        |
| More than 8 expense categories / 100 product rows  | Remainder/truncation is clear; headline totals are unaffected                                  |
| Zero or negative previous-month baseline           | No fabricated percentage change                                                                |
| Negative operating result                          | Negative sign retained; review notice leads to the calculation                                 |

Finally reconcile daily net-sales/expense sums against monthly totals, channel
net-sales sum against total net sales, and category sums against expenses. When
monthly cost is incomplete, reconcile known costs separately and preserve null.
CSV names beginning with `=`, `+`, `-` or `@` must stay text; negative numeric
amounts must remain numeric.

## Remaining acceptance boundaries

Verify the read SQL against the actual migrated local schema, owner authorization,
tenant isolation and realistic data volumes. Do not mark manual acceptance passed
based solely on code inspection, formatting or the presence of unit-test files.

## Reference alignment acceptance (pending)

- Compare all five pages to `waffarly_reports_v2.html` at desktop and mobile sizes.
- Overview: four monthly metrics, chart/calculation columns, distributions and
  four current-balance groups. Verify current balances do not follow month changes.
- Toggle cost/expense series and chart/table. Missing costs remain gaps; negative
  sales retain their signs; exact values stay available in the table.
- Open/close calculation, balance, product and return drawers with keyboard,
  Escape and close buttons. Verify focus returns to the opener.
- Use shared report navigation with month and branch; verify resulting scopes.
- Select all seven demo scenarios, retry the demo error and export demo CSV.
  Confirm demo data never replaces real report responses or creates transactions.
- More than 25 closed shifts: summary counts/variance cover the full selected
  period and stay identical while advancing cursor pages. Reconcile positive,
  negative and zero variance and verify foreign-tenant branch rejection.
- Reconcile completed orders per cashier against saved non-cancelled POS orders
  created in the period. Unattributed activity stays in its own row.
- Shift/return CSV: current page, scope and dates are explicitly labelled.
  Product CSV: incomplete amounts and formula-like names remain safe text.
- Verify pending handoffs, unverified drops, receivables and confirmed safe cash
  stay separate. Missing supplier invoice values show their warning.

## Dashboard integration acceptance

- From the real dashboard's Reports sidebar, open each of the five existing
  entries. Each must render its corresponding new report inside the same sidebar,
  topbar and breadcrumbs; no separate report shell or preview destination.
- `/reports?view=result` and `?view=cash` open the combined report center rather
  than resurrecting old tabs. Calculation and current balances are on that page.
- Actual routes start with API data. Enter a labelled demo scenario, then navigate
  through the dashboard sidebar; the next report must return to actual API data.
- Preserve account/subscription navigation, mobile dashboard menu and sign-out.
- Remaining: validate the final embedded view and real response values with the
  authenticated owner session. Mobile layout is not yet visually accepted.

## Compact toolbar and recorded subtotals (pending)

- All five reports: no repeated page heading, scenario picker or timezone helper.
  Month/branch controls and Refresh/CSV share one row on desktop and wrap on mobile.
- Report center: no missing-cost/payroll banners, period intro or redundant footer.
- With mixed known/unknown costs, recorded cost equals the database sum of known
  consumption snapshots across the complete period, not the displayed product rows.
- Current gross profit = net sales minus recorded consumed cost. Current operating
  result then deducts recorded expenses, approved staff cost and known independent
  waste exactly once; incomplete coverage metadata remains unchanged in the API.
- Approve missing payroll or correct source costs, Refresh, and reconcile the new
  screen values and CSV against the new recorded response.
- Verify loss signs, no-activity zeros and chart daily known costs. Load failures
  remain errors with Retry; they must not become financial zero values.
