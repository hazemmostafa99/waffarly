# Inventory UI and UX delivery

## Direction

Help merchants understand current stock, identify problems, and complete the next
operation. Keep stock identities, purchasing, opening balances, and the movement
ledger distinct. See [FEATURE.md](FEATURE.md) for business rules and
[PROGRESS.md](PROGRESS.md) for the underlying feature delivery.

## Phase 1 delivery — 2026-10-18

- Increase inventory text, control, badge, and table readability. Strengthen muted
  text contrast, align search actions, and improve mobile empty states.
- Use the inventory header/navigation on the branches and warehouses page too.
- Localize item-page counts, preserve pack equation direction in RTL, and add
  clear-filter actions to item, supplier, and purchase lists.
- Keep the selected purchasing subtab in the URL (`?tab=suppliers`). Make the page's
  primary action reflect the selected subtab.
- Give purchase creation and draft editing dedicated URLs and a full-page workspace.
  Provide separate Save draft and Save and review actions. Field errors sit beside
  the inputs, unsaved form state recovers from this browser, and saved review can
  return to draft editing. Only explicit receipt confirmation changes stock.
- Create suppliers inside purchase entry and automatically select the created
  supplier. Cancel/error/retry preserve the surrounding purchase fields.
- Enable existing inline Stock Item creation in purchases and opening entries.
  Item creation still creates no balance.
- Add server-side movement filtering by item, kind, and condition, alongside the
  warehouse filter. Changing filters resets cursor pagination. Localize known
  movement types and show signed changes.
- Replace the immediate negative-stock toggle with explicit options and Save.
  Keep the current merchant-wide policy and revision contract.
- Explain that opening entries add quantities rather than replacing a count.
- Adapt the empty stock overview to the merchant's active warehouses and stock
  items. Prioritize location setup, first-item creation, or opening stock as
  appropriate, and preselect the sole active warehouse when there is exactly
  one.
- Add explicit retry states to balance, movement, branch, stock-item, purchase,
  and supplier lists. Failed list requests no longer look like genuine empty
  results.

This slice uses existing API contracts. It adds no schema changes, stock posting
rules, costs, supplier settlement, or speculative stock-health totals.

## Phase 2 delivery — 2026-10-19

- Add a stock-health page with bounded item-location rows, warehouse/search filters,
  and server-calculated counts for the complete filter scope rather than the current
  cursor page. Counts describe configured item/warehouse pairs only.
- Configure revisioned reorder points per active stock item and warehouse. Compare
  only Available quantities, in the item's base unit; missing balances count as zero.
- Add stock-item detail pages showing balances by condition and paged movement
  history. Add movement detail pages with the recorded source, reason, entered
  quantity, base-unit change, actor, location, and batch reference.
- Link purchase receipts to their invoice review page and recipe movements to their
  related storefront order. Other source kinds retain their source reference.
- Add health links from the stock overview and item pages. Keep reorder settings on
  the health page so the health rule and its unit are visible beside the threshold.
- Extend Arabic labels and desktop/mobile browser scenarios for the new pages.

This slice adds the `StockReorderThreshold` table and owner-only Inventory routes.
Thresholds do not post stock movements and do not convert or aggregate unlike
units. Health counts are informational; purchase and stock-operation workflows
remain separate.

## Follow-up slices

1. Operations: atomic transfers, reviewed adjustments, condition changes,
   write-offs, and stocktakes with explicit stale-count handling.
2. Purchasing expansion: bounded imports/exports, supplier returns linked to
   original receipt quantities, notifications, and quantity reports. Costs,
   valuation, tax, and settlement require their own contracts.

## Verification

Use Node 24.11.1 and the Merchant Dashboard typecheck, lint, and build scripts.
Focused scenarios live in `tests/ui/merchant-inventory.spec.ts` and run with
`playwright.merchant.config.ts` on desktop and mobile, in Arabic and English.
They cover draft fields and bounded selectors, receipt confirmation/retry,
inline supplier cancellation/error/retry, explicit policy saving, movement
filter pagination, and opening-entry recovery. These browser tests mock API
responses; they do not establish live database or transaction correctness.

Phase 2 verification used Node 24.11.1. API lint, typecheck, build, and all 140
HTTP/unit tests passed. The four focused Inventory database tests passed against
the migrated local database. Merchant Dashboard lint, typecheck, and production
build passed; Contracts build and Prisma schema validation passed. The production
build retains the existing large-bundle advisory.

All 14 focused visibility and overview browser cases passed across desktop/mobile
and Arabic/English. This includes all 8 new detail/health cases and 6 overview,
filter, and empty-state regressions. A broader 46-case run before refreshing two
inventory assertions completed with 26 passing and 20 failures in existing
catalog-builder and purchase/editor journeys; those unrelated cases were not
rerun after the assertion updates. Browser tests mock API responses and do not
establish live API behavior. Interactive in-app browser inspection was unavailable
because its execution tool failed before initialization.

Recorded previews use test fixture data:

- [Arabic overview](screenshots/phase-one-overview-ar.png)
- [Purchase review](screenshots/phase-one-purchase-review.png)
