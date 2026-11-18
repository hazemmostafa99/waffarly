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
