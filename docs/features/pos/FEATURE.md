# Complete POS — Feature and Architecture Contract

## Status and authority

- Last reviewed: 2026-10-26.
- Status: M1 and M2 remain partial; M3 is in progress; M4 dining sessions/split checks are implemented within their exit scope; M5 is in progress; M6.1-M6.6 kitchen dispatch, readiness, handover, queue freshness and pre-acceptance additions have automated coverage; M7.1 cancellation, M7.2 original-payment-linked refunds and M7.3 post-handover item returns recorded as waste have focused API, local PostgreSQL and desktop/mobile UI coverage; M8.1 blind count/shift close, M8.2 bounded owner close reports, M8.3 dedicated cash-drop classification, M8.4 owner return/waste audit reports and M8.5 POS operations reporting have focused API, rollback-only PostgreSQL and desktop/mobile UI coverage. Merchant POS accent configuration is persisted with owner and cashier API coverage; manual merchant/cashier review remains pending. M8.5 owner acceptance remains pending. Cashier/device acceptance remains pending. POS discount application and analytics are deferred under POS-D17; multi-station readiness, physical printer acceptance and direct one-click PDF download remain open. ETA fiscal integration is deferred.
- Companion execution ledger: [PROGRESS.md](PROGRESS.md). Read both before each implementation slice.
- UI/UX companion: [UI_UX.md](UI_UX.md). Follow its workspace, interaction, dual-theme and usability requirements for frontend slices.
- Applications: `apps/pos`, `apps/api`, and owner configuration/reporting in `apps/merchant-dashboard`; preserve storefront compatibility.
- Shared packages: `packages/contracts`, `packages/database`, `packages/ui`.
- Follow [root instructions](../../../AGENTS.md), [API instructions](../../../apps/api/AGENTS.md), [API architecture](../../architecture/API_ARCHITECTURE.md), and [UI/localization conventions](../../architecture/UI_AND_LOCALIZATION.md).
- The user requested these references, the frontend stack and an interactive prototype, then clarified that its design should become the production POS baseline. The live `/catalog` selling screen now uses Tailwind utilities and shared POS tokens while keeping real API, React Query and Zustand draft flows. Operator review on 2026-10-18 found substantial visual and usability gaps across the live routes; the Step 1 visual handoff is **not accepted**. Follow the cross-page correction plan in [UI_UX.md](UI_UX.md) and deliver one tested page slice at a time. `/prototype` remains a development-only sample for interactions not yet migrated. Printer hardware details remain open; ETA fiscal issuance is deferred.

Use these labels: **EXISTING** means observed in source; **CONFIRMED** records an explicit user choice; **TARGET** is the proposed implementation contract; **OPEN** needs a decision before its affected slice; **DEFERRED** is outside the first release. Update decisions before changing dependent behavior. Later explicit user instructions take precedence over this document.

### Delivery collection update — 2026-10-26

POS-D18: the user approved implementing tracked COD delivery across shifts.
See [Delivery collections](DELIVERY_COLLECTIONS.md) for the implemented exception
to D05/D06, customer-versus-drawer money rules, supervisor handover, recovery,
rollout and acceptance. Other unpaid fulfillment types retain their close block.
The original order attribution is retained. Courier-held payments never enter a
drawer until an attributable remittance into an open same-branch shift. Financial
shift totals and frozen handover snapshots stay unchanged after later collection.

### Current implementation update — 2026-10-18

- `apps/pos` uses React Query for session, queue, catalog and quote state, and Zustand for merchant/employee/device-scoped drafts and exact command envelopes, with branch identity stored on branch-specific operations. Existing accept/prepare retry IDs are preserved. The production cashier has a compact searchable product grid, product configuration, quantities/notes, multiple drafts and dine-in/takeaway/delivery context.
- `GET /pos/catalog` is implemented in Catalog and derives merchant scope from the authenticated POS employee. `POST /pos/orders/quote` also uses Catalog's authoritative pricing. `POST /pos/orders` is owned by Orders: it requires the assigned `sell` grant and an open register shift, rechecks product revisions, persists immutable priced lines with POS shift/operator attribution, and replays only an exact request fingerprint.
- POS stock handling follows POS-D08: DIRECT requirements post once at sale confirmation; recipe requirements are snapshotted per order and post once at kitchen acceptance; products without explicit mappings retain legacy variant reservation. Additive migrations preserve storefront and historical-order behavior. Owner storefront reads/status actions exclude POS orders; POS kitchen reads include them.
- Orders owns branch-scoped POS dining tables, open table sessions, added rounds, same-branch moves to available tables, revisioned/idempotent split-check allocation, and ordinary receipts. Every new POS sale starts with one unpaid check; dine-in sales also attach to the active table session. Check tender commands are order/check locked and replay-safe; payment rows, net cash journal entries, and a frozen receipt snapshot for a fully settled check commit together. `GET /pos/orders/:id/payment-state` returns tenant/branch-scoped check balances and tender history; `GET /pos/orders/:id/checks/:checkId/receipt` retrieves the saved document; `GET /pos/receipts` returns bounded cursor pages for an assigned branch. The receipt and item/tender facts are not reconstructed from current catalog data. The POS saves an exact payment envelope before sending the write, surfaces it across authenticated POS routes and requires an explicit same-command retry after recovery; it never auto-replays a financial write. Recovery is scoped to the same merchant, employee and browser device, with branch identity retained in the command. ETA fiscal integration is out of current scope.
- M6.1 adds an Orders-owned, branch-scoped default `Kitchen` station and one persistent ticket per POS order. Takeaway/delivery create their ticket inside the confirmed-sale transaction; dine-in rounds stay off the kitchen queue until an authorized cashier explicitly dispatches that order. The queue continues to show legacy storefront recipe orders and now shows ticketed POS orders even when they have no recipe stock lines. Ticket metadata includes station, dispatch mode/time and dine-in table code. Dispatch retries reuse the action result or return the existing ticket; historical active POS orders are backfilled as `legacy` tickets. Accepting a ticketed POS order with RECIPE lines consumes its frozen requirements; DIRECT and unconfigured lines do not get a second stock debit. The migration has been authored but was not applied in this slice; check PROGRESS and the M6.1 handoff before using a live local database.
- M6.6 adds immutable new lines to an already-dispatched POS order only while its kitchen status is still pending, exactly one whole check remains open, and no payment or split allocation exists. Orders locks the open shift and order, checks the expected order revision and current server quote, snapshots product choices and stock requirements, updates the same order/check total, and records an idempotent result. Existing sent lines are never edited. The POS uses the live catalog/configurator and presents earlier lines read-only beside the new additions; it displays both the addition amount and resulting order total. An exact request is persisted before sending and can be replayed after an uncertain response. DIRECT additions use the order's assigned warehouse; recipe stock remains frozen until kitchen acceptance; legacy variant reservation behavior is retained. See the M6.6 test card and PROGRESS for the migration, checks and remaining operator acceptance.
- The POS uses the shared English/Arabic language switcher; the dining and split-check controls have Arabic copy and follow the shared RTL document direction.
- The production workspace now uses `features/workspace/PosWorkspaceFrame` for the reference-aligned full-screen rail, header, language/theme controls and orange-default appearance tokens. `/catalog` continues to use the operational catalog, server quote/order APIs, durable Zustand drafts and payment recovery; the demo store remains isolated to `/prototype`. Merchant accent is stored by `merchants`, changed from owner settings at `/pos-registers`, and read by authenticated POS employees from `/pos/appearance`; theme remains a device-local preference. The isolated prototype keeps its local accent preview. This is a bounded design migration, not a migration of every sample-prototype interaction.
- Migration `20261017170000_pos_existing_order_checks` backfills one unpaid whole check for each historical positive-total POS order. It intentionally leaves old table/session facts unset because that history was not captured. The migration has been applied only to the configured local PostgreSQL database; production rollout remains pending.
- The Shifts module supports owner register setup, assigned cashier/supervisor shift opening, cash-in/out/cash-drop, a blind physical count, supervisor-approved variance handling, immutable close reports and bounded owner reports. A cash drop requires a safe-bag reference and remains distinct from petty cash paid out in shift reconciliation and owner reports. `GET /owner/pos/shifts/reports` derives merchant scope from the owner session, accepts an optional owned branch and an explicit timestamp range capped at 93 days, and returns cursor pages of immutable close-report columns without the internal snapshot. M8.5 adds an owner-only operational summary for order flow, current balances, cash/manual-terminal collections and refunds, and kitchen preparation timings.
- The development-only `/prototype` remains isolated from the production API; its sample checkout/receipt interactions do not stand in for live cashier, tender or receipt records. Its visual language is now used by the production selling workspace. See [PROGRESS.md](PROGRESS.md) for exact verification and limitations.

## Step-by-step implementation and test handoff

Implement and review one bounded POS substep at a time. When a substep is complete, update this file and [PROGRESS.md](PROGRESS.md), then give the operator a handoff before starting dependent work. Continue automatically when the operator explicitly requests continuous execution; keep pending manual/device acceptance visible and never report it as passed. Each handoff must include:

1. The changes made, in the order an operator will encounter them.
2. Exact automated commands/results, test counts, and whether each check used unit fixtures, HTTP stubs, intercepted browser responses, or a real local database/browser.
3. A numbered manual test with prerequisites, UI actions, and observable pass conditions; include the expected record/payment effect where applicable.
4. Remaining limits and any hardware, live-integration, or operator checks that were not run.

When the operator explicitly authorizes continuous execution, record each handoff in these documents and continue to the next independent bounded slice without waiting. Otherwise, stop after the handoff and wait for operator results before dependent work. Never describe mocked or local-only evidence as live production acceptance.

### Prototype design adoption — Step 1 visual handoff

This step applies the prototype's visual direction to the real selling route using Tailwind classes and the same shared button primitive as the preview, without routing production actions through sample state. The live frame and catalog use the existing shared semantic theme stylesheet only; they do not add route-specific CSS. Operator review found the visual result incomplete; use the correction plan in [UI_UX.md](UI_UX.md) before repeating this handoff. It does not complete M1–M5 or replace the separate M5.5 payment/receipt acceptance.

Before manual testing, make sure the local API/database and demo fixture are available. If the `cashier-demo` fixture is missing, follow [the local demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md): seed the local fixture if needed, assign it the Cashier role, create **POS Testing Register**, sign in at `http://localhost:5175/login`, then open a test shift. The guide contains the local-only credentials and exact setup. Do not use production credentials or data for this visual check.

1. Open `/prototype?view=sell` and `/catalog` in separate tabs. Compare the rail/header, category strip, card density, order panel and primary/secondary button treatment; product data can differ because the prototype uses samples and `/catalog` uses the live catalog. In `/catalog`, confirm the active **New sale** state and saved-draft strip. At 1440px, confirm four product cards fit across the grid; at an extra-wide desktop, confirm five fit. Product cards should stay compact, and order items should use the compact single-row treatment. Confirm branch/register/shift and online status still reflect the real session.
2. Switch Light ↔ Dark, refresh, and confirm the selected theme persists and the live product, cart and controls remain legible. The live workspace shows the read-only merchant accent. Change it from the owner dashboard's `/pos-registers` **POS appearance** card, then reload the cashier workspace and confirm the selected accent appears. Local color preview remains available only at `/prototype`.
3. Switch to Arabic. Confirm RTL direction, the navigation rail on the right, and that the product and order panels remain usable. Switch back to English.
4. Add a real catalog item to the current draft. Confirm its server-quoted EGP amount appears in the cart; open its item-note control, enter a note, and verify the compact row shows it. Create a second draft, then return to the first and confirm its item and note are retained.
5. Refresh `/catalog`. Confirm the draft is restored and no sale, payment, kitchen send or stock movement was created by these UI checks. At a 390px-wide viewport, confirm the screen has no horizontal page overflow and primary cart actions remain reachable.
6. Stop before **Confirm order** so the visual review does not create a sale or kitchen/stock side effect. Record any screen that feels unlike the supplied reference or makes a common cashier task harder.

This handoff uses local UI behavior and does not prove a live browser-to-database sale. After the operator reports the result, take only the next agreed migration slice. M5.5's payment and saved-receipt test card above remains independently pending, and M6 remains gated by its handoff.

### Merchant POS appearance — saved accent configuration

The owner controls one tenant-wide POS accent from **Merchant Dashboard → POS Registers → POS appearance**. The merchant row stores the accent, revision and last editor; PATCH requires the current revision and the API derives merchant identity from the owner session. Authenticated cashiers read that tenant's accent through `GET /pos/appearance`. POS light/dark preference remains local to the workstation. If the read is unavailable, the shell uses the agreed orange default and exposes the fallback through its accessible label.

Automated coverage includes owner/POS authentication, validated accent values, tenant derivation, stale revision rejection, database defaults and audit attribution, an owner-settings save/reload browser journey, live-POS server accent adoption after reload, orange fallback on read failure, and a full fresh PostgreSQL migration/database regression. Browser tests intercept the API; only the rollback-only database suite exercises real database reads and writes.

Manual test, using a disposable merchant and cashier:

1. Open `/pos-registers` as the owner. Confirm **POS appearance** starts at orange. Choose Plum, wait for the saved status, then reload and confirm Plum remains selected.
2. Sign in to the same merchant's cashier workspace and open `/catalog`. Confirm the accent indicator and primary controls are Plum. Navigate to `/dining`, `/receipts` and `/shift`, then reload; the merchant accent should remain consistent.
3. In the owner page choose Teal. Reload the cashier workspace and confirm Teal appears. Verify switching Light/Dark remains a local theme preference and does not change the merchant accent.
4. Sign in to a different test merchant and confirm it still uses its own color. The API's tenant tests cover isolation; do not change or inspect another merchant's live settings.
5. If the local API is deliberately unavailable, the cashier should stay usable, show the orange fallback state accessibly, and must not make an order or payment depend on the appearance read.

Do not create a sale, open/close a shift, or submit a payment for this appearance check. Record owner/cashier acceptance separately from mocked browser and rollback-only database results.

### Cross-page visual correction — Step 1: shared foundation

This correction removes the POS app's global `style.css` so generic heading/paragraph styles cannot leak into the workspace. The existing incoming-order behavior is expressed with Tailwind utilities and shared semantic tokens, the workspace rail/header labels are more readable and wrap instead of clipping, missing Arabic workspace/catalog strings are translated, and unreadable placeholder names fall back to a neutral POS operator label. It does not complete the visual migration of catalog, dining, receipts, shifts, login, order history or kitchen.

Use the same local cashier setup described above if the login session is unavailable. Check these existing routes without confirming sales, accepting kitchen orders, opening/closing shifts or issuing refunds:

1. At a 1440×900 viewport, open `/login`, `/prototype?view=sell`, `/`, `/catalog`, `/dining`, `/receipts` and `/shift`. Confirm each page loads, the shared header and rail remain visible where expected, page text has no unexpected forced width/color, and no navigation label is clipped. On `/`, confirm the branch selector and Refresh control still work; stop before Accept/Start preparation.
2. Repeat at 390×844. Confirm the bottom navigation labels wrap onto readable lines, the rail does not cover page actions, and no page has horizontal overflow. Check that a long order/customer or branch name does not push the controls off screen.
3. On each route, switch Light ↔ Dark. Confirm surfaces, body text, muted text, alerts, empty states and order statuses remain readable. Return the theme to the preferred setting.
4. Switch to Arabic. Confirm RTL layout and translated workspace label, navigation, saved-draft label, table selector and draft tabs. The existing corrupted employee placeholder should display a neutral operator label and icon; valid Arabic employee names should remain unchanged. Switch back to English.
5. On `/catalog`, inspect a takeaway draft and a dine-in draft. Confirm “Saved draft”, “Select a table”, the no-tables hint and draft tab labels appear in Arabic when selected. Do not confirm the order.
6. On `/dining`, `/receipts` and `/shift`, inspect the available and empty/current-session states. Confirm no visual regression and avoid actions that change a table session, receipt, shift or payment.
7. Use Tab and Shift+Tab through the rail and header on `/catalog`; confirm focus is visible and the language/theme controls remain reachable. Compare `/prototype?view=sell` with the supplied reference to catch any accidental global-style change.

Capture a screenshot for any route that still differs from the reference, then report which route/theme/language/viewport failed. This is an operator visual and regression gate; the automated checks above do not replace it. The user explicitly requested Step 2 before reporting Step 1 findings; Step 2 is recorded below as the current review gate, and no further visual correction slice should start until its findings are reviewed.

### Cross-page visual correction — Step 2: live selling/catalog

This slice refines `/catalog` only. The branch/register/shift/connectivity controls now occupy a compact row, with the product search on its own full-width row. Category tabs use less vertical space, and product cards use an auto-filling compact grid with smaller artwork, type and controls. The existing API remains the sole source of products and prices; empty and one-item catalogs remain real states. The footer keeps the active draft and up to two others visible on desktop, shows only the active draft on narrow screens, and offers an all-drafts popover for selecting any saved draft. Arabic labels are supplied for the new draft control. Dine-in still requires an actual configured table, and the shift/online/server-quote requirements for sale confirmation are unchanged.

Manually review this slice before the next route is changed:

1. Start the POS and sign in with the configured cashier session. At `/catalog`, test at 1440×900 and 390×844, first in English/light, then Arabic/dark. Confirm that branch, register, shift and connectivity state form a compact row, and the search spans its own row without being squeezed by those controls.
2. Search for an existing product by name, clear the query, switch between existing categories and All items, and use the real product card to open its variant/modifier configurator. Confirm the same live products, server-backed prices, available options and product quantities remain correct. Do not create fake products or treat sample preview data as merchant catalog data.
3. Check the card grid at desktop/tablet/phone widths. Cards should fill available columns at a compact size, keep image areas consistent, truncate long names/descriptions without clipping the price or add action, and collapse to one column when the usable width is below one card. A catalog with one real item should show one card; it should not stretch that card across the whole menu.
4. With the existing local drafts, select drafts from the visible tabs and from **All drafts**. Verify every draft remains available when there are more than three, the currently selected draft is visible, each item count is correct, and switching drafts restores the right items and fulfillment/table details. On a phone, confirm the active draft and All drafts remain reachable without page-level horizontal scrolling. Confirm the new draft action still creates a local unsent draft.
5. Select dine-in with no configured tables, if that is the current branch state. Confirm the selector explains that no active tables exist and Confirm order remains disabled. With tables configured, check that the table selector and occupied-table semantics match the current live data. Check takeaway and delivery fields without submitting an order.
6. Toggle network offline and back online only if safe in the local environment. Verify the offline status is visible, drafts remain editable/saved locally and sale confirmation remains unavailable offline. Restore connectivity and verify the status returns to online.
7. Use keyboard Tab/Shift+Tab and touch on the draft popover and product cards. Confirm focus/pressed states are visible, Escape closes the draft list, and no control is below the cart/footer or covered by mobile navigation.
8. Refresh `/catalog` and confirm the selected saved draft and its content are restored. Stop before **Confirm order**. Do not collect payment or send anything to the kitchen during this visual review.

Report any mismatch with a screenshot and the route/theme/language/viewport. This manual gate reviews catalog usability only; it does not prove a live sale or advance M3. The user explicitly directed proceeding to Step 3 before reporting Step 2 findings; Step 3 is now the review gate before any further visual slice.

### Cross-page visual correction — Step 3: dining tables and sessions

This slice refines `/dining` only. Table cards now follow the prototype's wider three-column desktop hierarchy, expose actual occupied/free counts and table capacity, and show the outstanding amount and order count for occupied tables. Loading and no-data states have intentional, compact layouts. Open sessions use clearer table/order/check groupings while retaining the existing server-backed move, split-check and payment actions. A single **Refresh** control sits in the page header and reloads both table and session data. Tailwind utilities, semantic theme tokens, Lucide icons and the shared POS button primitive are used; no route-specific CSS or sample table/session data was added. API contracts, database state, move/split/payment rules and session polling are unchanged.

Before the next visual slice, review this route against `/prototype?view=tables` using the local test cashier and isolated local data:

1. At 1440×900 and 1920×1080, compare `/dining` with the prototype table view. Confirm the **Refresh** control is at the top beside the page heading/branch controls, refreshes both the table map and sessions, and is not repeated lower on the page. Confirm three readable columns at wide desktop, clear table numbers/status, comfortable card spacing, legible occupancy counts and that session cards remain easy to scan. Repeat at 390×844 and confirm one-column cards, reachable move/order controls, and no horizontal page overflow.
2. Check English/light and Arabic/dark, then English/dark and Arabic/light. Confirm RTL ordering, currency/number alignment, active orange status, empty/loading/error contrast, and visible keyboard focus. Check that long branch/table/product names wrap or truncate without covering actions.
3. Use the actual configured tables. Confirm the table total, available/occupied counts, seat count, outstanding amount and order count match the API data. Select a free table's plus action and confirm its real `tableId` is carried into `/catalog`; confirm an occupied table offers **Add round** for the same table. Do not confirm an order.
4. Inspect open sessions, order lines, check amounts and outstanding totals against the local fixture. Confirm the move selector offers only available tables. On an isolated local test session only, move it to an available table and refresh to verify the new occupancy; never run a move against production data.
5. Open and close **Split check** without saving. Open **Take payment** and close it without recording a tender. Do not use **Move**, **Save split**, or any payment submission unless the data is isolated and the test explicitly requires it.
6. If the local branch has no configured tables or open sessions, inspect the purpose-built empty states; they must not show sample tables. If loading/error states are available in the local test setup, confirm skeletons and the error message remain readable in both themes.

Report each mismatch with route, theme, language and viewport, and attach a screenshot where layout is involved. The existing Playwright journey uses intercepted HTTP responses; it verifies behavior, not live backend acceptance. The user then asked to continue to Step 4; this does not record completion of the Step 3 manual review.

### Cross-page visual correction — Step 4: incoming kitchen-order tickets

This slice refines the existing `/` branch-scoped incoming-orders queue to use the prototype kitchen ticket hierarchy. Each live ticket surfaces its order ID, customer, fulfillment type, timestamp, phone where present, actual status, line quantity/name/variant/options/note, delivery address, branch name and total. Ticket actions remain the existing **Accept and deduct stock** and **Start preparation** commands, with the same idempotent retry and offline behavior. Arabic labels cover dine-in and takeaway. Cards use Tailwind, semantic theme tokens, Lucide icons and the shared POS button primitive; desktop uses two columns from the XL breakpoint and phone cards remain stacked. This does not add stations/KDS, history, new order statuses, fake data or backend changes.

Before the next visual slice, review `/` against `/prototype?view=kitchen` with a local test cashier and isolated branch:

1. At 1440×900 and 1920×1080, compare the ticket hierarchy and spacing with the kitchen preview. Confirm two columns at desktop width, visible order identity/status, compact line rows, legible totals, and a full-width primary action. Long customer names, options and notes must wrap without covering status or amount.
2. At 390×844, confirm tickets stack in one column, the header and actions remain readable, the delivery address wraps, and the page has no horizontal overflow. Check that phone numbers open the dialer link only when explicitly tapped.
3. Check English/light, English/dark, Arabic/light and Arabic/dark. Confirm dine-in/takeaway/delivery labels are translated, RTL content order is natural, currency remains readable, status colors retain their meaning, and keyboard focus is visible.
4. Inspect pending, accepted and preparing tickets. Pending shows **Accept and deduct stock**; accepted shows **Start preparation**; preparing has no action. Verify order time, customer/contact, fulfillment, product quantity, variant, selections, kitchen note, delivery address and total match the actual API response. Rejected/cancelled orders are outside this queue's current API contract and should not be invented here.
5. For command testing, use only an isolated local branch with a disposable pending recipe order: accept it once, verify the status/stock result, then start preparation once. These actions affect inventory and kitchen state. Do not click either action for a real merchant order during visual review. For a non-mutating review, inspect existing tickets only.
6. Review no-branch, empty-queue, loading, API-error, offline and saved-action retry states if available. Confirm refresh/polling preserves branch scope and that actions are disabled while offline. Never interpret mocked browser responses as backend acceptance.

The focused mocked browser suite is `tests/ui/pos-incoming-orders.spec.ts`, run with `playwright.pos-queue.config.ts`. Its desktop/phone and Arabic journeys verify ticket content, responsive columns, RTL, no narrow-screen horizontal overflow and the accept → preparation request sequence. It does not change a database or deduct real stock. The user asked to continue after each slice; Step 5 is the receipt-history list only.

### Cross-page visual correction — Step 5: receipt history list

This slice refines `/receipts` history only. The list now follows the live POS workspace hierarchy with a clear page title, compact branch selection, a top-level **Refresh** button, searchable receipt/order identity and dense, responsive receipt rows showing the saved receipt number, check/order reference, issue time, amount and explicit **View / print receipt** action. Loading, no-branch, no-results and request-error states are distinct; a failed request no longer masquerades as an empty history. The existing React Query key, branch-scoped cursor API, saved receipt identity and detail-opening action are preserved. This slice does not alter receipt details, paper/PDF rendering, payment, settlement, print commands, API contracts or backend state.

The focused mocked suite is `tests/ui/pos-receipts.spec.ts`, run with `pnpm exec playwright test --config playwright.pos-receipts.config.ts --reporter=list`. Its eight desktop/phone cases cover branch scoping, search, refresh, cursor pagination, opening/returning from a saved receipt, genuine empty and unassigned-branch states, request-error recovery, Arabic RTL and accidental payment-command absence. All HTTP responses are intercepted. This is interaction and layout regression coverage, not live API acceptance or a substitute for operator visual review.

Manually review this list before the receipt-detail slice:

1. Open `/receipts` with a configured local test cashier. At 1440×900 and 1920×1080 compare its spacing and row hierarchy with the supplied receipt history/workspace reference. Confirm the page title, branch control and **Refresh** action are at the top; search has enough width; each compact row makes the receipt number, check/order reference, date, amount and **View / print receipt** action easy to scan.
2. Repeat at 390×844 and 768px. Confirm rows reflow without clipping, buttons remain reachable with a touch target, long receipt/order IDs truncate without pushing out amounts/actions, and no horizontal page scrolling appears.
3. Review English/light, English/dark, Arabic/light and Arabic/dark. Confirm RTL order is natural, dates and EGP remain legible, the selected branch is clear, controls have visible keyboard focus, and empty/loading/error states retain sufficient contrast.
4. Use two branches if assigned. Switch branches and confirm the list changes to receipts for that branch only. Search by receipt number and order reference, clear the search, refresh from the top, and load an older page if one is available. Check the receipt count and visible rows against the saved API data.
5. Use **View / print receipt** only to confirm it opens the existing saved receipt and **Back to receipts** returns to this list. Do not press **Print / Save PDF** in this slice. Confirm re-opening or refreshing does not create a payment request or change the saved receipt number/amount.
6. Inspect real no-receipt and no-branch states if available. In the isolated mocked suite, verify request failure is shown as an error rather than “No receipts yet,” then use the top Refresh action to recover. Do not use sample preview receipts as merchant sales.

Stop after this handoff. The next bounded slice is receipt detail and the 80mm/Save-as-PDF visual review; checkout, payment, receipts and backend state remain outside this list-only change.

### Cross-page visual correction — Step 6: saved receipt detail and 80mm output

This slice refines the already-issued receipt view opened from `/receipts`. The saved check remains the source of truth: show merchant/branch/register, receipt and order/check identifiers, issue time, service/table, cashier, item names/options/quantities, check and paid amounts, each tender, cash received and change. If a saved cashier label is unreadable, show a localized “Cashier name unavailable” message; the immutable snapshot cannot recover a name that was already stored as question marks. Use a plural, localized payment-method heading because a check can have multiple tenders. English uses left-to-right layout; Arabic uses right-to-left layout. The receipt paper stays high-contrast white in both app themes. Its screen UI uses Tailwind utilities; the small `receipt-print.css` file is limited to print-media rules for an 80mm page, a 76mm content area, and hiding the workspace shell/actions. Narrow screens reserve space below the receipt so the fixed POS navigation does not cover its final actions.

The focused mocked browser suite is `tests/ui/pos-receipt-detail.spec.ts`, run with `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-receipt-detail.config.ts --reporter=list`. Six Chrome cases cover desktop and phone saved-receipt facts, print-media dimensions and hidden controls, print failure without another payment request, Arabic RTL and mobile navigation clearance. All HTTP responses are intercepted. This is not live API, generated-PDF or physical-printer acceptance.

PDF output for this step uses the browser's **Print / Save PDF** dialog. The direct one-click download remains open: a local browser-rendering experiment hit Chromium's canvas security restriction, so it was removed instead of shipping a non-working download button. Use the print-dialog check below to validate PDF output.

Manually review this detail before moving to another page:

1. Open `/receipts` as a configured local test cashier and open one already-settled receipt. Check the receipt number, original order/check, issued time, branch/register/cashier, service/table, item names, variants/modifiers and quantities against the saved sale. Confirm the payment heading is localized. If the saved cashier value is unreadable, confirm the UI shows the localized unavailable label, then correct the employee profile before future sales; do not alter the historical receipt snapshot. For a split check, confirm this receipt shows only its own paid share and lines rather than duplicating the full order.
2. Check the tender section against the saved payment: cash plus external terminal amounts, paid amount, cash received and change. Refresh the page and reopen the same receipt; its identity and amounts must remain unchanged. Opening and printing must not collect payment again.
3. Review 1440×900 and 1920×1080, then 768×1024 and 390×844. Repeat English/light, English/dark, Arabic/light and Arabic/dark. Confirm the paper stays white and readable, Arabic metadata flows right-to-left, long item/modifier names wrap without losing quantity or amount alignment, and the page has no horizontal overflow. On phone, scroll to the bottom and confirm the final receipt rows and both actions remain above the fixed navigation.
4. On desktop click **Print / Save PDF**. In the browser print dialog choose **Save as PDF** and an 80mm paper size. Inspect the preview/output: only the receipt should print, its content should fit within the paper without the app shell or action buttons, and totals/tenders must remain readable. Cancel the dialog and confirm the saved receipt is still open. Print a test copy on the actual target printer when one is available; emulation cannot verify its printable width or driver margins.
5. To exercise the recoverable print-error state, open DevTools and run `window.print = () => { throw new Error('blocked'); };`, then press **Print / Save PDF**. Confirm the page explains that the receipt is saved, retains all receipt facts, and the Network panel has no new `POST .../payments` request. Reload normally afterward to restore the browser print function.
6. If the API can be safely interrupted in a local test environment, review loading and receipt-load error states, retry/open from history, and verify an error never appears as a blank or new receipt. Do not edit or settle an order as part of this view-only review.

Stop after this handoff and report any layout, direction, print-preview or content mismatch before the next bounded page slice. Receipt identity, backend state, checkout and payment behavior are unchanged here.

### Cross-page visual correction — Step 7: checkout and payment summary

This slice refines the live checkout dialog only. The order reference and current check balance now stay in a compact, persistent summary while payment methods scroll; the summary distinguishes order total, check amount, amount already collected, and remaining balance. For split checks, the check selector stays with this summary so changing checks updates the displayed amounts together. Tender entry, proposed payment total, post-payment balance, change, recorded payments, and the primary action remain separate and readable. The layout uses Tailwind utilities, semantic light/dark tokens and the shared POS button/Input/Dialog primitives. English LTR and Arabic RTL are supported. Payment APIs, cash/manual-terminal rules, command persistence, same-command retry/reconciliation, and receipt issuance are unchanged.

The focused browser suite is `tests/ui/pos-checkout.spec.ts`, run with `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-checkout.config.ts --reporter=list`. It exercises desktop (1440×900) and phone (390×844) with intercepted HTTP. In particular, the long split-tender case scrolls the tender list and checks the order/check balance and payment action remain available; the Arabic case checks RTL and translated amount/method labels. Mocked browser tests do not establish live API, cash-drawer or external-terminal acceptance.

Manually review this slice before the next page is changed:

1. Use a local test cashier, test branch/register and open test shift from the [local POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md). Open checkout for a disposable, unpaid or partially paid test check. Do not use a real customer sale. At 1440×900 and 1920×1080, then 768×1024 and 390×844, inspect English/light, English/dark, Arabic/light and Arabic/dark.
2. Confirm the pinned summary clearly distinguishes order number, order total, selected check, check amount, collected amount and remaining balance. Scroll through a long tender list and confirm the order/check balance remains visible; the dialog itself must not gain horizontal overflow. For split checks, switch between an open and settled check and confirm every figure, state label and receipt action follows the selected check.
3. Enter a cash amount and cash received amount. Confirm the footer separately labels payment total, balance after payment and change to return, and the main action correctly says partial payment or settle. Add a manually confirmed external-terminal tender and verify each method and amount remains distinguishable in the proposal. Do not type card credentials or imply the terminal was verified by POS.
4. If testing a real local payment write, use only the disposable test check and locally confirmed cash/terminal activity. Confirm partial settlement refreshes the balance and recorded-payment list, while full settlement opens the saved receipt once. Reload or revisit checkout and verify the saved result; do not create a second command to resolve uncertainty. The automated suite already checks interrupted-response replay uses the same request ID and same payload.
5. Inspect offline, loading, refresh-error, cancelled-order, settled-check, unresolved-payment and payment-recorded states where available. Offline must disable new collection while leaving the amount context visible. An unresolved command must offer its saved-result check/retry action and must not invite a new payment.
6. Use Tab/Shift+Tab and touch to add/remove tenders and reach the primary action. Check visible focus, minimum touch targets, Arabic label wrapping, currency alignment, button order, and that the sticky summary/footer do not cover the scrolled tender fields.

After the review, report route, theme, language and viewport for any mismatch, preferably with a screenshot. This is a visual/operator handoff only; it does not prove POS production readiness or complete M5/M9. Do not begin another visual slice until the user reviews this step.

### Checkout UI audit - 2026-10-18: open workflow findings

The operator requested an inspection of the current order/checkout UI before implementation. The review rendered the production components in local Chrome using intercepted HTTP fixtures at 1440x900 and 390x844, with English and Arabic checkout views. Eight inspection scenarios completed across the two viewports, with 26 screenshots. These scenarios reproduce the observations below; their passing execution does not establish UX acceptance or live payment behavior. Application code was not changed by this review.

| ID     | Priority | Observed behavior                                                                                                                                                                                                                         | Required outcome for a correction                                                                                                                                                                      |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CUX-01 | P1       | Confirming an unpaid order removes its draft, clears the cart/total, and creates a fresh draft. The committed order survives only in a separate banner over the product menu.                                                             | Keep the committed order identity, lines, amount and financial state visible through confirmation and collection. Preserve the distinction between the removed draft and the committed server order.   |
| CUX-02 | P1       | Reloading the selling screen before payment removes the confirmation banner and Take payment action. The catalog has no visible way to resume that committed order.                                                                       | Provide a recoverable way to reopen confirmed unpaid orders by their server identity after navigation/reload. This observation concerns the visible selling route; it does not prove server data loss. |
| CUX-03 | P1       | After full payment, receipt, Back to checkout and Done, the catalog banner still says Order confirmed and Take payment.                                                                                                                   | Reconcile the selling UI with committed payment state and show Paid/receipt/new-sale actions for a settled order. Preserve separate order-execution and financial states.                              |
| CUX-04 | P1       | Adding a terminal tender while cash still covers the full balance makes the proposal invalid. The submit button disables and reads Record partial payment, with no reason shown.                                                          | Display the relevant validation next to the tender/summary, preserve values and explain invalid/overallocated totals. Keep server caps and same-command recovery intact.                               |
| CUX-05 | P2       | Checkout shows an internal order-ID fragment and financial figures, without line items, customer or service/table context.                                                                                                                | Let the cashier verify which order/check is being collected using a stable reference and concise task context; handle whole/equal/custom checks truthfully.                                            |
| CUX-06 | P2       | Phone layout stacks the catalog and cart far apart. In checkout, large fixed summary/footer regions leave a short scrolling tender area; two tenders require substantial scrolling. Receipt printing is below the initial phone viewport. | Provide direct menu/order access on phone, a compact summary, coherent tender groups and reachable payment/receipt actions with the keyboard open.                                                     |
| CUX-07 | P2       | A simple product with no variants/modifiers opened an empty configuration dialog and configurable items had no tested production-flow example.                                                                                            | Add genuinely simple items directly; clearly identify configurable products and show available variants/modifier groups, constraints and a price preview before adding.                                |
| CUX-08 | P2       | Repeated totals and two close actions compete with the main action; cash applied and cash received both initially contain the full balance.                                                                                               | Emphasize the current amount due, then method/received/change. Keep secondary financial facts available with clear labels and one primary action per state.                                            |

Code locations inspected: `apps/pos/src/features/catalog/pos-catalog-screen.tsx` (local `saleComplete`, confirmation callback, banner and checkout close), `apps/pos/src/features/payments/pos-checkout-dialog.tsx` (preview error visibility, tender groups, receipt transition and footer), and the shared dialog primitive. Local ignored captures and the inspection harness are under `apps/pos/test-results/checkout-ui-review/`; they are review artifacts rather than a committed regression suite.

Correction order: first preserve/recover confirmed order context and reconcile settled state; then expose split-tender validation and simplify the payment hierarchy; then refine phone navigation, simple-product addition and receipt completion. This review does not confirm unresolved kitchen dispatch/prepayment policy.

The first correction is implemented below for CUX-01/CUX-02/CUX-03 within same-cashier/browser recovery scope. Correction 2 implements CUX-04 validation feedback and part of CUX-08's payment hierarchy. Correction 3 implements CUX-05 order/check context. Mobile selling implements the navigation/checkout-space parts of CUX-06 with device acceptance pending. The Product choices and simple-item addition step addresses CUX-07 within its manual acceptance scope; remaining CUX-08 refinements remain open. The audit above records original observations.

### Checkout correction 1: confirmed order continuity

Implemented scope: confirmation replaces the draft with a read-only committed order panel, showing frozen items/options/notes, order reference, service/customer, total, collected amount and remaining balance. It does not create a zero-value draft automatically. The panel reads order details and payment state through React Query; settled orders show Paid and saved receipt/new-order actions. Starting another draft keeps the confirmed reference accessible through **Confirmed orders on this device** in the draft dock. Existing split-tender command/recovery behavior remains in the checkout dialog.

Zustand workspace version 4 stores only confirmed order references, branch and creation time; it migrates versions 1–3 and preserves unresolved payment commands. Recovery is limited to the same merchant, employee and browser device. Clearing browser storage loses this discovery index; a server-backed cross-device unpaid-order list is a later capability. References contain no authoritative balances. Orders owns the new authenticated `GET /pos/orders/:id`, returning the existing order-summary contract with frozen lines; it requires sell permission and scopes by merchant, POS source and an assigned active branch. No database migration is needed. Saving the reference and removing its draft/pending sale is one durable local write; if it fails, the original request remains available for exact idempotent replay.

Manual test card for this step (operator acceptance pending):

1. Run the current API and POS, sign in with the local test cashier and select an assigned test branch/register with an open test shift. Use disposable local orders. At `/catalog`, add an item with choices and a note, then confirm once. Expect the same frozen item, quantity, choices/note, stable `ORD-…` reference, service/customer, nonzero total and Unpaid state. The panel must not turn into an empty new cart; confirmed lines are read-only.
2. Open **Take payment**, close it without submitting, navigate to Tables and back to New sale, then reload. Expect the same order and due amount, with no second sale creation. Choose **Start another order**, leave an empty/new draft, then select the old reference from **Confirmed orders on this device**. Expect the original committed details again. Another cashier/device must not inherit these references; switching branches must not show another branch's selected order.
3. On a disposable order, record a partial cash/manual-terminal payment. Close checkout: expect Partially paid, the amount collected and the correct remaining balance. Reload and reopen payment; expect the same server balance. For an uncertain response, use the existing exact-command recovery action rather than creating a replacement payment.
4. Settle the remaining check once. Inspect the saved receipt, select **Back to checkout**, then **Done**. Expect Paid, zero due and **View / print receipt**, with no **Take payment**. Reopen the receipt: its identity and values must stay the same and no additional payment should be submitted. Start another order explicitly when ready.
5. Review English/Arabic and light/dark at 1440×900 and 390×844. Check wrapped item notes, stable reference, currency/quantity direction, button access and no horizontal overflow. Mobile catalog/order navigation remains CUX-06; this step does not claim to fix that layout.
6. Disconnect or make the payment-state read fail before collection. Expect a blocked collection button and clear retry guidance. Restore the connection and retry the read; collection can resume only after verification. A denied/missing order read must hide its lines and block collection. Local storage failure after server confirmation must keep the saved sale request for exact replay, not invite another sale.

Automated evidence and remaining limitations are recorded in Progress. This correction does not implement split-validation copy, direct simple-item addition, table context inside checkout, phone navigation, kitchen dispatch or fiscal documents.

### Checkout correction 2: split-tender validation and payment hierarchy

Implemented scope: invalid cash/terminal amounts now have inline localized field messages, error borders, `aria-invalid` and linked descriptions. All invalid tender fields are identified together. The pinned footer explains invalid entries or an allocation above the selected check balance; the disabled action says **Review payment amounts** rather than incorrectly calling the proposal a partial payment. Editing retains the other entered amounts. No valid/sendable preview is produced while field or allocation errors remain. Existing exact-cent calculations and explicit same-command payment recovery are preserved.

The selected check's remaining balance is the prominent amount. Order total, check amount and previously collected amount remain accessible in the keyboard-operable **Balance details** disclosure. Valid proposals still show payment total, balance after payment and cash change together above one full-width collection action. Open checkout has one header Close control; settled checkout retains Done and saved receipt access. Cash-applied/received defaults remain unchanged. This addresses part of CUX-08; mobile navigation/keyboard layout, checkout item/customer context and direct simple-item addition are separate slices. Uses existing Tailwind, POS semantic light/dark tokens and shared components; no API/database changes.

Manual test card (use a disposable local order; acceptance pending):

1. Open an unpaid **34.86 EGP** check. Confirm the remaining balance is prominent. Open **Balance details** with mouse/touch and Enter/Space; verify order total, check amount and collected amount. Close it and confirm the payment inputs have more room. For split checks, switch checks and verify the summary and proposal belong to the selected check.
2. Keep cash applied/received at **34.86**, add an external-terminal method, and enter **10.00**. Expect a visible message that payment exceeds the remaining balance, a disabled **Review payment amounts** button and no partial-payment label. No payment is sent merely by adding/editing methods.
3. Clear the terminal amount; try **0**, **-1** and **1.009**. Expect a field-specific positive/two-decimal message. Set cash received below its applied amount; expect a separate message beside cash received. With multiple invalid fields, each must remain identified. Correcting a field must clear its error without erasing the other values.
4. Enter cash applied **20.00**, cash received **25.00**, terminal **14.86**. Expect payment total **34.86**, balance after payment **0.00**, change **5.00**, no validation alert and an enabled **Settle check**. Before submitting, remove the terminal row: cash values remain **20.00/25.00**, balance after payment becomes **14.86**, and the action becomes **Record partial payment**. Re-add/correct the terminal row to restore the full proposal.
5. Only on the disposable order, explicitly submit the intended proposal once. Verify saved tenders, remaining balance or receipt as appropriate. Review interrupted-response exact retry and settled Done/receipt access; invalid entries must never generate a payment request.
6. Repeat in English/Arabic, light/dark, at 1440×900 and 390×844. Check readable errors, field focus, numeric entry direction, no horizontal overflow and footer action/error access while tender rows scroll. Repeat with the phone keyboard open as manual device acceptance. The existing mobile navigation and larger keyboard-layout refinement remain open under CUX-06.

### Saved-order switcher: compact dock and safe draft management

The selling footer now shows the selected order and up to two recent entries, with one **All orders** control. Stable short references replace renumbering drafts; references use isolated LTR text and timestamps have their own line. On desktop the picker opens above the footer with bounded internal scrolling; on phone it uses the shared modal as a bottom sheet. Search and Drafts/Confirmed orders filters stay above the list. Draft rows show customer/table/service context, item count and last edit; confirmed rows use their saved reference and a cached customer name when available. Financial state is verified when reopening the order, never inferred by the switcher. The index remains scoped to this cashier, merchant, branch and browser.

Workspace version 5 migrates versions 1–4, retaining existing drafts, references and recovery commands, and saves selected draft identity and recent-use timestamps. **New order** reuses a truly blank takeaway draft in the selected branch. A draft with items, customer name/phone, delivery address, table or another service type is not blank. Existing empty drafts are not deleted automatically. A dedicated **Remove empty drafts** action removes only eligible blank drafts and retains the selected draft; pending sale commands and other branches are excluded. A populated/context-bearing draft requires explicit deletion confirmation. Both individual deletion and cleanup enforce pending-sale protection in the store, and save atomically before updating the screen. Confirmed orders have no delete action. The last draft is recreated if needed to keep a working sale workspace.

Manual test card (operator review pending):

1. Open `/catalog` in English/dark and Arabic/light on a desktop. Check that the selected order is highlighted beside at most two recent entries and **All orders**. Open it: the list must appear above the footer, remain within the viewport and scroll internally. Repeat in English/light and Arabic/dark; verify references and dates read separately.
2. Select an existing draft, note its reference and contents, then reload. Expect the same selection. Select a different draft or a confirmed order and return; recent entries should update, while a confirmed order reopens its server details/payment state. Starting another order must preserve access to that confirmed reference.
3. On a blank takeaway draft, press **New order** repeatedly: the count and reference must stay unchanged. Add an item/customer, choose Delivery or assign a table, then press New order: preserve that context-bearing draft and select/create a blank takeaway draft. A pending sale must never be reused as blank.
4. Open **All orders**, search by reference/customer/table and switch Drafts/Confirmed orders. Verify matching/no-match states, current-selection marking, customer name wrapping/truncation and separate time/reference. With a long saved list (automated fixtures cover 50), the search/filter/cleanup area must remain reachable while rows scroll.
5. Delete a disposable draft containing data. **Keep draft** must retain it; confirming **Delete draft** removes only that draft and returns keyboard focus to All orders. Reload to verify the result. A truly blank draft can be removed directly. Pending-sale deletion must be disabled with an explanation; confirmed orders must offer no deletion.
6. Use **Remove empty drafts** after reviewing its count. Expect selected, context-bearing, pending-sale and other-branch drafts to remain. The existing saved drafts are retained until you choose deletion/cleanup. Browser storage failure must retain the data and show an error rather than appearing to delete successfully.
7. At 390×844, open the sheet and check search, filters, internal scrolling, deletion confirmation and close/Escape focus return. Repeat with the phone keyboard open on the actual device; no horizontal overflow or content behind the navigation. Switching branch/cashier must preserve the existing scope boundaries.

Automated verification uses isolated local storage/HTTP fixtures; it does not delete real operator drafts or perform sales/payments. Broader mobile catalog/cart navigation and server-wide unpaid-order discovery remain separate capabilities.

### Checkout correction 3: verify the order and selected check

Checkout now keeps a stable `ORD-…` reference, customer/walk-in name, fulfillment and current table code beside the remaining balance. A **Review check items** disclosure in the scroll area shows frozen item names, variants, options and preparation notes. It starts collapsed to preserve room for tender entry. For whole-order checks it shows the order lines; for item splits it shows only allocated whole quantities and their allocated amounts. Changing checks resets the disclosure and refreshes its number, contents and balance together. Equal/custom amount checks explicitly describe the selected check as a share of the order total: their **Review order items** disclosure is order reference only and omits per-line collection amounts. Missing allocation metadata never becomes an invented item assignment.

Orders extends the existing authenticated payment-state read with optional `context` (existing frozen order-summary projection plus current table code) and per-check `splitMethod`/`allocations`, using the existing check-summary allocation shape. Its query filters by merchant, POS source and assigned active branch, retaining sell permission. This is an additive read contract with no database migration. Deploy/build the updated contracts/API before the POS to expose the full context. The optional fields let older payment responses remain usable: checkout shows an explicit unavailable-details warning and refresh action, retains reference/current balances and preserves the existing collection/recovery behavior. New payment writes, exact recovery IDs and receipt snapshots do not use these display fields.

Manual test card (operator review pending):

1. On a disposable local order, select a variant and modifier, add a preparation note and customer name, then confirm. Open checkout: verify the same `ORD-…` reference, customer and service. Expand **Review check items** and compare frozen name/variant/options/note, quantity and line total with the confirmed order. A customerless order must show the localized walk-in label.
2. Open a dining order from Tables or New sale. Verify the actual table code and Dine in label. Close/reopen after a legitimate test-session move and check the refreshed table identity. A takeaway/delivery order must not invent a table. Verify delivery customer identity without assuming it is a walk-in order.
3. On a fresh disposable order containing two units of one product and another product, split by whole items. Assign one shared-product unit to each check and the other product to one check. Switch checks in checkout: each must show only its allocated quantities/amounts and matching remaining balance. Options/notes follow the frozen line, not the current catalog. Opening one check must not make the other check's unassigned items look payable there.
4. On separate unpaid test orders, review equal and custom-amount splits. Expect the proper share label and explicit order-reference explanation. Expanded items belong to the full order; no per-line check prices are shown. The selected check's amount/due remains the collection target. Do not re-split a partially paid order to test this.
5. At 1440×900 and 390×844 in English/Arabic and both themes, inspect mixed text/reference direction, long names, quantity/currency wrapping, keyboard-operated disclosures, and scroll access to tender inputs. The balance and payment action must remain available while item details scroll. Repeat with the actual phone keyboard open as device acceptance.
6. Review payment-read loading/error, old-response/missing-context, partial payment, full settlement/receipt and exact-command recovery. Missing context must be explained without invented names/items; refresh retrieves the latest available server context. No payment should be submitted by opening/expanding/switching check details. Existing same-command recovery and immutable receipt behavior remain required.

Automated evidence in Progress combines a real PostgreSQL fixture for scope/table/allocations with mocked Chrome rendering; live cashier/device acceptance remains separate. This step does not complete mobile menu/cart navigation, direct simple-item addition, kitchen dispatch or M5 release readiness.

### Mobile selling: menu/order navigation and keyboard space

For viewports below 1024px, `/catalog` now presents one active pane at a time: Menu or Current order. A persistent **View order** control shows the item count and server-quoted order total, alongside a Menu button. Both panes stay mounted; view changes preserve their independent scroll positions and entered draft data within the current selling workspace. Selecting a saved order opens its order pane; starting another draft returns to Menu. Confirmation opens the committed order pane, and a confirmed order's bar observes its existing actor-scoped detail cache for frozen quantity/total. Unavailable/failed quotes are explained instead of displaying an invented zero. At 1024px and above the two-pane desktop workspace remains available.

Draft identity/service/customer controls and items share a scrolling region on small screens, while its action/total footer remains reachable. Mobile note/customer/address inputs use readable entry text and touch-sized fields. The main selling route fills the available viewport above its bottom navigation. On short viewports during text entry, surrounding workspace navigation/header/dock temporarily collapse and return after editing; draft data is preserved. Menu/order buttons move keyboard focus into the chosen pane and expose the controlled pane identity.

Checkout uses visible-viewport height/offset to fit above an on-screen keyboard, retaining an internal scroll area and pinned payment action. Short layouts collapse secondary header/identity/balance details, and cash applied/received fields share a row to reduce scrolling. Focused tender fields are kept fully inside the scroll area when keyboard geometry, change, or validation feedback changes the available space. Shared Dialog gains only an optional inline style prop for runtime viewport geometry; styling stays in Tailwind and existing semantic tokens. No API, storage schema, dependency or financial command changes are introduced.

Manual test card (real-device acceptance pending):

1. At 390×844 and 768×844, open `/catalog`. Expect the product menu, a visible View order count/total control and All orders above the application navigation. Add a configurable item, then tap View order. Expect the order pane without scrolling past the entire menu. Compare quantity/total with the actual server quote; an empty draft displays zero, while a quote failure says the total is unavailable.
2. Change quantities, enter a preparation note and choose delivery/customer/address or a dining table as appropriate. Switch Menu → View order several times. Entered data and selected service must remain. Scroll a long catalog and a long order separately, switch away and return: each must restore its own position. These positions are local to the mounted selling screen; stored drafts still survive navigation/reload, while scroll need not survive a reload.
3. Select another draft or confirmed order from All orders: it should open the corresponding order pane with a clear reference. Start a new draft: return to Menu while retaining access to saved work. Confirm a disposable test sale once: the committed order pane should open, retain its items/total, and allow the existing payment/receipt flow. The bar shows order total, while the confirmed panel/checkout explicitly shows remaining balance.
4. Repeat in English/light, English/dark, Arabic/light and Arabic/dark. Check reference/currency direction, long names, item-count readability, quantity/remove hit areas and no horizontal page overflow. At 1024×768 and 1440×900, resize back to desktop and verify both panes and their actions remain reachable. Use Tab/Shift+Tab: changing views should focus the chosen pane rather than leaving you in a hidden region.
5. On an actual Android Chrome and iPhone Safari device if available, focus search, customer/address and item-note fields. Open/close the keyboard and rotate the device. Verify the focused field stays visible, surrounding navigation returns after editing, and no entered value disappears. Review at a short landscape height as well as portrait. Browser chrome, pinch zoom and keyboard behavior require this physical-device review.
6. Open checkout, focus Cash received and enter an amount that produces change. Keep the keyboard open: the entire input and primary action must be visible with no clipping behind the footer. Try an invalid amount and correct it, then add a terminal tender and scroll to its amount. Review selected-check context, recorded tenders and receipt access as needed; secondary details return after the viewport grows. Do not submit a real customer payment for layout review.
7. Review offline/quote-error/recovery states on the disposable local fixture. Viewing/switching panes must not create an order or payment. Online confirmation, exact-command retry, partial/full payment and saved receipts retain their existing rules. Use the existing recovery command to resolve an uncertain result.

Automated Chrome coverage includes 390/768 view changes, 30 products, a 20-line draft, retained notes/scroll, theme/direction and a simulated visible keyboard area. Mocked viewport geometry is not evidence of a physical Android/iOS keyboard trial. This implements the selling/navigation and checkout-space parts of CUX-06; native device acceptance, any remaining receipt-action issues and broader release readiness remain open. CUX-07 is addressed in the following Product choices step, with merchant-catalog acceptance pending.

### Product choices: variants, options and direct simple-item addition

On `/catalog`, a product with no variants or modifier groups now adds one unit directly to the current draft. Its accessible card action says **Add item**. Products with variants or modifier groups are marked **Customizable** and open a focused configuration dialog, with the card action labeled **Customize item**. This makes a blank configuration screen a clear signal only for product records that actually have choices.

The configurator shows available variants with prices, required/optional groups, current distinct-option counts, default selections, variant-specific availability and price overrides, and per-option quantity controls up to the catalog maximum. Required group limits are validated before adding. When every variant or an option group is unavailable, the dialog explains that state instead of presenting an empty choice area. Its pinned footer shows an estimated per-item amount and the Add item action; this is a local preview only. After adding, the normal server quote remains the authoritative order price and must be current before order confirmation. Chosen variant and option quantities are saved in the draft line and displayed in the cart. A configurable draft line has an **Edit** action that reopens the same configurator with the saved variant, options and quantities selected; **Save changes** updates that exact line while preserving its quantity and note. Cancel closes without changing the draft. Only identical unnoted configurations added as new items merge.

The catalog API already returns the merchant's saved variant and modifier assignments. The UI does not invent missing merchant choices. For a repeatable live-data check, the local demo seed adds **بيتزا اختبار الخيارات** to the isolated `waffarly-inventory-demo` merchant; its exact variants, groups and prices are listed in the [local POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md). This is test-only sample catalog data, separate from real merchant data.

Manual test card (review on a disposable local cashier/draft before confirming any sale):

1. Start the local POS using the [cashier demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md), open `/catalog`, search **بيتزا اختبار الخيارات**, and confirm the card shows **Customizable** and the **Customize item** action. Open it and verify the small/large variants show EGP 180/260. Change variants and confirm the selected price updates.
2. Leave **اختار نوع العجينة** empty and try **Add item**. The required-choice validation must explain what is missing and must not add a line. Select **رقيقة** (+EGP 0), then **سميكة** (+EGP 20), and verify exactly one radio choice can be active.
3. In **إضافات اختيارية**, select zero through three choices and verify the optional state and selected count. The fourth choice must not be possible. In **صوص جانبي**, verify zero or one choice. Add **كبيرة + سميكة + جبنة إضافية + مشروم + صوص الثوم** and compare the estimate: EGP 260 + 20 + 25 + 15 + 12 = **EGP 332**.
4. Add the configured item to a disposable draft, verify the choice summary and current server quote, then increase its quantity and add a preparation note. Press **Edit** on that cart line: the dialog must reopen with the saved variant, selected choices and extra quantities preselected. Change the sauce and **Save changes**; check the same line updates with its quantity and note intact, and the server quote refreshes. Reopen it, make another change and cancel; the saved line must remain unchanged.
5. With a line that has no note, add the exact same configuration again and verify its quantity increments; a different configuration stays on a separate line. Choose a simple available product and confirm it still adds directly without a dialog; repeat once and verify its quantity reaches two. Remove the test lines when finished. Do not confirm/send this configurator-only sample to the kitchen; the manual check is for the UI and quote, not recipe consumption or payment.
6. Select a merchant product with variant-specific option overrides or multi-quantity extras, if available. Verify variant changes update available choices and option pricing; per-option quantity controls stop at the configured maximum and affect price without counting as additional distinct choices. This demo product focuses on base variants and required/optional groups.
7. Repeat in Arabic/English, light/dark, desktop and 390×844 phone. Check RTL price direction, dialog scrolling with the footer visible, radio/checkbox keyboard access, the **Edit** action's label/touch target, preserved options after reopen, and no horizontal overflow. A mocked product test does not replace checking the live merchant's saved catalog data.

Automated mocked Chrome coverage exercises direct addition and a product with variants, a required sauce, optional extras, an extra quantity limit and price calculation. It also edits a cart line, verifies saved selections and quantity/note retention, and confirms cancelling a later edit leaves the saved configuration intact on desktop/phone. Product setup, live merchant catalog data and operator acceptance remain separate checks.

Manual regression card for the complete correction:

1. Add a simple item without choices; it should add directly. Open a configurable product and confirm its required choices remain explicit.
2. Confirm an unpaid local test order, inspect its same identity/lines/amount, close and reopen payment, navigate away/back and reload. The committed unpaid order must remain discoverable and resumable without recreating it.
3. For an amount due of 34.86 EGP, keep cash at 34.86 and add terminal 10.00. Expect an explicit overallocated-payment message and a disabled write action. Change cash to 20.00, cash received to 25.00, and terminal to 14.86; expect a 34.86 proposal, zero balance afterward and 5.00 change. These are UI proposals until explicitly submitted against a disposable local order.
4. Settle a disposable local test check once, inspect its saved receipt, return and close checkout. Verify the selling view shows the settled financial state and receipt/new-sale actions. Reopening must show saved payment state and must not collect again.
5. At 1440x900 and 390x844, in Arabic/English and both themes, review long item labels, one/multiple checks, mixed tenders, partial payment, invalid entries, pending/recovery states and receipt actions. On phone, repeat with the keyboard open. Existing idempotency, revision checks, split conservation and receipt immutability remain required.

### Cross-page visual correction — Step 8: cashier shift page

This slice refines `/shift` only. The page now has deliberate responsive top spacing, a short task description and a wider content frame; the open-shift card uses semantic success and information tokens that follow both POS themes, and gives register/branch identity, opening operator/time, and the opening cash float distinct hierarchy. The new-shift form groups branch, register and float inputs with consistent touch-sized controls and a clear saved-request explanation. Missing branch assignment and an empty register list now have separate guidance; retry reloads whichever register or current-shift query failed. A failed register/current-shift read now blocks opening until the state is successfully checked, preventing an uncertain state from looking like an empty register. An unreadable saved operator name uses the localized fallback. Tailwind utilities, shared POS tokens and the existing `Input`/`PosButton` are used. This opening-page slice left shift-open behavior unchanged; blind count and close behavior are covered by M8.1 below.

The focused mocked browser suite is `tests/ui/pos-shift.spec.ts`, run with `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-shift.config.ts --reporter=list`. It covers the new-shift form, open-shift attribution/float, light/dark theme switching, no-branch and no-register states, register/current-shift query failures and retries, opening blocked during uncertainty, Arabic unreadable-name fallback, blind count, supervisor approval, unsettled-check blocking, close report and responsive fit at 1440×900 and 390×844. M8.1's run passed 22/22 cases. Mocked HTTP validates the UI only; it does not validate a live register or shift transaction.

Before Step 9, manually review this screen with a local test cashier and the disposable **POS Testing Register** from the [local POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md):

1. Open `/shift` at 1440×900, 1920×1080, 768×1024 and 390×844. Compare its card hierarchy and spacing with the prototype's POS language. Confirm the page has clear breathing room below the workspace header and that the title/status align without crowding. Check English/light, English/dark, Arabic/light and Arabic/dark. Confirm no horizontal scrolling; labels and controls should remain readable and comfortably tappable on phone.
2. With an already-open test shift, verify the branch, register, opening operator, opening time and opening cash float match the local data. The status treatment should remain readable in both themes. Confirm the note explains that operators share one register shift while sales retain individual employee attribution. Do not close the shift.
3. With a disposable register that has no open shift, inspect branch/register selection, the opening float field, its currency context, validation, offline disablement and the primary **Open shift** action. Only submit an opening amount if this is the isolated local test register; then confirm the resulting open-shift facts. Never open a shift on a real merchant register for visual review.
4. Inspect no-active-branch, no-register, loading, register/current-shift error and retry states where available. A missing branch assignment must tell the user to request assignment; a branch with no register must tell the owner to configure a register. While either register lookup or current-shift lookup is failing, confirm **Open shift** is unavailable. Trigger **Retry** and confirm the correct read recovers before the form returns.
5. Toggle the browser offline without submitting a shift request. Confirm the connection state is visible and opening is unavailable. If reviewing a saved uncertain opening request, use only the disposable local register and verify recovery reuses that exact request; do not create a second opening request to resolve uncertainty.
6. Use keyboard Tab/Shift+Tab and touch to change selectors, enter the float and reach the primary action. Check focus visibility, Arabic wrapping, number/currency alignment, button reachability above the mobile navigation and that no content is clipped.

Report any mismatch with route, theme, language and viewport, preferably with a screenshot. The next planned slice is `/login`; this step does not add shift close, cash movements or reconciliation.

### Cross-page visual correction — Step 9: cashier sign-in

This slice replaces the generic shared-app wrapper on `/login` with a focused POS entry screen that uses the same Tailwind utilities, semantic POS theme tokens, orange default accent and shadcn-style inputs/buttons as the cashier workspace. Following the operator's screenshot feedback and explicit request to implement the refinement, the page now uses one centered card up to 440px wide, one sign-in heading/description, a compact 64px header and 48px fields/submit control. The duplicate side panel and decorative continuation text are removed. Flex sizing allows short screens to scroll naturally while avoiding unnecessary vertical scroll on the supported full-height viewports. The shared password visibility control has readable theme-aware foreground/background and focus states scoped to login. Language and light/dark controls remain available before authentication, using saved POS appearance preferences. Arabic/RTL, password show/hide, required fields, loading, failed credentials, session verification errors and retry are supported. The existing React Query session lookup, `/auth/pos/login` request, session cache update and redirect are unchanged; this is a frontend visual slice with no API or database changes.

The focused mocked browser suite is `tests/ui/pos-login.spec.ts`, run with `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-login.config.ts --output=apps/pos/test-results/login-refinement --reporter=list`. The final isolated run passed **12/12** cases. It covers successful credential payload and redirect, pending submit state, invalid credentials retaining the business code/username, session-check retry, both themes, Arabic RTL, password visibility and required fields. The additional layout case checks the single centered card, reachable submit and absence of unnecessary page overflow at 1920x1080, 1440x900, 768x1024 and 390x844 across both languages/themes, plus submit reachability at 390x500. Set `POS_LOGIN_CAPTURE=1` to save the layout matrix screenshots under the test output directory. HTTP responses are intercepted; this does not establish live authentication, merchant provisioning or credential correctness.

Before marking `/login` visually accepted, use the local cashier fixture in the [local POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md), never production credentials:

1. Open `/login` at 1440×900, 1920×1080, 768×1024 and 390×844. Review English/light, English/dark, Arabic/light and Arabic/dark. Confirm there is one centered sign-in card, one heading and no repeated side panel; fields and submit should be 48px tall. Confirm the form and header fit without unnecessary vertical/horizontal scrolling, text collision or clipped focus rings. At 390x500 or with the mobile keyboard open, scroll to the submit control and verify it remains reachable. The light/dark choice should survive a reload and match the chosen appearance in the workspace.
2. Tab through language, theme, business code, username, password visibility and **Sign in**. Confirm visible focus, browser autofill labels, sensible field order, touch-sized controls and right-to-left alignment in Arabic. Show and hide the password; confirm the toggle remains readable in both themes and the value remains unchanged. Enter business code and username, then change language/theme: the entered values must remain. While signing in, confirm the loading label is clear and a second submission is disabled.
3. Submit an intentionally incorrect password with the disposable local account. Confirm a clear error appears, the business code and username remain filled, and retry is possible. Do not repeatedly guess a real employee password.
4. Sign in once with the known local test cashier. Confirm the entered business code/username reach the login request and the app redirects to the POS workspace for that cashier. Do not open a shift, accept an order, sell, or collect payment as part of the login check.
5. Reload `/login` while authenticated and confirm it returns to the workspace. Sign out only if this local test session is safe to end. With the API unavailable, confirm the session-check retry is visible and that retrying does not submit credentials or create a new session.

Record any mismatch with route, theme, language and viewport. The mocked UI suite does not replace checking a real local test account; manual login review remains pending.

### M2 — POS employee logout revokes only the current session

POS logout deletes the hashed token for the session in the current cookie and clears that cookie. Logging out one device must not sign out the same employee's other active sessions. Disabling an employee or changing their password revokes all of that employee's POS sessions; role and branch changes are reloaded by still-valid sessions.

Automated database verification:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:employees-db` against the already migrated local PostgreSQL database. The rollback-only fixture verifies the current session, role/branch refresh and employee deactivation, then creates two sessions for one cashier, logs out one, verifies that only its hashed token was deleted and confirms the other session still authenticates.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api typecheck` and `lint`, then `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test` for the affected API regressions. No migration is required.

Manual acceptance (pending; use only the local test cashier): sign in from two isolated browser contexts, sign out in one, and verify `/auth/pos/me` rejects that context while the second remains authenticated. Then deactivate the cashier from the owner employee screen and verify the remaining context is rejected. Never use a real operator account for this test. The database test verifies server behavior; it does not replace a live browser/cashier walkthrough.

### Cross-page visual correction — Step 10: POS consistency regression

This is a final visual and route regression pass across `/login`, incoming orders (`/`), live selling (`/catalog`), dining (`/dining`), receipt history/detail (`/receipts`), and shift management (`/shift`). The pass confirms that the POS semantic Tailwind theme, saved appearance and language, page hierarchy, shared header/navigation, accessible controls and responsive behavior remain coherent after the bounded page refinements. It also updates the integrated cashier browser test to use current labels and status semantics and to navigate to incoming orders before asserting its Arabic state; no app behavior, API, payment or register rule changed in this regression pass.

Run the POS focused browser configs recorded in `docs/features/pos/PROGRESS.md`. In this pass they completed **77/77** mocked Chrome cases across the prototype design, owner-to-cashier flow, login, incoming orders, selling, dining, receipts, checkout and shifts. These isolated browser checks establish rendered UI and intercepted-request behavior only; they do not replace real cashier, printer, payment terminal or merchant-data validation.

Before visual acceptance, use the local cashier fixture and inspect the active routes without submitting any order, payment, shift opening/closing, kitchen action or refund:

1. At 1440×900 and 1920×1080, then 768×1024 and 390×844, check `/`, `/catalog`, `/dining`, `/receipts`, `/shift` and `/login`. Review English/light, English/dark, Arabic/light and Arabic/dark. The authenticated routes should share the same POS identity, spacing, theme, language behavior and navigation while each page keeps its own task hierarchy.
2. Confirm the rail/header do not cover content, titles and primary actions stay reachable, long labels/currency do not collide, the pages have no horizontal overflow, and mobile navigation leaves enough room for the current task. On `/dining` and `/receipts`, confirm **Refresh** stays in the page header.
3. Check the selling grid/cart density, order and kitchen ticket status hierarchy, occupied/free table distinctions, receipt identity/amounts, checkout balance/tender summary, shift/register identity, and login validation against the prototype and saved local data. Compare Arabic layout as RTL, especially mixed English identifiers, dates and EGP amounts.
4. Use keyboard and touch through navigation, search, order/draft controls, receipt actions and shift controls. Verify visible focus and controls remain usable at the smallest viewport. Avoid submitting any state-changing action during this visual sweep.
5. Capture a screenshot and report route, theme, language and viewport for any remaining mismatch. For live data or device issues, report those separately from visual differences; mocked browser results do not validate backend or hardware behavior.

The manual cashier/operator visual review remains the final acceptance gate. The POS route regression suite is complete; no further UI slice should begin until these findings are reviewed.

## Confirmed launch decisions

| ID      | Decision                                                                                                                                                                                                                                                         | Consequence                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D01 | CONFIRMED: takeaway, delivery, dine-in, tables, and bill splitting are required in the first release.                                                                                                                                                            | Dining and split checks are release requirements, not follow-up enhancements.                                                                                                 |
| POS-D02 | CONFIRMED: cash plus manually recorded payments on an external terminal; support multiple tender methods on one bill.                                                                                                                                            | No payment-provider integration or automatic terminal verification in the first release.                                                                                      |
| POS-D03 | CONFIRMED: online operation with saved drafts and recovery after reconnection.                                                                                                                                                                                   | No offline sale confirmation, stock posting, or settlement.                                                                                                                   |
| POS-D04 | CONFIRMED: Tailwind CSS, shadcn/ui, Zustand, and TanStack React Query.                                                                                                                                                                                           | Shared UI primitives; explicit separation of client state and server state.                                                                                                   |
| POS-D07 | CONFIRMED, 2026-10-17: one shift per register with individually attributed operators; cashier and supervisor roles. Supervisors approve discounts, voids, and refunds; numeric thresholds are unset.                                                             | Existing staff grants remain unchanged; new role capabilities require explicit owner assignment.                                                                              |
| POS-D08 | CONFIRMED, 2026-10-17: recipe stock is deducted at kitchen acceptance; every new pending order freezes its ingredient requirements; pending recipe edits are allowed; products without explicit stock mapping retain legacy variant reservations until migrated. | Snapshot requirements at order creation, post RECIPE consumption once at acceptance, post DIRECT consumption at POS confirmation, and retain unsnapshotted legacy safeguards. |
| POS-D13 | CONFIRMED, 2026-10-17: light and dark themes have equal support across POS and kitchen screens.                                                                                                                                                                  | Complete semantic theme tokens, preserved workspace state on switch and verification in both themes.                                                                          |

Additional confirmed design decisions, 2026-10-17:

- **POS-D14:** merchant-configurable POS accent, orange by default. Preserve equal light/dark support and keep POS appearance scoped; changing this setting does not rebrand other applications.
- **POS-D15:** the supplied screenshots are the design reference. Define missing tokens/components in this repository; no external design-system source/code is currently supplied.
- **POS-D16:** first receipt target is **80mm thermal plus printable/downloadable PDF**. The user has deferred official Egyptian Tax Authority integration; ordinary POS receipts must not claim fiscal status. POS-D10 remains partially open for printer/OS/browser, physical printable width, scanner/drawer needs, terminal policy and PDF implementation.
- **POS-D17 (DEFERRED, 2026-10-20):** POS discount application, supervisor discount workflow and discount reporting are deferred from the current release. Do not apply discounts or report discount totals until the user reopens this scope. Existing supervisor role grants remain unchanged.

Target split modes are by selected items/quantities, equal shares, and custom amounts; details and correction policy are POS-D05 below. Hardware models were not supplied. No tax rate or service-charge percentage has been configured. No ETA adapter has been implemented; fiscal issuance is deferred and ordinary receipt/PDF output is not a tax invoice or eReceipt.

## Outcome and release boundary

A cashier must be able to open a shift, create or receive an order, manage a table, send work to the kitchen, collect one or more payments, issue/reprint a sale document, hand over the order, handle an authorized cancellation/refund, and reconcile the drawer. The kitchen must see the correct work and amendments. Owners must trace every commercial and inventory effect.

First release includes:

- Fast catalog search, existing optional variants/modifiers, quantities, barcode lookup where configured, customer/fulfillment details, notes, suspended carts and server quotes. POS discount application is deferred under POS-D17.
- Orders from POS and storefront; DIRECT, RECIPE, and mixed-order compatibility with explicit stock handling.
- Dine-in tables, active table sessions, additional rounds, moving a session between available tables, and split checks.
- Cash, external-terminal records, partial payments, split tender, outstanding balances, and supported refunds.
- Kitchen display (KDS), station routing, ticket amendments, item readiness, order readiness, and fulfillment confirmation.
- Immutable sale receipts, print/PDF output, reprints, linked refund/correction documents, shifts, cash movements, permissions, approvals, audit history, and operating reports.
- Arabic/English, RTL/LTR, keyboard/touch operation, recoverable requests, real database integration tests, and an operational pilot.

Deferred: direct payment-gateway/terminal integration, full offline selling, loyalty, gift cards, customer credit/accounts receivable, advanced promotions, reservations, graphical floor-plan editing, driver dispatch/routing, marketplace connectors, full accounting, and jurisdiction-specific fiscal integration. Required legal/fiscal integration must be resolved before launch in a jurisdiction that requires it; deferral is not permission to launch without it.

## Repository baseline — EXISTING snapshot before M1 implementation, 2026-10-17

The table below records the pre-implementation audit, not the current source state. Current POS implementation changes are summarized above and evidenced in [PROGRESS.md](PROGRESS.md).

| Area         | Observed implementation                                                                                                    | Limit                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS          | `src/Login.tsx`, `POSLayout.tsx`, `POSScreen.tsx`, `routes.tsx`, cookie-based API client                                   | Incoming recipe-order queue; no selling cart, table, tender, shift, or receipt workspace.                                                                |
| Staff        | Auth-owned POS employees and branch assignments; guards reload current grants                                              | Shared permission values are only `accept_recipe_orders` and `start_preparation`; broader roles are not implemented.                                     |
| Orders       | `StorefrontOrdersService`, `OrderLifecycleService`, immutable price/selection snapshots                                    | Status union includes pending, accepted, rejected, preparing, ready, completed and cancelled; POS handover is gated by order-check settlement.           |
| Stock        | Recipe acceptance consumes through Inventory in one transaction; pre-preparation cancellation can reverse original batches | Legacy variant reservations and new recipe handling coexist. Do not deduct both. Current recipe configuration is protected while pending orders need it. |
| POS actions  | Branch-scoped listing, accept, start preparation, saved request IDs, 15-second polling                                     | POS does not expose owner rejection/cancellation; listing is not a complete all-order history.                                                           |
| Styling      | Tailwind v4 Vite plugin, shared theme import, POS `components.json` targeting `@waffarly/ui`                               | Existing POS layout still uses substantial feature CSS; expand shared shadcn primitives deliberately.                                                    |
| State        | Component-local state and sessionStorage for uncertain commands                                                            | POS manifest does not yet declare Zustand or React Query, although the workspace lockfile contains them for other consumers.                             |
| Verification | Existing API/database tests and mocked Playwright POS scenario; historical evidence in inventory progress                  | No fresh runtime tests in this documentation task; mocked browser responses do not establish live integration or production readiness.                   |

Evidence: [POS screen](../../../apps/pos/src/POSScreen.tsx), [POS manifest](../../../apps/pos/package.json), [POS contracts](../../../packages/contracts/src/pos.ts), [order contracts](../../../packages/contracts/src/catalog.ts), [schema](../../../packages/database/prisma/schema.prisma), and [inventory delivery history](../inventory/PROGRESS.md).

## Architecture and dependency boundaries

### Backend ownership

Keep the NestJS modular monolith. POS is an access channel; do not introduce a catch-all backend `pos` module or separate sale rules for owner/storefront/cashier controllers. Extend existing owners first. Introduce only two new business modules for the initial target: `shifts` and `payments`.

| Owner              | Owns                                                                                                                          | Allowed business-module dependencies — TARGET                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `auth`             | Sessions, staff branch grants, operational permissions, supervisor identity/approval authorization                            | Existing dependencies only; no commerce-module import.                                         |
| `catalog`          | Sellable configuration, authoritative pricing, product inventory requirements                                                 | `auth`, `inventory`; never Orders.                                                             |
| `inventory`        | Locations, balances, exact quantities, movement ledger                                                                        | `auth`; never Orders, Payments, or Catalog services.                                           |
| `shifts` — new     | Registers, shift lifecycle, cash journal, closing reconciliation                                                              | `auth`.                                                                                        |
| `payments` — new   | Payment/refund attempts, tenders, allocations, immutable financial records                                                    | `auth`, `shifts`.                                                                              |
| `orders` — extend  | Order/sale orchestration, bills/checks, dining sessions/tables, kitchen work, sale documents, cancellation/return eligibility | `auth`, `catalog`, `inventory`, `shifts`, `payments`.                                          |
| `reports` — extend | Bounded/aggregated operational read models                                                                                    | Existing `auth`; scoped SQL projections over commercial tables, no command-service dependency. |

POS-D14 is implemented by `merchants`: owner settings use authenticated `GET/PATCH /owner/merchant/pos-appearance`, while assigned POS employees read the merchant accent through `GET /pos/appearance`. Merchant identity comes from the authenticated actor, writes use optimistic revision checks and record the last editor, and device light/dark preference remains local UI state. Orders retains issuance/immutable document snapshots; no generic Settings module or dependency from Merchants to Orders was added.

Orders is the transaction coordinator. It passes an active transaction and validated immutable facts into exported Payments/Shifts commands. Payments owns amount/allocation invariants and records attributable cash-journal effects through Shifts. Neither module imports Orders services. Compound same-merchant foreign keys may reference order/bill rows without reversing application dependencies. Orders owns order/bill HTTP payment/refund workflows; avoid a second public path that bypasses its locks and eligibility checks.

Kitchen transitions initially remain an Orders subdomain; KDS is a filtered projection of persisted work, not a second order state machine. Sale-document creation also remains within Orders initially. Extract a new module only when independent behavior justifies it and document the resulting dependency graph.

Imports cross module boundaries through `index.ts` only. New exports must be intentional. Register new modules/providers and update `AppModule`, `apps/api/eslint.config.mjs`, and the current architecture document in the implementation slice that introduces them. This plan does not silently change today's allowed imports.

### Frontend state ownership

| State                                                                                                           | Owner                                                 | Rules                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Session, branch/register permissions, catalog, quotes, orders, tables, KDS, shifts, payments, receipts, reports | TanStack React Query                                  | Server is authoritative; do not mirror entity collections into Zustand.                   |
| Active cart ID, suspended cart drafts, proposed item selections/notes, local workspace preferences              | Feature-scoped Zustand stores                         | Draft data only; no authoritative price, stock, paid flag, permission, or order status.   |
| Order filters, search, selected history item, shareable route context                                           | React Router URL/search params                        | One source of truth; no duplicate store copy.                                             |
| Temporary input, dialog visibility, focus, field validation                                                     | Local React state                                     | Do not globalize transient component state.                                               |
| Uncertain mutation envelope                                                                                     | Dedicated recovery persistence + query reconciliation | Separate from carts and query cache; survives reload, never becomes a client-side ledger. |

Use one QueryClient per authenticated app runtime; query-key factories include merchant, branch, relevant register/station, resource IDs, filters, and pagination. Identity comes from the authenticated session, not editable request tenant fields. Example shape: `['pos', merchantId, branchId, 'orders', filters]`. Session queries use an identity-safe key before tenant context is available.

- Queries flow from feature API functions through query-option/hook files into components. The HTTP client owns transport, credentials, typed errors, abort signals, and response handling; it contains no commercial rules.
- Mutations use explicit hooks and typed contracts. Successful commands reconcile their returned authoritative resource and invalidate affected orders, bills, tables, KDS, shift, receipt, and stock-availability queries as appropriate.
- Do not optimistically finalize payments, refunds, stock, kitchen acceptance, or permission changes. Local cart editing may be immediate.
- Configure refetch/retry by resource. Poll operational queues initially, pause hidden views, refetch on focus/reconnect, and show last-sync/stale/error state. Do not let polling discard loaded pages or late branch responses overwrite the current branch.
- Mutation retries are explicit and reuse the original command key. A Query mutation cache alone is not durable recovery. Never automatically replay financial writes on reconnect.
- Persist only versioned draft fields with a migration/expiry policy. Partition by merchant, employee, branch and device; avoid customer PII in durable drafts by default. No tokens, payment card details, authoritative totals, or permissions in local persistence.
- Branch switching preserves drafts in their original scope and requires reconciliation of pending work. Logout/account switch cancels queries and clears visible caches/stores; unresolved command envelopes remain inaccessible to another identity and recoverable by the same authorized actor. Never replay a revoked actor's command as a new employee.
- Add exact dependencies to `apps/pos/package.json` and update the lockfile in the foundation slice after checking the installed versions/documentation. Other applications need not migrate state management in this workstream.

### Tailwind and shadcn/ui

Use Tailwind v4 utilities, existing theme tokens and `cn`, and the shared adapted shadcn/ui sources under `packages/ui/src`. Extend missing Dialog/AlertDialog, Sheet, Select, Tabs, DropdownMenu, Popover, Tooltip, Toast, and form/table primitives as needed; do not generate duplicate app-local primitives or a second theme. Follow existing package exports and `components.json` aliases. Verify runtime alias resolution when adding `@/` imports; TypeScript paths alone do not configure Vite.

Keep POS business components in the app. Prefer token classes and logical spacing (`ps`, `pe`, `start`, `end`, `text-start`); reserve local CSS for print/page rules or layouts that need it. Shared primitive changes must preserve other apps. Use the existing LocaleProvider and translation catalog, accessible labels, visible focus, semantic statuses beyond color, and at least 44px primary touch targets. Cashier workflows must work without a mouse.

Implement light/dark/system preferences through shared semantic tokens; both themes support the same screens, controls and operational states. Theme/language switching preserves drafts, focus and pending recovery. Follow the UI/UX companion for compact categories, persistent order context, separate kitchen/payment actions and design review gates; styling must not implicitly resolve open commercial policies.

## Target folder structure

These are destinations, not a request to scaffold empty files. Create each file only with the slice that uses it; keep small features flat. Migrate the current entry components incrementally while retaining the existing queue and login behavior.

```text
apps/pos/src/
  main.tsx
    app/
    providers.tsx                  # locale and QueryClient
    router.tsx
    pos-layout.tsx                 # session, branch/register, shift/connectivity shell
  components/                      # cross-feature POS presentation only
    money-text.tsx
    command-status.tsx
  lib/
    api-client.ts
    query-client.ts
    query-keys.ts
    recovery/                      # scoped/versioned uncertain command envelopes
      command-storage.ts
      command-reconciliation.ts
  features/
    prototype/                     # development-only sample interactions; no live API client
    auth/                          # login and session query
    workspace/                     # production POS frame, branch/register and preferences
    catalog/                       # sellable search/configurator, server quote queries
    sales/
      sales-page.tsx
      sales.api.ts
      sales.queries.ts
      sales.mutations.ts
      cart.store.ts
      cart.persistence.ts
      cart.types.ts
      components/
        product-grid.tsx
        cart-panel.tsx
        product-configurator.tsx
        suspended-carts.tsx
    orders/                        # list/detail, lifecycle commands, event history
    dining/                        # tables, session detail, split-check workspace
    checkout/                      # tender dialog, balances, payments/refunds
    kitchen/                       # station queue, ticket/detail, ready actions
    shifts/                        # opening, cash movements, count/close
    receipts/                      # immutable document view, print/PDF, reprints
    reports/                       # permission-filtered shift/sales views
  styles/
    pos.css                        # minimal app rules
    print.css

apps/api/src/modules/
  auth/                            # extend existing permissions/approval authorization
  catalog/                         # extend existing POS sellable/quote reads
  inventory/                       # reuse ledger; add only required movement behavior
  shifts/
    shifts.module.ts
    shifts.controller.ts
    shifts.schemas.ts
    shifts.service.ts
    shifts.rules.ts
    shifts.persistence.ts
    index.ts
  payments/
    payments.module.ts
    payments.schemas.ts
    payments.service.ts
    payment.rules.ts
    payment.persistence.ts
    index.ts                       # commands called by Orders; no bypass controller
  orders/
    orders.module.ts
    index.ts
    storefront-orders.*            # retain current compatibility surfaces
    order-lifecycle.*
    order-stock.persistence.ts
    sales/                         # cashier creation/confirmation and amendments
      pos-sales.controller.ts
      sale.schemas.ts
      sale.service.ts
      sale.persistence.ts
    billing/                       # bill allocation, split rules, tender orchestration
    dining/                        # table config, occupancy, session movement
    kitchen/                       # tickets, station routing, item progress
    receipts/                      # immutable sale/correction snapshots, numbering
  reports/                         # scoped SQL aggregates/projections

packages/contracts/src/
  index.ts                         # preserve existing root exports
  pos.ts                           # preserve employee exports
  pos-sales.ts
  pos-dining.ts
  pos-kitchen.ts
  payments.ts
  shifts.ts
  sales-documents.ts
packages/database/prisma/
  schema.prisma
  migrations/<timestamp>_<slice>/migration.sql
packages/ui/src/                   # shared shadcn primitives/theme/localization
apps/merchant-dashboard/src/features/
  staff/                           # extend permission controls
  pos-settings/                    # registers, tables/stations, approved policies
apps/api/test/{http,unit,database,support}/
apps/pos/src/features/<feature>/*.test.ts
tests/ui/pos-*.spec.ts
docs/features/pos/{FEATURE,PROGRESS}.md
```

Within frontend features, use `<feature>.api.ts`, `.queries.ts`, `.mutations.ts`, `.types.ts`, optional `.store.ts`, and `components/` only where needed. Cross-feature imports use a deliberate public entry point; avoid circular imports between Dining, Checkout, and Orders by composing them at route/page level. Reuse transport contracts instead of duplicating server types. Pure draft types stay local. Never import Prisma or API implementations in frontend/contracts.

## Domain model and invariants — TARGET

These are conceptual entities, not final Prisma names. Finalize exact fields, indices and migrations per milestone.

| Owner                          | Entities and facts                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders                         | Existing order aggregate extended with source, branch, operational number, revision, fulfillment details and attributable events; immutable line revisions and preparation notes. |
| Orders / Dining                | PosDiningTable, PosDiningSession, table assignment; one active session per occupied table; a session groups multiple order rounds and their checks.                               |
| Orders / Billing               | Bill/Check and item or monetary allocations; multiple checks belong to one order, not duplicate sales.                                                                            |
| Orders / Kitchen               | KitchenStation, Ticket, TicketLine, immutable amendment/cancellation events, actor/time and order revision.                                                                       |
| Payments                       | PaymentAttempt, successful Payment, bill/line allocation, Refund and refund allocation linked to original successful payment.                                                     |
| Shifts                         | Register, Shift, append-only CashMovement/journal and close snapshot. Register is a server identity, not an arbitrary browser device ID.                                          |
| Orders / Documents             | SaleDocument/lines, immutable totals and tax/discount breakdown when enabled, document number, original-document links, reprint audit.                                            |
| Orders / Inventory integration | Frozen consumption requirements/version for new accepted lines, linked original stock batches, return/waste/restoration decisions.                                                |

Core invariants:

1. Merchant comes from the actor. Every order, bill, payment, table, station, shift, warehouse and nested reference is merchant-scoped; branch and register grants are additional constraints. Use compound database relationships and test foreign-tenant references.
2. Order execution, payment summary, kitchen progress and dining occupancy are separate facts. Derive payment balances from successful immutable allocations and refunds; a cached summary is updated transactionally, never trusted from the client.
3. Prices and totals are EGP decimal strings at HTTP boundaries, integer arithmetic internally using existing money helpers. EGP is the only supported currency; reject other currency codes and define deterministic cent allocation for equal splits/discounts. No float-based settlement.
4. Requote cart changes on the server. Quotes carry expiry/revision/fingerprint context; confirmation revalidates it. Changed prices or unavailable choices require cashier review, never silent repricing of a confirmed sale.
5. Every command has a merchant-scoped request key and payload fingerprint. Replay returns its recorded result; reuse with another payload conflicts. Resource revisions protect edits. A timeout is unknown, not a failed sale.
6. Historical product names, modifiers, prices, approved discounts, charge/tax breakdowns and stock-consumption facts remain stable after catalog edits. New snapshot policy must be introduced explicitly; do not infer missing facts on old orders.
7. Financial and inventory records are append-only. Corrections are attributable linked compensating actions, not deletion or overwriting of history.
8. Operational/document numbering is uniquely allocated under concurrency in a defined merchant/branch series; never use `MAX + 1`. Confirm numbering/legal requirements before fiscal issuance.

### Orders, tables and split bills

Execution target: `pending -> accepted -> preparing -> ready -> completed`, plus explicit reject/cancel paths. Instant-fulfillment products may use a documented no-preparation path; do not fake kitchen events. Existing statuses and legacy routes remain compatible during additive migration.

| Command                        | Required execution state                          | Result / separate obligations                                                                                            |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Accept                         | Pending                                           | Accepted; selected branch and stock effects recorded atomically.                                                         |
| Reject                         | Pending                                           | Rejected; release only the original eligible reservations.                                                               |
| Start preparation              | Accepted                                          | Preparing; preserve previously frozen requirements.                                                                      |
| Mark ready                     | Preparing, or the documented no-preparation path  | Ready only when all required uncancelled station work is ready.                                                          |
| Complete / hand over           | Ready, or the documented instant-fulfillment path | Completed; enforce the fulfillment type's payment policy.                                                                |
| Cancel remaining work          | Accepted, preparing or ready                      | Cancelled or a recorded partial-line amendment; stage-specific waste/restoration and refund obligations remain explicit. |
| Return / refund completed sale | Completed                                         | Linked return/refund records; preserve the original completed-sale history.                                              |

Whole-order cancellation cannot hide completed/served portions. For partial fulfillment, cancel eligible remaining quantities through line amendments and calculate payment/refund obligations from the retained and cancelled quantities. No normal command reopens a rejected/cancelled/completed order; corrections need their own audited operation.

- Takeaway customer identity is optional unless operational policy requires it; delivery needs contact/address and a defined fee policy. Dine-in links a table session. Do not invent placeholder phone numbers to satisfy the current storefront schema: add a channel-specific contract.
- Suspended local carts are not accepted kitchen orders. Active dining sessions and rounds are server-persisted and visible to authorized staff on another device.
- Add each new dine-in round as a separate POS order attached to the active session; snapshot and post only the new round's lines and stock delta. Prior paid/prepared lines cannot be silently edited.
- Table occupancy is database-enforced under simultaneous assignment. Moving a session locks origin/destination in stable order, requires an available active table at the same branch, and preserves its orders/checks. Table merging is deferred.
- Split by items/quantities: allocate every original sale-line quantity exactly once, including its selected modifiers, without creating stock-bearing orders. Quantities stay whole integers; an order line may be divided across checks by whole units.
- Split by equal/custom amounts: allocate exact cents, with deterministic remainder distribution for equal shares. The checks must sum to the full order total; tax, discounts and fees cannot be duplicated. One split basis applies per order at a time.
- Unpaid checks may be reorganized at the current order revision. Once a check is settled, its allocation is immutable; corrections use the later approved adjustment/refund policy. POS-D05 confirms split modes and quantities, table moves/merge scope, and the shift-close block; paid correction authorization remains under POS-D11/M7.
- Split bill and split tender are different: one check may be paid with cash plus external terminal; multiple checks still reference the same order. Payment/refund caps include all checks and previous actions.
- Session closure requires fulfilled or explicitly cancelled work and all balances/refunds resolved; a busy table does not become free merely because one check was paid. Authorized early table release, if desired, needs a separate recorded policy.

### Payments, cancellation and returns

Payment attempt target: pending, succeeded, failed, or reconciliation-required. Bill summary derives unpaid, partially-paid, paid, partially-refunded or refunded; unresolved attempts are shown separately. A refund does not reopen a cancelled order's debt automatically.

- Record cash received, applied amount, and change separately; only applied amount settles debt. Reject over-allocation; require an open authorized register shift for financial actions. Successful cash refund/movements affect the current shift while retaining the original sale/payment link.
- External-terminal tender is a cashier-confirmed external payment record with method, amount, actor, terminal/reference when available, and confirmation time. Do not imply provider verification. Recover an uncertain recording by checking its command result, not by asking the customer to pay again.
- Partial payment keeps the balance visible; multiple simultaneous tenders cannot exceed it. New funds need a new command; retrying an old tender reuses its key.
- Before preparation: authorized rejection/cancellation can release reservations or restore original consumed batches according to explicit handling. After preparation: cancellation stops remaining work but consumed ingredients normally remain consumed and are linked to waste; never restore ingredients solely because money was refunded.
- Refund amount/quantity cannot exceed original settled amounts/returnable quantities net of prior successful or reserved in-progress refunds. Partial line returns include proportional original discounts/tax under the approved policy.
- Cancellation, physical return/restocking, waste, and financial refund are separate recorded decisions. Restock to sellable/non-sellable requires supported item handling and permission; prepared food cannot be reverse-manufactured automatically.
- Every sensitive action needs a reason and current permission; supervisor approval is bound to actor, exact action payload/revision, threshold and expiry. Revalidate at execution and log both identities; never share a supervisor session or accept an arbitrary PIN as authorization.

### Kitchen and inventory

- Route confirmed lines to configured same-branch stations, displaying table/order number, age, fulfillment type, variants/modifiers and notes. Kitchen data excludes unnecessary customer/payment details.
- Kitchen line progress supports queued/preparing/ready/cancelled, station completion and whole-order readiness. Avoid duplicate tickets on retry. Record acknowledgement of amendments/cancellations; never silently remove already displayed work. M6.5 shows last successful queue freshness and pauses new actions while a refresh is in flight, fails, or the POS is offline; an exact saved action may still be retried online. M6.6 allows additive order lines only before kitchen acceptance, with one unpaid unsplit check; the original sent lines remain unchanged and the POS resends only the new line snapshots through the existing ticket/order projection.
- POS-D06 confirms dispatch at POS sale confirmation for takeaway/delivery, explicit cashier dispatch per dine-in round, full settlement before handover, and one default Kitchen station per branch. M6.1 implements tickets/dispatch, M6.2 implemented the initial whole-ticket transition, M6.3 enforces settlement before handover, and M6.4 tracks POS ticket lines and promotes the ticket to ready only after every line is ready.
- New DIRECT stock integration uses Catalog's mapping and Inventory's ledger. Preserve legacy tracked-variant reservations until an explicit cutover marks a line's handler. Never consult current product mode to guess historical posting.
- Recipe handling deducts stock at kitchen acceptance. New orders freeze ingredient requirements at creation, so later recipe edits cannot change pending work. Existing pending orders without snapshots retain their configuration lock and use the compatibility calculation until resolved.
- DIRECT stock is consumed at POS order confirmation. Unmapped legacy variants retain the existing reservation/release path until explicitly migrated. Each order line has exactly one stock handler; never debit both variant reservation stock and the inventory ledger.
- Stock shortage follows the merchant's configured policy. Failure leaves no partial order acceptance, tender allocation or stock movement. Void/return of DIRECT goods and recipe waste use distinct handling.

### Sale documents, shifts and reporting

- A pre-payment bill is labeled as a bill; a payment acknowledgement is distinguishable from a final sale receipt. Final documents freeze commercial facts and settled allocations. For split checks, issue a document per settled check and a clearly labeled order summary; reports must not count both as revenue.
- Support thermal print layout and downloadable PDF, plus searchable/reprintable history after reload. Browser printing is the initial adapter candidate, subject to hardware confirmation; silent printing, drawer pulses and physical success acknowledgement are not promised by browser print completion.
- Keep number issuance/snapshot creation in the sale transaction; rendering and printer I/O happen after commit. A printer failure never creates another sale. Reprints retain the original number and are audited as copies.
- Shift target: open -> closing -> closed. Enforce one open shift per register. Each command records its actual employee actor even when multiple operators use that register shift. Opening float, cash sale, refund, paid-in, paid-out and cash drops have distinct signed journal entries/reasons.
- Closing records a blind declared count, expected cash, variance, actor and approval where needed. Cash received minus change is net cash tender. Exclude external-terminal payments from drawer cash, report them separately, and show refunds occurring in later shifts correctly.
- A close locks the shift against new tenders, resolves pending attempts, computes a consistent journal snapshot and persists it. No ordinary posting into a closed shift; late corrections are linked entries in an open shift under approval.
- A shift cannot close while any order check assigned to it remains unpaid or partially paid. M8 must enforce this against the payment ledger; open balances stay separate from drawer cash. Each payment retains its original shift attribution.
- Reports use successful payments/documents and explicit adjustments, not the existing accepted/preparing-order totals alone. Distinguish sales, collected money, refunds, outstanding balances, waste and cash variance. Aggregate in scoped SQL with bounded detail queries.

## Transactions, transport and recovery

### Atomic command boundary

For a combined online sale/round confirmation, Orders validates actor and grant, locks affected register/shift and order resources, requotes, persists immutable lines/bill allocations, invokes Inventory and Payments/Shifts exports as needed, creates sale documents and kitchen work, and records the command result in one database transaction. Only effects applicable to that command occur; accepting an unpaid dine-in round does not invent a payment.

Use caller-owned transaction clients; no nested independent commits. Define and test one global lock order: affected shifts/registers in stable ID order, then orders/dining tables in a documented stable sequence, then bills/payment records, then Inventory's existing ordered resource locks. Commands using a subset must preserve that order. Shift close and tender must serialize on the same shift lock. Bound transaction size and retry serialization conflicts with the same command identity.

No printer, PDF renderer, network provider, or notification I/O inside a database transaction. Persist required durable kitchen/print/notification intent with the transaction when asynchronous delivery is needed; handlers must deduplicate and re-read committed state. Initial KDS polling reads committed database tickets without introducing a broker. Add a transactional outbox worker when external delivery is introduced, not an in-memory event bus as the only delivery guarantee. External payment integration later requires a separate reconciliation design and cannot be made atomic by holding a DB transaction open.

### Planned HTTP families

Route names are targets to finalize with contracts; retain existing routes during migration.

| Family                            | Owner / behavior                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/pos/*`                     | Existing Auth login/session; extend effective permissions.                                                                       |
| `GET /pos/catalog`, `/pos/quotes` | `GET /pos/catalog` is implemented as a tenant-scoped, employee-authenticated sellable read; authoritative quotes remain planned. |
| `/pos/registers`, `/pos/shifts/*` | Shifts-owned assignment, open, cash movements, count/close.                                                                      |
| `/pos/orders/*`                   | Orders list/detail/create, confirm/rounds/amendments, lifecycle and history.                                                     |
| `/pos/orders/:id/split-checks`    | Orders allocates one POS order into whole-item, equal-cent or custom-cent checks with revision/idempotency checks.               |
| `/pos/dining/*`                   | Orders-owned table occupancy and open-session reads; same-branch move to an available table.                                     |
| `/pos/kitchen/*`                  | Orders-owned station projections and ticket progress.                                                                            |
| `/pos/sales-documents/*`          | Orders-owned issued document reads, PDF/print data and reprint audit.                                                            |
| `/owner/pos/registers`            | Implemented Shifts-owned, branch-scoped register list/create/update; assignment is enforced in POS shift reads/commands.         |
| `/owner/pos/tables`               | Orders-owned, branch-scoped dining table list/create/update; occupied tables cannot be edited or deactivated.                    |
| `/owner/pos-settings/*`           | Planned Shifts/Orders-owned station, appearance and approved policy setup; no duplicate business logic.                          |
| `/owner/reports/pos/*`            | Reports-owned scoped aggregates/export.                                                                                          |

Each mutation contract documents request ID, target revision if editable, actor/grants, bounded payload, response and allowed transitions. Lists use bounded cursor pagination and explicit filters. Shared contracts expose decimal strings and framework-independent values only; preserve root exports. Keep existing error shapes compatible while adding stable error codes for invalid input, forbidden action, stale revision, shortage, payment conflict and reconciliation-required outcomes. Do not encode business decisions by matching English error text.

### Online interruption behavior

Persist the command ID and exact payload before sending a commercial mutation. If safe persistence is unavailable, block that mutation with a recoverable explanation. Network timeout leaves the envelope unresolved; query its authenticated recorded result or replay the same idempotent command. Never generate a new key to bypass uncertainty. Clear the envelope only after a definitive response or explicitly recorded resolution.

When disconnected, show a persistent connection state, allow draft editing, and disable sale confirmation, tender, refund, kitchen and table mutations. Reconnect refetches authoritative state before actions resume. No background sync of financial commands. Preserve existing uncertain accept/preparation requests during migration of sessionStorage to the new recovery mechanism; document compatibility/expiry handling rather than dropping them.

## Permissions and audit — TARGET

Define server-enforced capabilities for sell/confirm, accept, prepare, mark-ready, handover, manage-tables, split-bills, collect-payment, discount within limit, reject/cancel by stage, refund, restock, cash movement, open/close shift, reprint and view reports. Role presets (cashier, kitchen, supervisor, owner) compose permissions; branch/station/register assignments constrain them. UI visibility is not authorization. Do not auto-grant new money-moving capabilities to existing employees during migration.

Audit commands include actor ID, supervisor if applicable, merchant/branch/register/shift, request key, order revision, reason, timestamp, linked document/payment/movement and outcome. Log structured IDs without passwords, session tokens, card data or unnecessary customer PII. Effective deactivation/grant changes apply on the next request.

## Delivery milestones and dependencies

Every row is required for the complete first release unless explicitly marked deferred. Ship vertical slices behind controlled enablement; none alone proves production readiness.

| ID  | Slice                                                      | Depends on           | Exit condition                                                                                                     |
| --- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| M0  | Source audit, feature/progress contract, decision register | —                    | Baseline and confirmed/open decisions recorded.                                                                    |
| M1  | POS frontend foundation                                    | M0                   | QueryClient, scoped stores/recovery, shared UI, router shell; existing queue/login retained and verified.          |
| M2  | Register, shift, permissions foundation                    | M1; D07              | Authorized staff can select register/open shift; uniqueness and grant enforcement proven.                          |
| M3  | Cashier sales and stock compatibility                      | M2; D08              | Server quote, carts/suspend, sale confirmation, DIRECT/RECIPE/mixed handling, immutable facts and retry safety.    |
| M4  | Dining sessions and split checks                           | M3; D05              | Table assignment/move, rounds, item/equal/custom splits conserve quantity/money under concurrency.                 |
| M5  | Tenders and sale documents                                 | M3, M4; D09, D10     | Cash/external terminal, split tender, partial payment, issuance/reprint/PDF and unknown-result recovery.           |
| M6  | Kitchen and fulfillment                                    | M3, M4; D06          | Stations, amended tickets, item/whole-order readiness, handover; integration with M5 policy verified.              |
| M7  | Cancellation, refunds, returns and approvals               | M5, M6; D11          | Before/after preparation, partial refunds, caps, waste/restock and supervisor attribution verified.                |
| M8  | Shift close, reports and owner configuration               | M2, M5, M7           | Complete drawer reconciliation, reporting, settings and audit; opening-only M2 is insufficient.                    |
| M9  | Release hardening and pilot                                | M1–M8; D09, D10, D12 | Live integration, contention/recovery, actual devices, operational monitoring/backup restore and pilot acceptance. |

## Open decisions and implementation defaults

These do not block writing the plan or independent foundation work. Resolve each OPEN decision before its dependent slice; do not repeatedly ask for confirmed D01–D05, D07, or D13–D16. POS-D05 is confirmed for split modes, whole quantities, session moves, deferred table merge and the shift-close block. Paid-check correction authorization remains under POS-D11/M7. POS-D16 settles 80mm/PDF output; the remaining POS-D10 hardware/adapter details stay open.

| ID      | OPEN decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Proposed default / dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D06 | CONFIRMED, 2026-10-19: cashier sends each dine-in round explicitly; takeaway/delivery dispatch on POS order confirmation; full payment is required before handover; one default Kitchen station per branch for the first release.                                                                                                                                                                                                                                                                                                      | M6; handover must check all split-check balances.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| POS-D09 | DEFERRED by user, 2026-10-17: no ETA fiscal integration in current scope                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Build ordinary POS receipt output only; do not claim it is a tax invoice/eReceipt. Revisit ETA only if the user changes scope or a launch requirement is established.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| POS-D10 | Remaining printer/OS/browser, physical printable width, PDF adapter, drawer/scanner needs and terminal reference policy                                                                                                                                                                                                                                                                                                                                                                                                                | 80mm thermal + printable/downloadable PDF confirmed under D16. The live receipt uses browser print and Save as PDF; physical device/adapter acceptance and direct one-click PDF generation remain open before M5/M9.                                                                                                                                                                                                                                                                                                                                                                                                   |
| POS-D11 | PARTIALLY RESOLVED by M7.1/M7.2/M7.3: unpaid orders may be cancelled before preparation with a reason and branch-scoped `approve_voids` approval; paid tenders may be refunded only against their original payment allocations with `approve_refunds`; item returns are recorded only against handed-over POS sale lines, with remaining whole-unit quantities, a reason and the same branch-scoped return approval. The first return release records returned goods as waste and never infers that prepared goods are safe to resell. | Cancellation restores only recorded stock/reservations and sends a kitchen stop notice. A physical item return is a non-monetary waste record: it does not alter the original sale receipt, check balance or stock, and does not issue a refund. To return money, use the separate original-tender-linked refund flow; external terminal refunds are completed manually first and recorded with their reference; cash refunds post as negative movements in an open branch shift. Restocking, returned-item resale, no-receipt returns and corrections outside the original sale remain deferred pending owner policy. |
| POS-D12 | Deployment topology, register/device provisioning, business-day timezone, retention, expected load and performance budget                                                                                                                                                                                                                                                                                                                                                                                                              | Keep POS as existing app; merchant/branch timezone and realistic peak-load fixtures must be explicit. Resolve before M9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Verification and release gates

### M5.5 cashier handoff — tender concurrency and print-failure isolation

Run automated race/rollback checks only against the configured local test database, never production:

1. From the repository root run `pnpm --filter @waffarly/api build`, then `pnpm --filter @waffarly/api test:pos-db`. The PostgreSQL test must prove that two simultaneous copies of one exact payment command return the same recorded result and create one payment/journal effect; two different commands competing to collect 0.75 EGP each against a 1.00 EGP balance produce one success, one conflict, and a remaining 0.25 EGP; and a simulated cash-journal failure rolls back payment, journal, order-revision and check-settlement writes together.
2. Run `pnpm exec playwright test --config playwright.pos-receipt-detail.config.ts --reporter=list`. The receipt-output failure case must show an accessible error while keeping the settled receipt visible, reopening it from history after reload, and sending no second payment command. Record that this suite intercepts HTTP and is not a live browser-to-API/database test.

Before the next dependent POS step, manually verify in a local development environment with a test cashier, test register/shift and migrated test database:

Prepare the cashier and register using the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md). Its seed creates an isolated merchant, branch, recipe product and cashier account; the owner must assign the cashier role and create a register before opening a shift.

1. Create a small EGP test order and settle it using cash plus a manually recorded terminal tender. Confirm that the receipt appears once, shows the item, total and both tender methods, and remains available in Receipts after leaving the checkout and reloading the page.
2. On the saved receipt page, open browser developer tools and temporarily run `window.print = () => { throw new Error('blocked'); };`. Click **Print / Save PDF**. Confirm an inline error explains that the receipt is saved, the receipt contents remain visible, and the Network panel shows no new `POST .../payments` request.
3. Return to Receipts, reload, reopen the same receipt, and confirm its receipt number and totals are unchanged. Reload the page to restore the browser’s normal print function, choose **Print / Save PDF**, select **Save as PDF**, and verify the output is 80mm wide with no on-screen action buttons.

Pass means payment/journal state is unchanged by print failure, no racing tender exceeds the balance, and the same receipt can be reopened and printed without another collection. Do not use a production order or real customer payment for these checks. Physical-printer/driver acceptance is still a separate M9 task.

### M6.1 cashier handoff — default station and dispatch tickets

This slice persists a default `Kitchen` station per branch and one immutable-order-backed ticket per POS order. Takeaway/delivery ticket creation is atomic with sale confirmation. Dine-in rounds require **Send to kitchen** after confirmation. The incoming-orders page displays ticketed POS orders plus the existing storefront recipe queue, and recipe stock still posts only on kitchen acceptance. The database migration also backfills active POS orders as `legacy` tickets so existing kitchen work remains visible. M6.1 does not implement item-ready state, whole-order readiness, handover, or the full-payment handover barrier.

Automated checks for this slice:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database db:validate` and `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database build` to validate the schema and regenerate the client.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api typecheck`, `lint`, and the focused tests: `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api exec tsx --test --test-concurrency=1 test/unit/pos-kitchen.test.ts test/http/pos-payments.e2e.test.ts`. These cover helper/service behavior and an HTTP controller with mocked providers, not PostgreSQL persistence.
3. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-checkout.config.ts --grep "dine-in rounds|checkout switches allocated quantities" --reporter=list` and `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-queue.config.ts --reporter=list`. The incoming-orders suite also forces an Arabic HTTP 500 and checks that it is not shown as invalid cashier input. These suites intercept HTTP; they do not create a real sale, payment, stock movement, or kitchen ticket.

Manual local acceptance requires an isolated development database with this migration applied, the local demo cashier/register, and a disposable test branch. Use the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md) for setup. Apply pending migrations only to that test database with `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database exec prisma migrate deploy --config ./prisma.config.ts`. Do not use production or a real customer order.

1. Sign in to the test cashier, open the test register shift, start a dine-in order at an available table, add one recipe-mapped item, and confirm the order. Before dispatch, verify the confirmed-order panel says the round is waiting and the incoming kitchen queue does not show it.
2. Click **Send to kitchen** once. Verify the panel changes to **Sent to kitchen** and names `Kitchen`; open incoming orders and verify exactly one ticket shows the correct table code, item/options/note, station and manual dispatch time. Refresh the queue and confirm it remains one ticket. Confirm dispatch did not record payment or deduct recipe stock.
3. Accept that recipe ticket once from the kitchen queue. Verify the order becomes accepted and the snapshotted recipe requirements are deducted once; start preparation and verify the ticket changes to preparing. Do not cancel or hand over this order in M6.1.
4. Create one disposable takeaway order and one delivery order. Confirm each appears once in the kitchen queue immediately after sale confirmation with automatic dispatch metadata. Do not hand them over; the full-settlement gate is not implemented in this slice.
5. If testing historical compatibility, use a fresh test database containing active POS orders from before this migration. Apply the additive migration and verify each pending/accepted/preparing POS order gets one `legacy` ticket and remains visible. Never run a database reset to set up this test.

Pass means dine-in dispatch is cashier-controlled per round, takeaway/delivery dispatch is automatic at confirmation, a branch never receives a ticket from another tenant/branch, duplicate retries do not create a second ticket, and recipe stock remains acceptance-timed. Record actual browser/API/database results in PROGRESS. The migration was applied to the local development database on 2026-10-19; live cashier/order/stock acceptance remains pending. After the M6.1 flow is verified, continue with the M6.2 readiness checks below; handover remains out of scope.

### M6.2 cashier handoff — ticket readiness

This slice adds a ticket-level `preparing -> ready` transition to the Orders lifecycle. An authorized POS employee with `start_preparation` can mark a ticket ready only after preparation starts. The command records `readyAt` and a replayable `ready` action; replaying the same request returns the original result without another transition. Ready tickets remain visible in the kitchen queue, and recipe-based stock remains deducted at kitchen acceptance. The inventory configuration report continues to include accepted, preparing and ready orders so a ready transition does not remove already-consumed stock from reporting. The first release has one default station per branch, so readiness covers the whole ticket. Per-item/multi-station readiness, handover/completion, the confirmed full-payment handover barrier, and cancellation/refund policy are not implemented here.

Automated checks for this slice:

1. Validate/build contracts and the database package, and confirm the additive `readyAt`/enum/status migration is applied to the isolated local development database. Do not reset a database.
2. Run the serialized API HTTP/unit suite: `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api exec tsx --test --test-concurrency=1 test/http/*.test.ts test/unit/*.test.ts`, then the focused PostgreSQL suite: `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api exec tsx --test --test-concurrency=1 test/database/recipe-order-lifecycle.database.test.ts`.
3. Run API and POS typecheck/lint/build, `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/ui build`, POS unit tests, and `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-queue.config.ts --reporter=list`. These checks cover command authorization/idempotency, queue visibility, timestamps, and stock/report stability; mocked browser tests do not replace a cashier-to-database review.

Manual local acceptance (use only the isolated local database, a disposable test order, and the demo cashier/register in the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md)):

1. Sign in to the local demo cashier. Open `/dining`, choose an available test table, add one recipe-mapped product, and confirm the dine-in order. Before dispatch, open `/` (**Incoming orders**) and verify the round is absent. Return to the confirmed order, click **Send to kitchen** once, then return to `/` and verify one ticket appears with the expected station, table/order reference, item, variant/options and kitchen note. Use only a disposable test branch/order, never a customer/production order.
2. Accept the ticket once. Verify its state becomes **Accepted** and, for a recipe-mapped item, its frozen recipe quantities are deducted once. Repeat the same acceptance only if the UI explicitly offers a retry; verify the same saved outcome and no second stock movement.
3. Start preparation. Verify the ticket changes to **Preparing**. Before preparation, the ready action must be unavailable. Open the order in another tab or reload the queue and ensure the current state is shown from the server.
4. Click **Mark order ready** once. Verify the ticket moves to **Ready**, shows the localized ready time and stays in the queue. Refresh/reopen the queue and ensure it remains Ready. Confirm there is no new stock movement and no payment, completion or handover action was triggered.
5. Check the order's product configuration/inventory report, if available: the ready order must remain in totals for the same date range. Review Arabic/English, light/dark, desktop and phone layouts, keyboard focus, pending/error states and retry messaging. Stop here; do not hand over or mark the order completed.

Record which steps passed, any HTTP/API error, and observed order/stock values in PROGRESS. M6.1 live cashier/order/stock acceptance and M5.5 cashier payment/receipt acceptance remain separate pending checks. The operator requested continuing to later slices while this M6.2 review remains pending; complete all handoff cards before release acceptance.

### M6.3 cashier handoff — payment-gated order completion

The live POS queue now provides **Confirm handover** for a ready, ticketed POS order to an employee with `sell`. The queue shows whether every check for that order is settled; the action stays disabled while any check remains unpaid. `POST /pos/orders/:id/handover` repeats that rule inside the Orders transaction, scopes the order to the employee's assigned branch, and persists the completion time and idempotent action result. A retry after an uncertain response reuses the same request ID.

For dine-in, handing over one round does not release the table while other rounds remain open. Orders locks the table and session, re-reads the session's orders/checks, and closes the session only when every round is completed or cancelled and every check is settled. Completed recipe orders remain in product configuration/inventory-consumption reporting because their stock was already consumed at kitchen acceptance. This is whole-ticket handover for the first release's single default station; item readiness was added in M6.4. Multi-station completion, cancellation, and refunds remain out of scope here.

Automated verification for this slice:

1. Run the Orders lifecycle and kitchen unit/HTTP tests, including unauthorized/missing-`sell` route checks, unsettled split-check rejection, same-request replay, and queue eligibility for fully paid versus unpaid checks.
2. Run the `pos-dining.database.test.ts` PostgreSQL integration flow. It creates two dine-in rounds on one table, splits the first round into two checks, verifies handover is blocked before settlement and after only one check is paid, then verifies the table stays occupied after the first round and is released only after the second paid round is handed over. The test cleans its own fixture rows.
3. Run POS typecheck/lint/build/unit tests and `playwright.pos-queue.config.ts`. The browser test verifies unpaid handover is visibly disabled, refreshes after simulated settlement, posts one handover command and removes the completed ticket from the active queue. These browser fixtures intercept HTTP; only the PostgreSQL integration test exercises real transaction persistence.
4. Validate/build the database and contracts packages, apply the additive handover migration only to the isolated local development database, and run API typecheck/lint/build plus scoped formatting/diff checks. Do not reset a database or apply this migration to production as part of local acceptance.

Verification result (2026-10-19): migration `20261019140000_pos_kitchen_handover` is applied to local PostgreSQL `waffarly` at `localhost:5433`, and Prisma reports all 40 migrations up to date. Serialized API HTTP/unit tests passed **153/153**; the POS dining PostgreSQL integration passed **1/1**, including split-check gating, same-request replay, two rounds on one table, session release and continued inventory reporting for a completed order. POS unit tests passed **21/21**; incoming-orders Playwright passed **6/6** across desktop/mobile. API/POS typecheck, lint and build, contracts/database/shared-UI validation/build and scoped Prettier/diff checks passed. The POS bundle reports the existing large-chunk advisory (**734.68 kB** minified). Mocked UI tests do not replace the cashier handoff below. Live cashier acceptance remains pending.

Manual local cashier acceptance (pending; use only a disposable local cashier, branch, table and orders from the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md)):

1. Create a dine-in round, send it to the kitchen, accept it, start preparation and mark it Ready. Open the POS queue and verify **Confirm handover** is disabled with the message that every check must be settled.
2. Split that round into two checks. Pay only the first check, refresh the kitchen queue, and verify handover remains disabled. Pay the remaining check and refresh again; verify the UI now says all checks are paid and enables handover.
3. Add a second round to the same table and send it through the kitchen to Ready. Hand over the first fully paid round. Verify that round completes but the table remains occupied because the second round is still open.
4. Settle every check on the second round and hand it over. Verify the session closes and the table becomes available. Reload Dining and the kitchen queue to confirm the saved state. Do not use a real customer order or perform cancellation/refund tests here.
5. Also verify one fully paid takeaway/delivery order can be handed over, while Arabic/English, light/dark, desktop/phone and offline-disabled action states remain clear. Record actual UI/API/database outcomes in PROGRESS; the mocked Playwright scenario alone is not operator acceptance.

Pass means no ready order can be handed over with an unpaid check, exact retries do not create a second completion, and dine-in tables remain occupied until every round is terminal and fully settled. Keep M6.1–M6.4 cashier acceptance and M5.5 payment/receipt acceptance separately tracked; the operator requested continuing while handoffs remain pending. Complete them before release acceptance.

### M6.4 cashier handoff — per-item kitchen readiness

Each POS kitchen ticket now shows readiness on its individual order lines. An employee with `start_preparation` can mark one complete line (including its full quantity) ready after preparation starts. The parent POS order stays **Preparing** until every line is ready, then receives its normal `readyAt` timestamp and becomes eligible for M6.3's payment-gated handover. `POST /pos/orders/:id/items/:lineId/ready` is branch-scoped, locks the parent order, and records an idempotent action. The prior whole-ticket `POST /ready` remains for legacy recipe orders but is rejected for ticketed POS orders. The first release still uses one Kitchen station per branch; this slice does not add partial-quantity readiness, additional stations, cancellation or stock/payment effects.

Automated verification for this slice:

1. Validate/build the database and contracts packages and apply `20261019160000_pos_kitchen_item_readiness` plus `20261019170000_pos_kitchen_item_ready_action` only to the isolated local development database. The additive migrations add a nullable timestamp, carry already-ready/completed POS ticket lines forward using their saved order readiness timestamp, and allow the auditable `ready_item` action kind; do not reset a database.
2. Run API lifecycle unit and employee-route tests. Verify the first line-ready action persists without changing the ticket status, the last line-ready action changes the ticket to Ready once, exact retries replay, and the old whole-ticket route cannot bypass per-line readiness for POS tickets.
3. Run the `pos-dining.database.test.ts` integration flow with a two-line POS ticket. Verify the first line stays Preparing, the final line makes it Ready, saved line timestamps survive query reloads, and handover still blocks until every check is settled.
4. Run POS typecheck/lint/build/unit tests and `playwright.pos-queue.config.ts`; the browser fixture verifies both line actions, progress count, item timestamp, final ticket transition and subsequent M6.3 payment gate. Mocked browser responses do not replace PostgreSQL or cashier acceptance.

Manual local cashier acceptance (pending; use the isolated demo cashier, branch, register and disposable orders from the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md)):

1. Create a takeaway or dine-in order containing at least two different product lines. Send it to the kitchen (dine-in requires **Send to kitchen**), accept it, and start preparation. Confirm the queue shows both lines and `0 of 2 items ready`.
2. Mark the first line ready. Confirm its own timestamp/status changes, the queue says `1 of 2 items ready`, and the order remains **Preparing** with no handover action. Refresh or reopen the queue and verify the first line remains ready.
3. Mark the second line ready. Confirm the ticket becomes **Ready**, both lines retain their timestamps, and the existing settlement message/action is shown. If the order is unpaid, handover must remain disabled; do not record a payment just for this readiness check.
4. If the first response becomes uncertain, retry only the saved action and confirm the same line remains ready without another state change. Check that readiness does not change payment totals, receipts or stock. Review Arabic/English, light/dark, desktop and phone layouts.

Record the actual line names/statuses, timestamps, request results, payment/stock observations, theme/language/device and any failure in PROGRESS. M6.1–M6.3 cashier acceptance and M5.5 payment/receipt acceptance remain separate pending checks.

### M6.5 cashier handoff — kitchen queue freshness and offline safety

The kitchen queue now shows when its current branch data last loaded successfully. While an online refresh is in progress, the browser is offline, or a background/manual refresh fails, new kitchen actions are paused against the prior list. If a refresh fails after data loaded, the existing list stays visible with its last-success time and an explicit retry instruction. Exact previously saved idempotent actions may still be retried while online; offline blocks every write. A successful refresh clears the warning and re-enables new actions. This is a frontend freshness guard; it does not replace API-side state/permission checks or persist a kitchen queue offline.

Automated verification for this slice:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/ui build`, then `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos typecheck`, `lint`, `test` and `build`.
2. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-queue.config.ts --reporter=list`. Desktop and phone cases must verify last-success time, a failed refresh retaining the list and blocking new actions until a successful refresh, offline notice/action blocking, and retry of an exact saved action while online without changing its request ID.

Manual local cashier acceptance (pending; use the isolated demo cashier and branch from the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md)):

1. Open the kitchen queue with a disposable local setup and wait for its first successful load. Verify **Last updated** appears. Press Refresh and confirm new actions remain unavailable during the read, then return when it succeeds and verify the time advances.
2. With orders visible, disconnect the browser/network in DevTools. Confirm the queue keeps the last loaded tickets, states when that data was loaded, and disables accept, preparation, ready and handover actions. Reconnect and refresh; verify the warning clears and actions return.
3. While leaving the browser online, stop the local API briefly or make the queue GET fail. Press Refresh and verify the saved-in-memory list stays visible with a stale-data warning, new actions stay disabled, and retrying after the API recovers restores actions.
4. If an exact pending action exists, retry only that saved action while online and confirm it reuses the same request ID. Do not create a new kitchen action from stale data. Review Arabic/English, light/dark, desktop and phone layouts.

Record the refresh result, displayed last-success time, action enabled/disabled state, reconnect behavior, language/theme/viewport and any errors in PROGRESS. This does not accept M6.1–M6.4, M5.5, live browser-to-API behavior or the full offline POS; POS-D11 cancellation/refund policy remains open.

### M6.6 cashier handoff — add items before kitchen acceptance

The cashier may add new lines to a POS order that has already been sent to the kitchen only while the kitchen ticket remains pending, the order has exactly one open whole check, and no payment or split allocation exists. The cashier chooses from the live catalog and uses the same product-choice flow as a new sale. Previously sent lines are shown read-only; the cart contains only additions and distinguishes their amount from the resulting order total. Sending the update appends immutable line/choice/note snapshots to the existing order and ticket projection. It does not change an existing line, collect a payment, create another sale/check, or dispatch a second ticket. A revision and idempotency key protect retries. DIRECT stock follows the existing sale-confirmation policy, recipe requirements are frozen and remain deducted at kitchen acceptance, and unmapped legacy variants keep their current reservation behavior.

Automated verification:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, then API and POS `typecheck`, `lint`, `build`, and `test` scripts.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api exec tsx --test --test-concurrency=1 test/unit/pos-orders.test.ts test/http/pos-employees.e2e.test.ts` for policy gates and authenticated-route wiring.
3. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:storefront-orders-db` against an already migrated PostgreSQL database. The real database scenario must prove that the order/check total and frozen lines update once, replay does not duplicate a line or stock movement, recipe stock stays unchanged until kitchen acceptance, and additions are rejected after acceptance.
4. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-checkout.config.ts --grep "kitchen items|add-items control" --reporter=list`. The mocked browser must prove read-only original lines, separate add-on/result totals, uncertain-response exact retry, and hidden controls after acceptance, payment or split. This does not replace live API/database acceptance.

Manual local cashier acceptance (pending; use a disposable cashier/register and the local POS demo guide):

1. Open a shift and create a takeaway order with one configurable item. Confirm it so the existing order appears in the kitchen queue. Before anyone accepts it, reopen the confirmed order and choose **Add items to this order**.
2. Confirm the previously sent item and its options appear in a read-only section. Add a second simple or configurable item. Verify the cart shows only the addition, while its summary separately shows the addition amount and new order total. Send the items once. In order history and the kitchen queue, verify the original line/options are unchanged, the added line appears exactly once, the same order/check total increases, and no payment/second ticket is created.
3. On another disposable pending order, cause the add-items request to time out after sending, reload the POS and reopen the confirmed order. Choose the saved retry. In DevTools Network compare both POST bodies: request ID, revision and line IDs must match exactly. Confirm the added line and amount appear once. Never make a replacement request with a new ID while the result is uncertain.
4. Use separate disposable orders to verify each stop condition: accept one from the kitchen; record a partial payment on another; split another order's check. Refresh/reopen each cashier order and verify **Add items to this order** is unavailable. Do not attempt to bypass the interface during normal operation.
5. Repeat the successful case in Arabic/RTL and English/LTR, light and dark themes, and a phone-width viewport. Record order references, line names/options, before/after totals, kitchen state, request/retry result, payment/check state, theme, language, viewport and errors in PROGRESS. This does not validate physical printer behavior, multi-station routing, cancellation/refunds, or a production deployment.

Required scenarios (track individually in Progress):

1. Open shift, sell configured DIRECT/RECIPE/mixed products, record exact payment/change, issue receipt, kitchen readiness/handover, close shift and reconcile.
2. Occupy a table from two terminals; exactly one conflicting assignment succeeds. Add rounds; move table; split checks by items/equal/custom amounts; combine tenders; settle all checks and close the session without duplicate stock/revenue.
3. Concurrent tenders/refunds cannot exceed balances or quantities. Concurrent split edits conflict by revision. Tender racing shift close either posts in the closing snapshot or is rejected without partial effects.
4. Timeout before/after database commit, reload, reconnect, same-key replay, changed-payload conflict, revoked permission, branch/account switch and unavailable local storage. Exactly one commercial result is retained.
5. Cancellation before/after kitchen start, partial preparation, paid cancellation, partial refund, original-batch restoration and waste/restock remain distinct, with valid approvals.
6. Catalog/recipe/price edits preserve historical checks, requirements, sale documents and linked refunds. Existing storefront/legacy reservations remain correct through migration.
7. Printer unavailable/PDF failure and repeated reprint do not recreate sale/payment. Arabic RTL, keyboard-only, touchscreen, translated errors and narrow-screen overflow are checked on actual target viewports.
8. Foreign-tenant/branch/register/station references and disabled employees are rejected on reads and commands. Kitchen permissions do not expose financial/customer details unnecessarily.
9. Fresh and representative additive migrations, rollback/feature-disable procedure, monitored failure/latency metrics, restore rehearsal and representative peak-volume queries are verified. No database reset to make tests pass.

Use focused pure-rule tests, HTTP authorization/contracts, real PostgreSQL transaction/race tests, and Playwright scenarios. Keep mocked UI checks distinct from live browser -> API -> migrated database tests. Run affected package typecheck/lint/build/tests and the API checklist, including affected database suites. Future new suites must be wired into package scripts and CI when introduced. Follow `.node-version`; use filtered package commands, and read bundled Turbo documentation before changing Turbo behavior.

Production acceptance requires M1–M9 completed with evidence, all mandatory decisions resolved, and a real pilot reconciled by the operator. Document any measured limits. No performance or production-ready claim follows from source review, a successful build, or mocked UI tests alone.

### POS request duplication and preflight handoff

The shared API client sends `Content-Type: application/json` only when a string request body is present, avoiding a cross-origin preflight for bodyless GETs. API fetches use `cache: 'no-store'`; React Query remains the application cache. The incoming-orders query is not invalidated during initial workspace hydration because enabling the query already starts its first read. Shared query defaults still refetch on reconnect; kitchen and dining pages intentionally poll every 15 seconds. React StrictMode can show a cancelled GET during development effect replay; this is not a second successful read and remains enabled to catch lifecycle defects.

Automated coverage:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos test` for bodyless/JSON API request-option behavior.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos typecheck` and `lint`.
3. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-queue.config.ts --reporter=list`. The mocked queue test asserts one successful initial list response and that its GET has no JSON content-type header; it does not prove the API server's CORS configuration.

Manual verification: reload the local incoming-orders page with DevTools Network open and cleared. Expect one successful `GET /pos/orders?...` and no JSON `Content-Type` request header or corresponding `OPTIONS` preflight. One cancelled development GET from StrictMode is acceptable. Wait for the next 15-second poll and check that focus/reconnect causes one refresh. Repeat in a production preview to distinguish development StrictMode behavior. Keep M6.1 cashier/order/stock acceptance pending until its separate handoff passes.

### M7.1 cashier cancellation - unpaid orders before preparation

The live POS can cancel an entire POS order only while its state is Pending or Accepted and preparation has not started. Any recorded tender blocks cancellation, including a partial payment; those orders must use the separate refund workflow. The cashier must supply a reason. If the cashier does not hold `approve_voids`, a different active employee with that permission and an assignment to the same active branch must approve with their current credentials. Passwords are checked for the request and never written to local POS recovery storage. The transaction rechecks the actor and approver, branch, order state and payment count while holding the order lock.

Cancellation restores only inventory effects linked to this order: consumed DIRECT/RECIPE ledger batches and legacy variant reservations. The reversal, order state/reason/time, open-check cancellation and idempotent action/audit entry commit together. A POS kitchen ticket remains visible as a cancellation alert until a kitchen employee with `accept_recipe_orders` acknowledges it. A cancelled dine-in round releases its table only when every other round is terminal and all remaining checks are settled/cancelled. A retry uses the same saved request ID/reason after reload; the cashier re-enters supervisor credentials when approval is needed. Replacing a saved command first refreshes order and payment state. No payment/refund, after-preparation, item-level return, waste or no-receipt policy is implemented in M7.1.

The API contract is `POST /pos/orders/:id/cancel` and kitchen acknowledgement is `POST /pos/orders/:id/cancellation-acknowledgement`. POS order cancellation is Orders-owned; Auth validates approval credentials and Orders rechecks current database permissions inside its serializable transaction. The migrations add cancellation acknowledgement/approver attribution and permit the two new action kinds. Both are additive and were applied only to the configured local development database.

Automated verification for M7.1:

1. Build contracts/database and validate Prisma; run API/POS typecheck. Run `pnpm --filter @waffarly/api exec tsx --test --test-isolation=none --test-concurrency=1 test/unit/order-lifecycle.test.ts test/unit/pos-kitchen.test.ts test/http/pos-employees.e2e.test.ts` for policy, authorization, idempotency, kitchen acknowledgement and HTTP wiring.
2. Run `pnpm --filter @waffarly/api test:pos-db` against the migrated local PostgreSQL database. It verifies cancellation audit references, cancelled checks, supervisor attribution, kitchen acknowledgement and exact replay. Run `pnpm --filter @waffarly/api test:storefront-orders-db`; its real transaction scenario verifies original DIRECT and RECIPE consumption batches and legacy reserved variants are restored once by a POS supervisor-approved cancellation. Run `pnpm --filter @waffarly/api test:employees-db` for current credential/branch/permission checks.
3. Run `pnpm --filter @waffarly/pos test` for scoped exact cancellation recovery in Zustand without credentials, then `pnpm exec playwright test --config playwright.pos-checkout.config.ts --grep "cashier recovers the exact unpaid cancellation" --reporter=list`. Playwright intercepts HTTP; it verifies reload recovery, blank supervisor password after reload, exact request identity and successful completion on desktop/mobile. It is not live browser-to-API proof.
4. Run the API checklist (typecheck, lint, build and all HTTP/unit tests), POS typecheck/lint/build/tests, Prisma validation and `git diff --check`. Confirm migration status without resetting the database. Record the results and limits in PROGRESS.

Manual local cashier/kitchen acceptance (pending; use the local disposable cashier, supervisor, kitchen employee and register from the [local POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md); never use a real customer order):

1. Open a test shift. Create one takeaway order with a kitchen ticket and one dine-in round on a test table; dispatch the dine-in round manually. Leave both unpaid and before acceptance. Confirm the cashier panel exposes **Cancel unpaid order** and shows the actual order reference, service/table, due balance and ticket status.
2. Start cancellation on a disposable takeaway order. Submit a blank reason, then a reason with whitespace only; both must be blocked. Enter a reason but use an invalid supervisor password, an employee assigned only to another branch, the cashier's own username, or an employee without `approve_voids`; each must fail without changing order/check/ticket state or stock. Correct the credentials and retry the same saved request.
3. On a separate unpaid pending order, cancel successfully with a cashier plus branch supervisor. Confirm the response/order shows Cancelled, the exact reason and time; the open check is cancelled; the order audit identifies the cashier as actor and supervisor as approver; there is one cancellation action and one set of stock reversals. Reload the cashier order and compare the saved facts.
4. Interrupt a cancellation response after the request is sent, then reload. The cashier must see **Retry saved cancellation** with the original reason. Re-enter supervisor credentials; in DevTools compare request IDs and reason across attempts. They must match; no credential may appear in localStorage or the saved workspace. If the server confirms the order is still cancellable, use the explicit refresh-and-replace control before changing the reason/request.
5. Sign into the kitchen station and refresh the queue. Verify the cancelled ticket remains with a clear stop notice and reason. A kitchen user without permission cannot acknowledge it. An authorized kitchen user acknowledges once; refresh and verify it leaves the active queue. Repeat the same acknowledgment after an interrupted response and confirm no duplicate action.
6. With test inventory, compare ledger balances before/after cancelling one pending DIRECT order, one Accepted-before-preparation RECIPE order and one legacy reserved-variant order. Each original effect must be reversed once using the original item/warehouse/variant. Verify the immutable original sale lines remain for audit. No unrelated stock balance may change.
7. Test a dine-in cancellation with another active round on the same session: the cancelled round's check becomes terminal, but the table remains occupied. Cancel/complete the final round and settle/cancel its checks; verify the session then closes and the table becomes available. Do not merge tables.
8. Attempt cancellation on separate part-paid, fully paid, Preparing, Ready and Completed orders. The button must be absent or the API must reject the stale command; no order, payment, stock or kitchen state may be partially changed. Paid orders wait for M7.2 refund flow.
9. Repeat display and keyboard checks in Arabic/RTL and English/LTR, light and dark, at desktop 1440x900 and a 390x844 phone viewport. Check reason/approval validation, focus order, password clearing, narrow-screen scrolling, queue cancellation alert and no horizontal overflow. Native printer/device and live operator acceptance remain separate.

Pass requires the transaction and authorization rules above, exact same-command recovery, one-time stock/check effects, kitchen acknowledgement, and no cancellation of paid or in-preparation orders. Automated tests are evidence for code paths, not a substitute for the pending operator handoff. M7's cancellation, refund and item-return implementation slices now have automated coverage; real cashier acceptance remains pending.

### M7.2 supervisor-approved refunds against original tenders

The refund command is available from a confirmed POS order only for the remaining amount on a recorded original tender. Each allocation names the original payment row, so cash can only be returned against cash and an external terminal refund can only be recorded against that terminal payment. Every request needs a reason and an open register shift at the order's branch. A cashier needs a different active, branch-assigned supervisor with `approve_refunds`; an employee already holding that grant can approve their own action. Credentials are verified for the request and excluded from the saved retry command.

For a terminal tender, the operator must complete the refund on the payment terminal first and enter its reference before recording it in POS. POS does not call a processor or move external funds. Cash refunds create a negative cash movement in the selected open shift. The POS caps every original tender's cumulative refunds at its captured amount, records immutable refund/tender rows and an audit action atomically, and replays only an exact same-actor/same-approver command. This slice is a monetary refund, not an item return: it does not alter the original sale/check receipt or restore inventory. See M7.3 for the separate post-handover item-return and waste record; restock, resale and no-receipt policies remain deferred.

The POS shows the new refund receipt immediately, supports browser printing/Save as PDF using the 80 mm layout, and exposes stored refund receipts again from the order's refund history after reload. The receipt records its number, order, time, issuer, approver when applicable, reason, method allocations and terminal refund reference. Ordinary sale receipts remain immutable and separately retrievable. Fiscal issuance is not part of this flow.

Automated verification for M7.2:

1. Build contracts and database; validate Prisma; run API and POS typecheck/lint. Run `pnpm --filter @waffarly/api exec tsx --test --test-isolation=none --test-concurrency=1 test/unit/money.test.ts test/unit/payments.test.ts test/http/pos-employees.e2e.test.ts` for signed cash amounts, tender bounds, terminal references, supervisor credentials, branch scope and controller credential stripping.
2. Run `pnpm --filter @waffarly/api test:pos-db` against the configured local PostgreSQL database. The transaction scenario verifies mixed cash/terminal partial refunds, approval and actor attribution, exact replay, over-refund rejection, immutable history, original tender remaining balances and one negative cash movement. It also races two separate partial refunds against the same original tender and asserts only one command commits, the other receives a conflict, and the cumulative refund and cash movement remain within the original tender cap. Migration `20261019210000_pos_check_refunds` is additive and was deployed locally; no reset or production change was made.
3. Run `pnpm --filter @waffarly/pos test` for durable branch-scoped retry commands without credentials. Run `pnpm exec playwright test --config playwright.pos-checkout.config.ts --grep "cashier retries an uncertain refund exactly" --reporter=list`; the mocked desktop/mobile journey interrupts the first response, confirms exact request/allocation retry, prints the refund receipt, reloads, and reopens the saved receipt. It is browser/UI evidence with intercepted API responses, not live processor or cashier acceptance.
4. Run API/POS typecheck, lint, builds and affected API unit/HTTP and database suites; run Prisma validation, migration status and `git diff --check`. Record full-sweep results in PROGRESS.

Manual local acceptance (pending; use disposable local orders and a sandbox terminal only; never refund real customer funds during this check):

1. Configure a cashier, a different active supervisor with `approve_refunds`, a test register and an open shift. Settle a disposable order with one cash tender and one sandbox terminal tender. Save the original receipt number, check, payment IDs and captured amounts.
2. Open the confirmed order and choose **Refund**. Verify the screen shows each original method, captured/refunded/remaining amounts, a reason and supervisor approval. Verify refund is blocked when no open shift exists for the branch. Submit an empty/zero amount, amount above one tender's remaining balance, empty reason, and terminal amount without a terminal refund reference; each must be blocked without a write.
3. Try a wrong password, the cashier's own account, an unassigned-branch supervisor, an inactive employee and a supervisor without `approve_refunds`. Each must fail without creating a refund row or changing the cash journal. Enter valid supervisor credentials for the same branch and record a partial cash refund. Verify the dialog shows a refund receipt; the sale receipt/check amount and inventory remain unchanged, the original cash tender's refundable amount decreases exactly, and the open shift has one negative cash movement.
4. For the external tender, first perform a refund on a sandbox terminal (never a live payment card), then record the exact terminal allocation and terminal-generated reference. Verify the receipt shows the reference and payment method, no cash drawer movement was created, and the captured terminal tender's remaining refundable amount is reduced.
5. Interrupt the response after submitting a refund. Reload the POS, reopen the order and retry the saved request. Compare request ID, allocation IDs/amounts and terminal reference; they must be identical. Replaying after a server commit must show the same refund receipt and must not create a second refund or cash movement. A changed allocation requires refreshing server state and making a new command only after the prior result is known.
6. Reopen a stored refund receipt after reload and print/Save as PDF. Verify the refund number, order reference, date, reason, original payment method, amount, issuer/approver and terminal reference. Repeat Arabic/RTL and English/LTR, light and dark, desktop and 390x844 phone widths; check keyboard order, focus, errors, credential clearing, page overflow and print preview width.

Pass requires exact original-tender links, current branch-scoped authorization, cumulative refund caps, one-time cash outflow, immutable receipts and exact recovery. Physical printer, actual terminal, live cashier and production acceptance are still pending. Continue implementation after the listed automated suite passes; operator acceptance remains explicitly pending.

### M7.3 post-handover item returns recorded as waste

The **Record item return** action is available on a completed POS sale receipt to employees with `sell`. It selects whole, still-returnable quantities from the original order lines, requires a reason and records the returned goods with a fixed `waste` disposition. A cashier must provide a different active same-branch supervisor with `approve_refunds`; a currently authorized approver may act directly. Credentials are checked for the command and are never saved. The server takes an order lock, checks current actor/approver grants and the quantities already returned, freezes line identity and an informational reference amount, and stores one immutable return snapshot and its audit rows. Repeated return quantities cannot exceed the original sold quantity, and exact same-actor commands replay safely, including concurrent retries.

This is an item-handling record only. It does not issue money, change the paid check, rewrite the sale receipt, or restore stock. The displayed amount is an informational reference based on the original unit price, not a customer refund. To return money, use M7.2's separate original-tender-linked refund. Returned goods are treated as waste so the first release never assumes prepared food is safe to resell. Restock/resale, no-receipt returns and corrections outside an original POS sale remain deferred.

The receipt view exposes the form on both the immediate post-payment receipt and receipt history. It shows the returnable quantity for each original line, variant/modifier details, a required reason, prior return records, and a clear waste/no-money warning. A saved command is bound to its original branch and exact quantities/reason; it can be retried after reload with the same request ID. An uncertain result is first reconciled against recent server return history. Supervisor credentials are re-entered after reload and never enter Zustand storage. Arabic/English copy and RTL/LTR layout use the shared Tailwind/shadcn-based POS design system.

Automated verification for M7.3:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database build`, Prisma validation, API/POS typecheck and lint. Confirm the additive migration `20261019233000_pos_item_returns` is applied only to the intended local development database; never reset the database or deploy the migration as part of this check.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test`. The HTTP/unit suites validate strict whole-unit request bounds, reason and duplicate-line rejection, current branch-supervisor approval and removal of credentials at the controller boundary. The API suite is expected to pass **177 tests** at this slice.
3. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:pos-returns-db` against the configured local PostgreSQL database. It verifies a completed sale return, approver/actor attribution, one return after exact replay, over-return rejection, foreign-branch rejection, unchanged order total, no refund payment and no stock mutation. The test fixture rolls back; it is wired into CI as `test:pos-returns-db`.
4. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos test`. Confirm durable item-return commands preserve the exact request and whole-unit quantities while stripping supervisor credentials. Run POS lint/build and shared UI build so Arabic translations are included.
5. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-receipt-detail.config.ts --reporter=list`. The 10 intercepted-response tests cover saved receipt behavior and return recording in desktop/mobile, cashier supervisor approval, no password persistence or refund request, receipt immutability presentation, Arabic RTL and over-quantity blocking. They do not prove live API integration.
6. Run API and POS builds, the database migration status check, and `git diff --check`. Keep live cashier, branch permissions, real waste handling and printer acceptance pending until performed by an operator.

Manual local acceptance (pending; use a disposable completed POS order, local stock and test employees only):

1. Sign in as a cashier with `sell` and receipt access. Open a completed, handed-over test sale from receipt history. Confirm **Record item return** is visible for the cashier and absent for a read-only accountant. Confirm an unsettled or non-POS order cannot be returned.
2. Select one line with multiple units, a variant and modifiers. Enter zero, a fractional amount and a quantity above the remaining sold units; the form/API must reject invalid amounts. Enter a valid whole quantity and a clear damage/return reason. The preview must identify the line, its remaining quantity and the fixed waste disposition.
3. Try missing, wrong, self, inactive and wrong-branch supervisor credentials, plus a supervisor without `approve_refunds`; no return row may be created. Approve with a different active supervisor assigned to that branch. Verify actor, approver, reason, original line snapshot, quantity and return number in the saved result.
4. Verify the original receipt/check balance and payment history remain unchanged; no cash movement, refund payment, stock restoration or sale edit appears. Confirm the reference value is labeled as informational and the item is marked waste. For a money refund, use M7.2 and its original-tender limits instead.
5. Interrupt the POST response after the server records the return, reload, and reopen the same receipt. Confirm the client detects the saved return or offers the identical request ID, quantities and reason; it must not create another row. Verify supervisor credentials are requested again and absent from local storage.
6. Make a second return for the remaining quantity, then try to exceed the sold quantity across both records. Check the server's aggregate cap, one history entry per committed command and the returned-line history. Repeat in Arabic RTL/English LTR, light/dark, desktop and 390x844 widths; check keyboard/focus order and horizontal overflow.

Pass requires current branch authorization, an active supervisor when needed, original-line-only integer quantities, cumulative return caps, exact idempotent recovery, a visible waste disposition and unchanged payment, receipt and inventory data. Automated tests use mocked browser responses except the isolated PostgreSQL transaction test. Cashier/operator, physical waste, stock workflow and production acceptance remain pending.

## M8.1 — Blind cash count and shift close

The live `/shift` page supports reasoned cash-in/cash-out movements, separately attributed supervisor approval, a blind count, and immutable shift close reports. Cashier-facing open-shift and cash-movement responses contain shift identity, unsettled-check status and movement history only; they do not contain expected cash, cash sales or terminal totals. After the cashier enters the physical count, `POST /pos/shifts/:shiftId/close-preview` returns only the unsettled-check count and booleans indicating whether a variance reason or supervisor approval is required. It never returns the expected amount or the variance amount. The final close is recomputed and committed under the shift lock with the immutable report in one transaction, so concurrent payments/refunds either precede the snapshot or are rejected after closure.

Supervisor passwords are submitted only with the immediate cash movement/close command and never enter Zustand or browser storage. The cashier re-enters credentials to retry an uncertain approved close. Manual cash movement and shift close commands retain their exact request IDs across reloads; closed shifts reject new postings and exact close replay returns the original report.

Automated verification:

1. `pnpm --filter @waffarly/contracts build`, `pnpm --filter @waffarly/ui build`, API/POS typecheck and lint pass.
2. `pnpm --filter @waffarly/api test` passes **170/170** HTTP/unit tests, including preview-schema strictness and controller tenant/approval forwarding.
3. `pnpm --filter @waffarly/api exec tsx --test test/database/shift-reconciliation.database.test.ts` checks opening float + cash sales − cash refunds + cash-in − cash-out, separate terminal totals, safe live responses, unsettled-check blocking, reason/approval preview, variance close report and exact replay.
4. `pnpm --filter @waffarly/api test:pos-db` also races shift close against an original-tender cash refund. The saved close report must include the refund if it commits first; if closing wins, the later refund must conflict. This database case must be rerun when PostgreSQL is available.
5. `pnpm --filter @waffarly/pos test` passes **25/25** tests, including exact recovery and stripping approval credentials from local persistence.
6. `pnpm exec playwright test -c playwright.pos-shift.config.ts` passes **22/22** mocked desktop/mobile browser cases. These intercept HTTP responses and do not substitute for live cashier acceptance.

Manual local acceptance (pending; use a disposable local branch/register and no live customer payments):

1. Follow [the local demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md) to sign in as the test cashier, assign a different active supervisor with `manage_cash_movements` and `approve_shift_close`, and open a local shift. Confirm the register and opening float are correct.
2. In DevTools Network, inspect `GET /pos/shifts/{id}/reconciliation`. Confirm it contains no `expectedCash`, `openingFloat`, `cashSales`, `cashRefunds`, `cashIn`, `cashOut`, `terminalSales` or `terminalRefunds`. The page must show the blind-count instruction, keep **Counted cash** empty and show no drawer/terminal totals.
3. Record one cash-in and one cash-out with positive amounts and reasons. Try missing/wrong credentials, the cashier's own account, and an inactive or wrong-branch supervisor; all must fail without changing the movement history. Use the valid separate supervisor and verify one movement per request, actor/approver names, and that no password is stored in local storage.
4. Leave a disposable check open. Confirm the page says how many checks remain and disables **Close shift and save report**. Settle or cancel that check, then refresh shift status.
5. Count the physical drawer before entering a number. For a balanced test, enter the actual total. Submit and confirm the shift closes once. The close report should show expected cash, counted cash, zero variance, cash vs terminal totals separately, operator and timestamp. Reopen `/shift`; confirm it shows the last close report and the register has no current shift.
6. For a variance test, open another shift, enter a deliberately different count and submit a reason. Confirm the preview reveals only that approval is needed; it must not display the expected amount. Enter a different active branch supervisor's credentials and submit again. Confirm the report records count, expected total, signed variance, reason and supervisor, and the cashier's password field clears.
7. For an uncertain response, interrupt the final close response after submission and reload. Resolve the exact saved request; verify one close report only, the same request ID/count/reason, no second shift close, and no saved credentials. Attempt a new cash movement against the closed shift; it must be rejected.
8. Repeat the shift page in Arabic RTL and English LTR, light and dark themes, desktop and 390×844 phone widths. Check focus order, touch targets, errors, horizontal overflow, refresh/retry, and close-report readability.

Pass requires no expected-drawer amount sent to or shown in the open cashier UI, exact tenant/branch and current-supervisor authorization, no close with an unsettled check, one immutable report for a close, and accurate integer-cent cash/terminal reconciliation. The browser suite is mocked; live operator acceptance, physical cash drawer/printer checks, close-vs-payment/refund contention testing, and production readiness remain pending. M8.2 owner shift reports and M8.3 cash drops have separate test cards below; those pending checks remain open.

## M8.2 — Owner shift-close reports

Owners can open **POS Shift Reports** in the merchant dashboard to review immutable closed-shift reconciliation for the last 30 calendar days by default. The owner can choose all branches or one branch and select an inclusive date range of up to 93 days. Date boundaries are converted by the dashboard browser to explicit ISO timestamps; the API validates the range, derives `merchantId` from the owner session, verifies a selected branch belongs to that merchant, and queries only that tenant's close reports. Results are stable, bounded cursor pages (25 per page in the UI; API maximum 100) sorted by close time and report ID. The response includes branch/register, opened/closed time and operator, cash expected/count/variance, cash and terminal activity, approver and reason. It excludes the stored internal snapshot and does not recompute historical totals from current order or catalog data. No CSV export, cross-timezone branch configuration or broader sales/discount/waste reports are included.

Automated verification:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, API and merchant-dashboard typecheck/lint/build. The dashboard production build can emit the existing large-chunk advisory.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api exec tsx --test --test-isolation=none --test-concurrency=1 test/unit/shifts.test.ts test/http/shifts.e2e.test.ts`. The focused tests validate strict date/limit boundaries, owner authentication, tenant identity derivation and rejection of injected merchant IDs.
3. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:shifts-db` against local PostgreSQL. It creates two tenant fixtures and checks close-time pagination, branch filtering, tenant isolation, date exclusion, no snapshot leakage and rejection of a foreign branch. The suite is now wired into CI as `test:shifts-db`.
4. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-shift-reports.spec.ts --reporter=list`. The intercepted-response browser test covers report contents, bounded query parameters, refresh, Arabic RTL/English LTR and desktop/mobile viewport fit. It does not prove live dashboard-to-API behavior.

Manual owner acceptance (pending; use a local development merchant with at least two closed test shifts and never real customer records):

1. Sign in to the local merchant dashboard and open **POS Shift Reports**. Confirm the default date range is the recent 30 days, **All branches** is selected and recently closed test shifts appear once each. Check register, branch, opening/closing times, opening and closing operators, expected/count/variance, cash sales/refunds/in/out, terminal sales/refunds, approval and variance reason against each saved close report.
2. Select a branch with one closed shift and verify only its reports appear. Switch back to all branches and verify both branches appear. Confirm an empty range or branch produces the localized empty state and not stale rows.
3. Change the start/end dates to exclude a known shift, then include it again. Confirm the result changes accordingly; try a range over 93 days and verify the UI blocks the query. Use Refresh and Previous/Next where there are more than 25 results; each page must contain unique close reports in descending close-time order.
4. Inspect DevTools Network: requests must use `GET /owner/pos/shifts/reports` and include timestamps, optional branch and bounded limit/cursor. The response must not contain `snapshot`, other merchants' records or credentials. A foreign-merchant branch ID should be rejected. Verify the owner's session, not a caller-supplied merchant ID, selects the tenant.
5. Repeat in Arabic/RTL and English/LTR at desktop and 390x844 phone widths, in both dashboard themes where enabled. Check the top Refresh action, readable monetary columns, keyboard focus, table's horizontal scroll region, and that the page itself does not overflow horizontally.

Pass requires owner-only access, tenant and branch isolation, bounded stable pages, accurate immutable report values and no snapshot leakage. Browser verification intercepts the report API; a live owner browser session and operator reconciliation are still pending. Date filters currently use the browser's local timezone because branches do not yet have a configured reporting timezone.

## M8.3 — Cash drops to safe

Named safes, independent receipt and post-close custody extend this workflow.
See [Drawer custody and safe receipts](CASH_CUSTODY.md) for implementation,
compatibility and verification. The earlier M8.3 behavior below describes
untracked historical drops.

Cash drops are a distinct, auditable drawer movement, not a petty-cash payout. An authorized cashier records a positive amount, reason and safe-bag/drop reference; the existing `manage_cash_movements` grant and current supervisor credential checks apply. The cashier remains the actor and the approving supervisor remains separately attributed. A drop reduces expected drawer cash just like cash paid out, while the immutable shift close report and owner report keep `cashDrop` separate from `cashOut`. Exact request recovery retains the reference and excludes credentials. This records the physical handoff; it does not integrate a safe, cash-count device or bank deposit.

Automated verification for M8.3:

1. Run API unit/HTTP tests with `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test`; cash-drop schema tests require a reference only for `cash_drop`, and HTTP tests verify the reference and supervisor approval reach the authorized service command. Run API lint and build as well.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:shifts-db` against the configured local PostgreSQL database. It verifies a drop's amount/reference/actor/approver, exact retry, separate `cashOut` and `cashDrop` totals, resulting expected drawer cash and the owner's immutable close-report row. The additive migration is applied locally; no reset or production change was made.
3. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos test`; the durable command must preserve the exact reference and must not persist supervisor credentials. Run POS lint and build.
4. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-shift.config.ts --reporter=list` for 24 mocked desktop/mobile cases, including required safe-bag reference, successful recording, movement-history distinction, shift-close summary and both viewport classes.
5. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-shift-reports.spec.ts --reporter=list` for the four intercepted-response desktop/mobile English/Arabic owner-report cases, including the separate cash-drop column. Run the merchant dashboard typecheck/lint/build and `git diff --check`.

Manual local acceptance (pending; use a disposable test register and shift, never a live drawer or customer cash):

1. Follow the local POS demo guide to sign in as the test cashier, open a test shift with a known opening float and assign a different active same-branch supervisor with `manage_cash_movements`. Verify the shift identity and drawer/register before recording test movements.
2. Record a petty-cash cash-out with a reason. Then choose **Cash dropped to safe**, enter a positive amount and reason, and leave the safe-bag reference blank. Confirm the form blocks submission and no request or ledger row is created. Enter a test reference such as `SAFE-BAG-1042` and record the drop.
3. Try a wrong supervisor password, the cashier's own credentials where separation is required, an inactive/wrong-branch supervisor and a supervisor without the required grant. Each must fail without changing movement history. Submit with the assigned supervisor and verify the cashier is shown as actor, the supervisor as approver, and the reference is visible in the movement history. Confirm credentials are cleared and absent from local storage.
4. Interrupt the response after submission, reload, and retry the saved action. Verify request ID, amount, reason and safe reference are identical, and there is exactly one cash-drop row. Change no saved command until its server result is known.
5. Compare the reconciliation and final close report to the test ledger: opening float + cash sales − cash refunds + cash-in − cash-out − cash-drop. Paid-out and dropped-to-safe amounts must appear as separate totals. Count the test drawer physically before submitting the close; do not rely on the POS to reveal expected cash before the count.
6. Sign into the local owner dashboard and open **POS Shift Reports**. Find this closed shift and compare `cashOut`, `cashDrop`, expected cash, counted cash and variance to its saved close report. Inspect the API response to confirm the report has the cash-drop amount but no internal snapshot or another merchant's data.
7. Repeat in Arabic/RTL and English/LTR, light and dark themes, desktop and 390×844 phone widths. Check labels, reference validation, keyboard/focus order, touch targets, horizontal overflow, shift close summary and owner-report readability.

Pass requires separate paid-out/drop accounting, an obligatory reference, current branch-scoped approval, exact same-command recovery, one immutable close/report value, and no credential persistence. Automated browser cases intercept API responses; manual cashier/owner reconciliation, physical drawer/safe handling, printer checks and production acceptance remain pending.

## M8.4 — Owner item-return and waste audit report

Owners can open **POS Returns & Waste** in the merchant dashboard to review recorded POS item returns for the last 30 calendar days by default. The owner can select all branches or one branch and an inclusive date range of up to 93 days. `GET /owner/pos/returns/reports` derives merchant identity from the owner session, verifies a selected branch belongs to that merchant, and returns stable cursor pages of immutable return facts: return/order references, branch and service type, issue time, reason, frozen item/variant/quantity/disposition, issuing and approving operator, and a clearly labeled informational reference value. The endpoint never returns the stored snapshot, customer contact details, payments, credentials, or data from another merchant. It does not calculate sales or refund totals and does not change receipts, payment history, or stock. The additive report index supports merchant/date ordering. CSV export and broader sales/discount analytics are not included.

Automated verification for M8.4:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api typecheck`, API lint/build, and merchant-dashboard typecheck/lint/build. Run database schema validation and `db:check` to confirm the additive index migration is applied.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test`. Unit/HTTP tests validate the 93-day bound, strict filters, owner authentication, session-derived tenant and rejection of injected merchant identity.
3. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:pos-returns-db`. The rollback-only PostgreSQL tests verify branch/date/tenant isolation, stable two-page ordering, invalid cross-filter cursors, immutable waste values, snapshot exclusion and foreign-branch rejection alongside the M7.3 return write invariants. The script is included in CI; it never resets the database.
4. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-item-returns.spec.ts --reporter=list`. The four intercepted-response cases cover Arabic/English on desktop/mobile, rendered return details, informational-value labeling, bounded query parameters, next/previous pages, refresh, clearing stale rows after a failed refresh and no page-level horizontal overflow. They do not replace live owner acceptance.

Manual owner acceptance (pending; use only a local merchant and disposable test returns):

1. Sign in to the local merchant dashboard and open **POS Returns & Waste**. Confirm the recent 30-day range and **All branches** default, and compare a M7.3 test return's return number, order reference, branch, issue time, reason, item variant, quantity, waste disposition, issuer and approver with its saved return history.
2. Confirm the reference value is explicitly described as informational and **not a refund**. Compare the original receipt, check balance, payment history and stock before/after the return; the report must not imply those values changed.
3. Filter to one branch and verify only that branch's returns remain. Switch to all branches. Change the date range to exclude then include a known test return; choose a range over 93 days and confirm it is blocked before a request is sent. Verify empty ranges show the localized empty state rather than stale rows.
4. Create or use enough disposable test returns to exercise more than one 25-row page. Move next and previous and use Refresh; confirm descending issue-time order, no duplicate/missing return numbers, and that changing branch/date clears the old cursor.
5. Inspect DevTools Network: the owner-authenticated request is `GET /owner/pos/returns/reports` with timestamps, optional branch, and bounded limit/cursor. It must not send `merchantId`; the response must omit `snapshot`, customer contact data and approval credentials. Verify a foreign-merchant branch and a cursor from a different filter scope are rejected.
6. Repeat in Arabic RTL and English LTR, at desktop and 390×844 phone widths. Check the top Refresh button, table horizontal scrolling without page overflow, readable reason/item details, keyboard focus and date/branch controls.

Pass requires owner-only access, same-tenant branch validation, date-limited stable pages, immutable waste snapshots without snapshot leakage, clear non-refund labeling and no writes to receipts, tenders or inventory. Automated browser checks intercept API responses; live owner reconciliation and cashier/device acceptance remain pending.

## M8.5 — Owner POS operations report

Owners can open **POS Operations** from the merchant dashboard and review a bounded operational summary for a selected branch or all branches. `GET /owner/pos/reports/operations` derives merchant scope from the owner session, accepts explicit UTC `from` and exclusive `to` instants up to 93 days apart, and validates any selected active branch against that merchant. The report uses four database aggregates and returns order counts/value/current outstanding, paid-order and settled-check counts, cash and manually recorded terminal collections/refunds, net collected, average accepted-to-preparation/preparation-to-ready seconds, and cashier/operator attribution. It does not return order or customer details.

Each fact has an explicit time basis: order lifecycle counts/value and kitchen timing use POS order creation time; collections and refunds use the tender event time (so a refund may be included even if the sale was placed outside the selected period); current outstanding is calculated as of the report request for active, non-cancelled orders placed in the selected period. Each POS order is counted once even when it has several split checks. Storefront orders are excluded. Currency remains decimal-string EGP at the response boundary, and tenant/branch filters are applied in SQL. The UI identifies these time rules, supports branch/UTC filters and refresh/retry, and has English/Arabic RTL presentation.

Cashier activity is grouped by the employee who opened each order, the employee who recorded each payment, and the employee who recorded each refund; those actors can differ for the same sale. Orders use order-creation time, while payment/refund attribution uses event time. Rows with no recorded order creator remain visible as unattributed activity. Employee names are current directory labels, not immutable historical snapshots. Discount totals are deliberately absent under the user's POS-D17 deferral. Item-return waste remains in **POS Returns & Waste** and is not treated as a refund or stock movement. This is an aggregate report only: it has no order-level drilldown, tax report or historical as-of outstanding snapshot. M8.6 adds the same cashier aggregates to the current report's CSV export.

Automated verification for M8.5:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, API typecheck/lint/build and merchant-dashboard typecheck/lint/build. Run the default API tests. No schema migration is introduced by this report.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:pos-db`. The rollback-only PostgreSQL test checks two split checks count as one paid order, one open check remains outstanding, cash/terminal collections and a cash refund reconcile exactly, cashier activity separates order creator from payment/refund actor, unattributed orders remain in the totals, branch filtering excludes another branch, storefront sales are excluded, and invalid ranges are rejected.
3. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-operations.spec.ts --reporter=list`. Intercepted-response tests cover English/Arabic, desktop/mobile, exact one-request initial load, branch query scope, UTC bounds, rejection of a range over 93 days before a request, refresh, stale-data clearing on failure, retry, cashier activity and CSV filename/summary/attribution values/UTF-8 BOM with no customer, merchant or employee identifiers. Add this spec to the merchant POS report CI command.

Manual owner acceptance (pending; use only disposable POS orders):

1. Sign in to a local owner account and open **POS Operations**. Confirm the default UTC range is recent, the branch defaults to all branches, the page explains each date basis and the report loads without customer/order detail.
2. Create a two-check POS order and settle one check in cash and one by manually recording an external terminal payment. Verify the order is counted once, both checks are counted, tender totals are separated by method and the net equals collections minus refunds.
3. Leave a check unpaid and verify it appears in current outstanding. Settle it, refresh, and confirm outstanding falls while the paid-order count updates. Cancel a disposable order and confirm it remains in placed/cancelled counts but is excluded from active order value/outstanding.
4. Filter to one branch, then all branches. Compare results with each branch's receipts and shift records. Check that a storefront order is not included. Inspect DevTools: owner identity comes from authentication; requests contain UTC instants and optional `branchId`, never `merchantId`.
5. Compare an order created in one range with a later payment/refund event in another range: lifecycle totals follow order creation time, tender/refund totals follow event time, and outstanding is the current balance for orders created in the selected range. Verify the `to` instant is exclusive and a range over 93 days is rejected.
6. Compare cashier rows to the aggregate cards: orders follow their creator, payments/refunds follow the employee who recorded each action, and the two attributions may differ. Confirm unattributed activity is retained and row totals reconcile to the report totals; do not treat these values as individual performance scores without operational context.
7. Repeat in Arabic RTL and English LTR at desktop and 390×844 phone widths; verify no horizontal page overflow outside the keyboard-scrollable cashier table, readable zero-data/error states, visible refresh/retry, and correct report values in light/dark themes where supported by the dashboard shell.

Pass requires owner-only tenant isolation, same-tenant branch filtering, no split-order double counting, exact tender/refund arithmetic, actor attribution by each action's recorded employee, explicit time semantics, bounded date input and no sensitive order/customer detail. The focused PostgreSQL test runs in a rollback-only fixture and verifies split checks, cash/manual-terminal totals, a later refund for an older sale, creator-versus-operator attribution, unattributed activity, branch scope and exclusion of storefront orders. Intercepted browser/API tests validate the UI but not live owner authentication; manual owner reconciliation remains pending.

## M8.6 — Download an aggregate POS operations CSV

The **POS Operations** report can be downloaded after a successful response. The file is generated from the exact report snapshot currently displayed, so it uses the same UTC range and branch filter without issuing another request. It contains report metadata, aggregate counts, amounts, preparation durations and cashier activity aggregates; order IDs, employee IDs, item names, customer data and credentials are never exported. EGP amounts remain fixed-point decimal strings, durations are seconds, cells are quoted with escaped quotes, and a UTF-8 BOM preserves localized Arabic labels in spreadsheet software. The filename includes the report's UTC start and exclusive end dates. The action is disabled while loading or when the current filters have no valid report.

Automated verification:

1. Run merchant-dashboard typecheck, lint and build.
2. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-operations.spec.ts --reporter=list`. Across English/Arabic desktop/mobile, verify the downloaded filename, date metadata, representative EGP totals, UTF-8 BOM, and absence of merchant/customer details. Verify download is disabled while the request fails and stale report values have been cleared.
3. Run the full merchant UI suite. Browser replies are intercepted; this verifies file generation and report UI state but does not replace live owner reconciliation.

Manual owner acceptance (pending; use disposable report data):

1. Open POS Operations, choose a branch and UTC period, then download the CSV. Compare every count, EGP amount and kitchen duration with the page; check the file opens with readable Arabic labels in Excel or another spreadsheet.
2. Change the branch/date and download again. Confirm the filename and metadata match the selected report and the CSV values match the refreshed page.
3. Enter an invalid range or simulate a report error. Download must be unavailable, and no stale report may be exported.

Pass requires the export to match the visible successful response exactly, preserve localized text and decimal precision, contain no detail beyond the owner report, and produce no extra API request.

## M8.7 — Attribute owner POS operations to the employee who performed each action

The M8.5 owner report now includes aggregate cashier/operator activity without exposing order or customer details. POS orders are attributed to the employee who opened them; collections are attributed to the employee who recorded each tender; refunds are attributed to the employee who recorded each refund. These actors may differ for one sale. Each fact follows its established time basis, and missing order-creator attribution stays in an **Unattributed activity** row so aggregate counts and values still reconcile. Names come from the current employee directory; this is not an immutable historical name snapshot or a staff performance score.

The API adds one merchant/branch/date-scoped SQL aggregate to `GET /owner/pos/reports/operations`; no schema migration or new route is introduced. The owner dashboard shows a keyboard-scrollable table and includes the same aggregate rows in CSV without exporting employee IDs. The existing M9.22 live owner journey also compares the grouped activity sums with its live sales, tenders and refunds.

Automated verification:

1. Build contracts and API; run API typecheck/lint and `pnpm --filter @waffarly/api test`. The report unit test verifies integer-cent formatting, tenant/branch predicates and the employee-attribution result mapping.
2. Run `pnpm --filter @waffarly/api test:pos-db` against the configured local migrated database. The rollback-only report fixture uses separate order and payment/refund employees, an unattributed/cancelled order and two branches. Verify grouped order counts/value, cash/terminal totals and refunds reconcile with the report cards, and the empty branch has no activity.
3. Build/typecheck/lint the merchant dashboard and run `pnpm exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-operations.spec.ts --reporter=list`. Across English/Arabic desktop/mobile, verify named and unattributed rows, branch and UTC filters, report errors, and CSV activity values with no employee IDs.
4. Run `pnpm exec playwright test --config playwright.pos-live.config.ts --list` to verify the updated M9.22 journey is discovered. Execute the live test only in `pos-live-regressions`, after the cashier journey, against disposable `waffarly_pos_e2e`; it must reconcile all-branch and branch-scoped cashier activity to real committed orders/tenders/refunds. Do not use a local or shared database for this guarded journey.

Manual owner acceptance (pending; use disposable report data):

1. Open POS Operations for a selected branch and date range containing several test employees. Create one order as cashier A, record cash as cashier B, and record a refund as an approved supervisor. Verify the order appears under A, the collection under B and the refund under its recording employee; no customer, order or receipt details appear in this table.
2. Include an older sale with a refund in the selected event-time window, a cancelled order and a test order with no creator attribution. Verify counts follow order creation time, the refund follows refund time, the cancelled order is excluded from active order value, and unattributed activity remains visible.
3. Compare each cashier row and the total cards with saved receipts and shift records. Filter to one branch and confirm both the aggregate cards and every employee row exclude other branches. Download CSV and verify the same rows and amounts, with no employee IDs.
4. Repeat in Arabic RTL and English LTR, light/dark themes where supported, desktop and phone. On phone, keyboard-focus the cashier table and scroll it horizontally without page-level overflow.

Pass requires tenant/branch isolation, exact aggregate reconciliation, action-specific attribution, visible unknown attribution, no double counting of split checks, and no sensitive order/customer detail. PostgreSQL and intercepted browser checks pass; the guarded live CI and manual owner review remain pending.

## M9.1 — Merchant page loading and chunk recovery

Merchant-dashboard routes load their page code only when visited. While a route chunk is loading, a compact localized loading state is shown. If the browser cannot fetch a dynamic JavaScript or CSS chunk, the affected route shows a localized failure message with an explicit page-reload action. The boundary is scoped per route and recognizes chunk-fetch failures; it deliberately does not turn arbitrary page rendering exceptions into a generic reload prompt. This reduces initial JavaScript download, but does not yet meet a measured performance budget: the current main entry remains above Vite's 500 kB advisory and real-device/network profiling is still required.

Automated verification:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/merchant-dashboard typecheck`, `lint`, and `build`. Review the Vite output for the main entry and route chunk sizes; do not treat the size comparison as interaction-latency evidence.
2. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-pos-item-returns.spec.ts tests/ui/merchant-pos-shift-reports.spec.ts --reporter=list`. Expected focused result: **10/10** desktop/mobile cases, including the report pages in English and Arabic, refresh/pagination and an aborted report-page chunk that succeeds after the Reload action. API replies are intercepted.
3. Run `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.merchant.config.ts --reporter=list` for the full merchant UI regression. Latest run: **130/130 passed** on desktop and mobile across categories, dashboard, employees, inventory, media, POS reports, products and recipe orders. Product tests also cover builder edits with the loaded revision and a successful save followed by a failed list refresh without duplicate creation. These browser tests use intercepted API responses; they verify UI behavior and route recovery, not live owner/API/database integration.
4. Run `git diff --check`. The route loading/failure UI must preserve current theme, locale, shared styles and navigation, and a chunk failure must never display stale report results as if they were current.

Manual review (pending; use a local owner account and non-production data):

1. Open the merchant dashboard on the normal development network. Visit Dashboard, Orders, Products, Categories, Inventory, Media Library, Customers, Discounts, Branches, Employees, POS Registers, POS Tables, POS Shift Reports, POS Returns & Waste, and Settings from the navigation. Confirm each route shows the brief loading state only while needed, then renders its expected heading and existing shared styling. Use browser Back/Forward and refresh at least one nested route; confirm the correct page and navigation state return without a blank screen or stale page content.
2. In DevTools Network, throttle the connection and revisit both pages. Confirm route code loads when navigating, while already-loaded routes remain usable. Check the browser console for unhandled promise or chunk errors.
3. Block the selected report page's `assets/*Page-*.js` request, navigate to that route and confirm the localized failure text and **Reload page** action appear. Restore network access and reload; confirm the route renders normally. Verify other routes remain usable before reloading.
4. Repeat the report routes in Arabic RTL and English LTR, light and dark themes where enabled, desktop and a 390×844 phone viewport. Check layout, focus visibility, keyboard navigation and page-level horizontal overflow. For the other routes, at minimum verify that navigation preserves the selected locale/theme and that headings and main controls remain visible at desktop and phone widths.
5. Compare navigation and loading on the operator's actual target device and representative network. Record first-load/route-navigation timings before setting a measurable M9 performance budget; do not infer production speed from local Vite preview or compressed file sizes.

Pass requires a working route-level loading state, recoverable dynamic-chunk failure, visible diagnosis for non-chunk render errors, preserved localized/theme styling, and no route regressions. The full merchant suite passes against the local production preview, but its API responses are intercepted. Live owner/API/database integration, real network/device performance, physical hardware and operator acceptance remain pending.

## M9.2 — POS cashier and owner browser regression gate

CI runs the production POS UI regressions on desktop and phone viewports with Playwright Chromium. It covers checkout, configurable products, saved drafts, dining/table sessions, cashier login and employee/register setup, kitchen queue recovery, receipts and item returns, shift opening/close, and the merchant POS shift and returns reports. POS Playwright configs use Chromium in CI and local Chrome for development. The development-only `/prototype` route is excluded; production `/catalog` is covered against the adopted workspace design.

The browser suites intercept API responses. They verify UI behavior, exact retry envelopes and presentation, but they do not prove authentication against the local API or transaction persistence. The dedicated PostgreSQL suites remain the persistence check; the automated browser gate is separate from real cashier/device acceptance.

Automated verification:

1. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`, API `test`, `typecheck`, `lint` and `build`, POS `test`, `typecheck`, `lint` and `build`, and `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database db:check` against the intended local development database. `db:check` validates/generates the client and reads migration status; do not reset or deploy migrations as part of this gate.
2. Run `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test:pos-db`, `test:shifts-db`, `test:pos-returns-db`, `test:storefront-orders-db` and `test:employees-db` against an already migrated database. These exercise real transactions and isolated/rollback fixtures; they do not constitute an end-to-end browser run.
3. Run the same Playwright commands wired in `.github/workflows/ci.yml`: `playwright.merchant.config.ts` for `merchant-pos-item-returns.spec.ts` and `merchant-pos-shift-reports.spec.ts`; then `playwright.pos-checkout.config.ts`, `playwright.pos-dining.config.ts` with `tests/ui/pos-dining.spec.ts`, `playwright.pos-login.config.ts`, `playwright.pos-employees.config.ts`, `playwright.pos-queue.config.ts`, `playwright.pos-receipt-detail.config.ts`, `playwright.pos-receipts.config.ts`, and `playwright.pos-shift.config.ts`.
4. Run ESLint on the changed Playwright configs/specs, `pnpm exec prettier --check` on the changed files, and `git diff --check`. Keep browser interception, PostgreSQL transactions and any later live browser/API/database checks identified separately in the results.

Manual release acceptance (pending; use only disposable local data and the local cashier/register from the POS demo guide):

1. Sign in as the test cashier, open the configured register shift, and create a disposable configurable takeaway order. Verify the chosen variant/options, final quote, one order/check/ticket, payment allocation, change and saved receipt. Reopen and print/Save as PDF without collecting again.
2. Create a dine-in order on an available test table. Split by whole items, send the round to the kitchen, accept it, mark items ready, settle every check and hand over. Add a later round and verify it stays separate within the same session. Compare kitchen, order, check and stock history; each accepted recipe requirement must be deducted once.
3. Interrupt a request after submission, reload, reconnect and explicitly retry the saved command. Compare the request ID and payload in DevTools; verify exactly one sale, payment, stock movement, kitchen action or refund is retained and no supervisor password remains in local storage. Repeat with an account/branch change and verify the old branch data is hidden.
4. Exercise cancellation, original-tender refund and post-handover waste return on separate disposable orders with the assigned branch supervisor. Compare receipts, check balances, tender balances, cash journal, stock and immutable return history before and after; do not use real customer orders, cash or payment cards.
5. Close the disposable shift using a physical test count, then compare the saved close report with the drawer count and owner POS Shift Reports. Review POS Returns & Waste for the disposable return and confirm the reference value is not presented as a refund.
6. Repeat critical paths in Arabic/RTL and English/LTR, light and dark themes, desktop and 390×844 phone widths, plus the cashier's actual target tablet/touchscreen. Check keyboard/focus order, touch targets, sticky checkout controls, no page-level overflow, 80 mm print preview and PDF output. Record branch/register, disposable order references, request IDs, viewport, locale/theme and any console/network errors.

Passing the automated gate does not complete M9. Live browser-to-API/database journeys, representative load/performance, deployment/restore rehearsal, physical hardware and a reconciled real-operator pilot remain release gates.

## M9.3 — Live cashier browser smoke against disposable PostgreSQL

CI adds a separate PostgreSQL service/database named `waffarly_pos_e2e`, applies the additive migrations, seeds one cashier, branch, register and simple sellable item, then starts the real Nest API and POS app. The seed command refuses to run outside CI or against a database with another name; it also refuses to reuse an existing fixture. The disposable service is destroyed with the CI job. Do not point this fixture at a developer or production database.

The Playwright journey makes real requests without API interception: cashier login, open a register shift, load the database-backed catalog, create a takeaway sale, settle it in cash, load the saved receipt, reload the POS, and load that receipt again. Receipt recovery after reload verifies the persisted API read path. The spec runs only in the dedicated `pos-live-regressions` CI job.

Automated verification in CI:

1. Run `pnpm --filter @waffarly/contracts build`, `pnpm --filter @waffarly/database build`, then `pnpm --filter @waffarly/database exec prisma migrate deploy --config ./prisma.config.ts` against the job's fresh `waffarly_pos_e2e` service.
2. Run `pnpm --filter @waffarly/api pos:seed-live-e2e`; expected result is one CI-only disposable fixture. The script must reject a different database name or an existing fixture.
3. Run `pnpm exec playwright test --config playwright.pos-live.config.ts`. Expected result is **1/1 live Chromium journey**, with API and PostgreSQL online and no Playwright request routes mocking application endpoints.
4. Run API `typecheck`, `lint` and `build`, POS `typecheck`, scoped ESLint/Prettier, and `git diff --check` when changing this slice. Keep the dedicated live job result separate from intercepted browser suites and rollback-only database tests.

This smoke covers one simple takeaway item and one cash payment. It does not yet prove delivery, dine-in/split checks, terminal tender, refunds/returns, uncertain-write recovery, contention, hardware, performance or operator acceptance. Those remain explicit M9 coverage and release gates.

Manual review before any pilot: inspect the `pos-live-regressions` CI log and trace; confirm the isolated database name and disposable fixture, successful API login/shift/order/quote/payment/receipt requests, receipt reload from the backend, and cleanup when the job finishes. For manual cashier acceptance, use separate disposable local data and follow the M9.2 six-part test card; never reuse the CI-only credentials or fixture in a real branch.

Pass for this bounded slice requires one clean CI run of the live test, unique order/payment/receipt persistence, receipt visibility after reload, and no use of a non-disposable database. A green typecheck or Playwright test-discovery result alone does not pass it.

## M9.4 — Live dine-in split-check journey

Extend the M9.3 disposable fixture with one four-seat table, T01. Extend the same CI-only, unmocked Chromium test after it completes the takeaway receipt-recovery path:

1. Start another order, select **Dine in** and table T01, add the fixture item, and confirm. Verify the POS returns one new order and shows it in the table session.
2. Open **Split check**, choose **Equal**, keep two checks, and save. Verify the live split request succeeds and the table session shows Check 1 and Check 2 for the 42.50 EGP order.
3. Open **Take payment**. Verify Check 1 is 21.25 EGP, settle it with cash, and verify its saved receipt loads from the API. Return to checkout, select Check 2, verify it is also 21.25 EGP, settle it, and verify the second saved receipt.
4. Reload /dining, open payment details again, and verify the API reports exactly two checks and both are settled. No new tender should be submitted during this recovery check.

Automated command: pnpm exec playwright test --config playwright.pos-live.config.ts. CI first builds contracts/database, deploys migrations to its fresh waffarly_pos_e2e PostgreSQL service, and runs pnpm --filter @waffarly/api pos:seed-live-e2e. The fixture adds T01 in the same transaction as the cashier, branch, register and product. The test refuses to execute unless CI=true and the database path is exactly waffarly_pos_e2e. It uses real UI-to-API requests without route interception.

Before accepting the slice, inspect the pos-live-regressions job: expect one integrated journey to pass, two unique POS orders, three successful cash payment writes (one takeaway plus two checks), three persisted receipts, and the two dine-in checks still settled after reload. Check that the job used its disposable PostgreSQL service and the CI fixture was not pointed at a developer or production database.

Scope limit: this proves one equal split for a simple dine-in sale alongside the takeaway path. It does not cover delivery, splitting by items or custom amounts, mixed tenders, kitchen handover, refunds/returns, uncertain-write recovery, concurrency, hardware, performance or cashier acceptance. The first live job run remains pending; discovery/typecheck/build do not count as end-to-end acceptance.

## M9.5 — Live delivery and whole-item split journey

Extend the guarded `waffarly_pos_e2e` fixture with a second four-seat dining table, T02. Keep the existing unmocked Chromium journey and add these two sales after M9.4's equal-split recovery:

1. Start a dine-in order at T02, add two units of the fixture item, and confirm. Assert the API summary contains `dine_in`, table T02, quantity 2 and total EGP 85.00.
2. Split **By items** into two checks, allocate one whole unit to each, and save. Assert the live response preserves both quantities and returns EGP 42.50 per check. Settle each check separately in cash and verify each saved receipt is read from the API.
3. Start a Delivery order and enter a customer name, valid phone and address. Confirm and assert the backend summary preserves those delivery fields and creates an automatically dispatched Kitchen ticket. Settle its EGP 42.50 check in cash and verify its saved receipt.

The single CI journey now exercises takeaway, dine-in equal split, dine-in whole-item split and delivery. It remains guarded by `CI=true` and the exact database name; its database is disposable and no Playwright route mocks are used. Run `pnpm exec playwright test --config playwright.pos-live.config.ts` only after the dedicated CI job builds the contracts/database, deploys additive migrations to its fresh PostgreSQL service, and seeds the fixture.

Acceptance evidence must include one clean `pos-live-regressions` CI result, four distinct orders, six successful cash payment writes, seven receipt reads (six immediate settlement reads plus the takeaway reload recovery read), two fully settled T01 checks after reload, exact T02 item allocations, delivery customer/address fields, and `dispatchMode: automatic`. Local test discovery and static checks are not live integration evidence. Local execution stays intentionally unavailable unless running in the isolated CI database.

Manual review: inspect the CI trace and confirm T01/T02 are separate sessions, the item quantities are conserved, delivery details reach the API, the delivery kitchen ticket is automatic, all six receipts correspond to the correct check/order, and the job used only the disposable PostgreSQL service. Do not reuse the fixture or CI credentials against a developer or production database.

Scope limit: this does not test custom-amount splits, mixed cash/manual-terminal tenders, kitchen acceptance/readiness, refunds/returns, uncertain-write recovery, contention, hardware, performance or operator acceptance. Those remain separate M9 release gates.

## M9.6 — Live custom split and mixed tender

Extend the isolated fixture with table T03 and continue the same live cashier journey:

1. Start a one-item dine-in order at T03 and use **Custom amounts** to create two checks for EGP 20.00 and EGP 22.50. Assert both saved checks use the `custom` split method and their amounts sum to the EGP 42.50 order total.
2. Settle Check 1 with EGP 5.00 cash and EGP 15.00 recorded after external terminal confirmation. Assert the API persists exactly those two tender methods/amounts and issues the EGP 20.00 saved receipt.
3. Select Check 2 and settle its EGP 22.50 balance using only **External terminal**. Assert the API persists one terminal tender and issues the EGP 22.50 receipt.

The POS records manual external-terminal confirmation; this test does not connect to a payment terminal or assert a terminal processor response. Use the existing `pos-live-regressions` job, whose disposable database and guarded seed are unchanged. It adds no database schema or CI secret and must never target developer/production data.

Expected full integrated evidence after M9.6 is five distinct orders, eight payment commands, nine persisted receipt reads (including the takeaway reload read), nine tender rows, and eight distinct settled-check receipts. T01 remains settled after reload; T02 allocations remain one unit per check; T03 custom amounts and cash/terminal records match exactly; delivery customer fields and automatic kitchen dispatch remain present. A local Playwright discovery pass is not this evidence.

Manual review: inspect the live CI trace and payment-state responses for T03. Confirm the first 20.00 check consists of a 5.00 cash tender and a 15.00 terminal tender, the second 22.50 check has one terminal tender, the shift cash journal reflects only the cash portion (5.00), and the drawer is not increased by terminal payments. Do not attempt a real terminal charge; enter only the external terminal's confirmed test result in a controlled sandbox/pilot.

Scope limit: refunds, uncertain-commit replay, authorization contention, kitchen accept/readiness/handover, device/hardware behavior, performance and operator acceptance remain separate gates. Terminal hardware/vendor integration requires a separately agreed API and sandbox.

## M9.7 — Live uncertain-commit recovery

Use the same disposable live fixture after M9.6. This test injects a response-path failure only after the real API has returned a successful write response:

1. Start a new takeaway order. Playwright forwards the first `POST /pos/orders` to the real API using `route.fetch()`, records the successful response, then aborts the browser-facing response to simulate a lost connection after commit. Reload the POS and verify it restores the saved sale and offers **Retry saved sale**.
2. Retry from the POS. Assert the second request body, including its request ID, exactly matches the first; the API returns the same order ID and the UI shows one confirmed order.
3. Start checkout and repeat the response-loss injection for the first successful `POST .../payments`. Verify the UI says the payment result is unconfirmed, reload, reopen checkout and confirm it offers **Check saved result** for the persisted command.
4. Retry without editing the command. Assert the second payment request body is identical to the first, the replay returns the same payment ID, one settled check with one EGP 42.50 tender remains, and the saved receipt can be read. Reload and re-read payment state to confirm one settled check/payment and zero balance.

The browser request is intentionally aborted after `route.fetch()` receives the real successful API response; this is not a mocked write and does not create an ambiguous database fixture. The CI-only database/seed guard remains mandatory. The failure injection must not run against local, shared, staging or production data.

Expected complete journey state after M9.7 is six distinct orders, nine distinct payment commands, ten tender records, nine distinct settled-check receipts and ten receipt reads including the earlier takeaway reload read. The two retried commands each have two HTTP attempts with the same request envelope, but only one order/payment effect. The final payment-state read must show exactly one payment for the recovered check.

Run only in `pos-live-regressions`. Review the CI trace for each first successful API response, subsequent aborted browser response, unchanged request payload on retry, same order/payment IDs and persisted one-row payment state after reload. The test uses no real or sandbox terminal, refund, drawer or physical device.

Scope limit: this proves recovery for sale and payment commit/response-loss cases. Account/branch switching, command contention, recovery of split/kitchen/refund actions, schema deployment/restore, monitoring, performance, hardware and operator acceptance remain separate M9 release gates.

## M9.8 — Live supervisor-approved partial cash refund

The disposable fixture includes one branch-assigned supervisor, in addition to the cashier. Only use the synthetic CI credentials and the disposable `waffarly_pos_e2e` database.

1. After M9.7 recovers and settles the final EGP 42.50 cash check, open its Refund action. Enter a partial EGP 10.00 cash refund, a reason and the fixture supervisor's approval credentials.
2. Assert the live API creates one refund for EGP 10.00, attributes approval to **Live E2E supervisor**, and links the refund tender to the original cash payment. Verify payment state reports EGP 10.00 refunded and EGP 32.50 refundable.
3. Verify the POS refund receipt shows the supervisor and amount, then inspect local storage to confirm the supervisor password was not persisted. Reopen the original sale receipt and assert its original EGP 42.50 total remains unchanged.

This is an API-recorded refund against an isolated test cash payment; no physical cash is moved. The CI service is destroyed after the job. The refund route must never be pointed at a shared/local/prod environment, and no real customer payment should be used.

Expected combined final state after M9.8: six distinct orders, nine unique payment commands, ten payment tender rows, nine settled-check receipts plus one immutable refund receipt, one EGP 10.00 refund tender against the original cash payment, and EGP 32.50 remaining refundable. The original EGP 42.50 sale receipt is still unchanged and is fetched again after the refund. Supervisor approval is present in the refund record and absent from local storage.

Manual review: inspect the live CI trace and refund response/payment-state payload for the original payment ID, refund amount, remaining balance, cashier, approving supervisor and reason. Ensure approval credentials appear only on the action request and are absent from stored workspace data. Existing database tests separately establish the negative cash journal movement; the live cashier page must continue to keep the drawer count blind until shift close.

Scope limit: this covers a partial cash refund only. Terminal refund recording requires a completed external terminal refund plus reference and remains untested; retry after a lost refund response, over-refund, supervisor denial, refunds after handover, physical cash reconciliation and real operator acceptance remain release gates.

## M9.9 — Live kitchen workflow and payment-gated handover

Extend the same isolated CI fixture with a branch-manager account. Keep the live Chromium path unmocked and add one automatically dispatched takeaway ticket after M9.8:

1. The cashier creates a new EGP 42.50 takeaway order. Assert that the API summary includes an automatic Kitchen ticket.
2. Sign out and sign in as the branch manager. Accept the ticket, start preparation and mark its item ready. Assert each live API response advances the order to `accepted`, `preparing` and `ready`.
3. Before payment, assert the queue explains that every check must be settled before handover and keeps **Confirm handover** disabled.
4. Sign in as the cashier, settle the EGP 42.50 check in cash, and verify its receipt is read from the API.
5. Sign back in as the branch manager. Confirm handover and assert the live response advances the order to `completed` and removes it from the incoming queue.

The fixture password is synthetic and CI-only. The manager is assigned only to the disposable fixture branch. The test must run only in `pos-live-regressions`, against the fresh PostgreSQL database `waffarly_pos_e2e`; it does not use a developer database, physical kitchen station, cash drawer or payment terminal. Because these release scenarios run in one integrated journey, the dedicated Playwright config allows up to 180 seconds for the full test.

Expected combined state after M9.9 is seven distinct orders, ten unique payment commands, eleven payment tender rows, ten settled-check receipts plus one refund receipt, and twelve receipt reads. The new order has one automatic Kitchen ticket, one accepted/preparing/ready/completed lifecycle, and one EGP 42.50 cash settlement. The pre-payment handover control remains blocked; the post-payment transition succeeds.

Review the CI trace for the manager/cashier identity changes, branch-scoped queue visibility, exact order ID across every action, API status at each lifecycle step, disabled unpaid handover, receipt read, and successful paid handover. CI must use and destroy only its disposable PostgreSQL service. Playwright discovery and static checks do not count as the live integration result.

Scope limit: this exercises one simple takeaway item through one Kitchen station. Recipe-stock deduction, multi-station routing, dine-in manual kitchen rounds, kitchen action lost-response recovery, physical handoff/device behavior and operator acceptance remain separate gates.

## M9.10 — Recover a committed Kitchen accept after its response is lost

Extend M9.9's same isolated live journey by faulting the first manager **Accept order** response after the real API has committed it:

1. Forward the first accept request to the live API. Wait for the successful `accepted` response, save the request body, then abort only the browser-facing response.
2. Confirm the UI retains **Retry saved action**. Reload the page and verify the API now shows the same order as accepted while the saved action remains available.
3. Retry from the UI. Assert the request body, including its request ID and branch, exactly matches the first attempt. The API must return the same order ID and `accepted` state; the ticket remains a single incoming order.
4. Continue M9.9: start preparation, mark the item ready, verify unpaid handover remains disabled, settle the check as cashier, read its receipt, then complete handover as manager.

The write itself is real; Playwright drops the successful response after `route.fetch()` and does not mock the API. The command must remain in the manager's branch-scoped POS workspace across reload. The same CI-only credentials and disposable `waffarly_pos_e2e` database guard apply.

Expected persistent totals remain those in M9.9: seven unique orders, ten unique payment commands, eleven payment-tender rows plus one refund-tender row, ten settled-check receipts plus one refund receipt, and twelve receipt reads. The accept action has two HTTP attempts with the identical command envelope but yields one accepted order and one Kitchen ticket. This fixture item has no recipe, so this test does not prove exactly-once recipe-stock deduction.

Review the CI trace for the first successful API commit, the browser-facing network failure, manager identity after reload, identical retry body/request ID, same accepted order ID, one ticket, then the remaining M9.9 transitions. Only `pos-live-regressions` may run this fault injection.

Scope limit: only Kitchen accept is faulted. Lost responses for preparation, item readiness, handover, cancellation, kitchen amendment and recipe-stock acceptance remain separate cases; no physical station, device or operator acceptance is included.

## M9.11 — Reconcile a cash refund after its response is lost

Extend M9.8's supervisor-approved EGP 10.00 partial refund in the isolated live journey. Forward the POST to the real API, wait for the committed refund, then abort its response before the browser receives it:

1. Assert the refund dialog retains its saved command after the network error, and the supervisor password is cleared from the form and absent from POS local storage.
2. Reload the cashier POS and read payment state from the API. Assert the same refund ID/request ID is persisted, EGP 10.00 is refunded, and EGP 32.50 remains refundable.
3. Reopen refunds. The UI must reconcile the stored command against the authoritative payment state instead of enabling another refund attempt. Open the saved refund receipt and verify the amount and approving supervisor.
4. Assert the refund POST was sent exactly once. Reopen the original sale receipt and verify its EGP 42.50 total remains unchanged.

This is a lost-response injection after the real API commits; Playwright does not mock the write. Payment-state GET and saved receipt UI recover the result without resending the refund or repeating a physical cash action. Run only in `pos-live-regressions` with the disposable `waffarly_pos_e2e` database and synthetic branch supervisor.

Expected combined state remains seven unique orders, ten unique payment commands, eleven payment-tender rows plus one refund-tender row, ten settled-check receipts plus one refund receipt, and twelve receipt reads. The EGP 10.00 refund exists once, with EGP 32.50 refundable and the original EGP 42.50 receipt intact.

Review the CI trace for one successful refund commit, one browser-facing lost response, the subsequent payment-state reconciliation, no second refund POST, the saved refund receipt and unchanged original receipt. No real money, terminal, production or developer database is involved.

Scope limit: this checks recovery of one partial cash refund by reading authoritative state; it does not test terminal refund recovery, supervisor denial, over-refund attempts, physical cash reconciliation or real operator acceptance.

## M9.12 — Reject over-refunds and invalid supervisor approval

Continue the same isolated live journey after M9.11 confirms the first EGP 10.00 cash refund:

1. Reopen the refund dialog with EGP 32.50 remaining. Enter EGP 32.51 with a reason and valid supervisor credentials. The POS must disable **Record refund** and send no POST.
2. Change the amount to EGP 1.00 but enter an invalid supervisor password. Submit and assert the live API returns 401 with the approval error.
3. Read payment state after rejection. It must still show exactly the original EGP 10.00 refund, EGP 32.50 refundable and the same immutable refund ID. Assert the rejected password is absent from local storage.

The over-limit case is a client-side guard; server-side over-refund conflict behavior is covered by the rollback-only PostgreSQL refund scenario. The invalid approval case uses the real CI API and synthetic cashier/supervisor accounts; no cash is physically moved. Only the isolated `pos-live-regressions` job may run this journey.

Expected persistent totals remain unchanged from M9.11: seven orders, ten payment commands, eleven payment-tender rows plus one refund-tender row, ten settled-check receipts plus one refund receipt, and twelve receipt reads. One invalid-approval POST returns 401 and has no refund side effect; the UI-blocked EGP 32.51 attempt sends no request.

Scope limit: this does not cover terminal refund denial/reconciliation, shift-close cash movement, repeated authorization contention or real supervisor/operator acceptance.

## M9.13 — Reject competing payment attempts against one balance

Continue the isolated live journey with one new EGP 42.50 takeaway check. Intercept the browser's real payment request and concurrently send a second request to the same live API endpoint with the same revision and tender amount but a different request ID:

1. Start both requests without waiting for either response. The original browser request and the competing cashier request must resolve as one **201 Created** and one **409 Conflict**.
2. Read the payment state from the live API. Assert the check is settled for EGP 42.50, its balance is zero, it has exactly one EGP 42.50 cash tender, and it has one saved receipt.
3. Do not retry the losing command or submit another tender. Whether the browser's own command won or received the conflict, the authoritative state must prove that the competing request did not collect twice.

This is an unmocked concurrency check against the real API and disposable PostgreSQL. It complements the rollback-only database race tests by exercising two distinct request IDs through the HTTP boundary. Run only in the `pos-live-regressions` CI job against `waffarly_pos_e2e`; do not point it at a developer, shared or production database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Expected combined state after M9.13: eight distinct orders; eleven committed payment commands from twelve submitted payment attempts; twelve payment-tender rows plus the existing refund-tender row; eleven settled-check receipts plus one refund receipt; and one additional explicit receipt read. If the browser's request wins, the checkout may also perform its normal receipt read, so the combined read count can be thirteen or fourteen. The losing 409 must add no payment, cash movement or receipt.

Review the live CI trace for both request IDs, the overlapping POSTs, one 201/one 409, the final payment-state response, and exactly one payment/receipt. CI execution remains pending, so typecheck, lint and Playwright discovery do not count as concurrency acceptance.

Scope limit: this covers competing full-balance cash payments on one check. Multi-worker stress, close-versus-tender/refund races, account/branch switching, reconnect, terminal settlement and real cashier acceptance remain open.

## M9.14 — Recover a payment request that never reached the server

Continue the disposable live journey with a new EGP 42.50 takeaway check. Abort its first browser payment request before forwarding it to the API, then reload and recover the saved command:

1. Confirm the POS reports that the payment result is unconfirmed and offers the saved-payment action. Read payment state from the API before retrying; it must show the full EGP 42.50 balance, zero paid, and no payment rows.
2. Reload the cashier workspace, reopen the check and use **Check saved result**. The request body and request ID must exactly match the command saved before reload.
3. Let the retry reach the live API. Assert one 201 response, one successful receipt read, and authoritative payment state with one EGP 42.50 cash tender and a settled check.

This complements the M9.7 case where the API committed a payment but the browser lost its response: here the first request is confirmed absent from server state before the exact retry. Only run `pnpm exec playwright test --config playwright.pos-live.config.ts` in `pos-live-regressions` against the disposable `waffarly_pos_e2e` database.

Expected combined state after M9.14: nine orders; twelve committed payment commands from thirteen distinct payment command IDs (fourteen HTTP attempts, since the new command is sent twice); thirteen payment-tender rows plus one refund-tender row; twelve settled-check receipts plus one refund receipt. This step adds one saved receipt read; with M9.13's conditional checkout read, the full journey reads fourteen or fifteen receipts. The failed pre-commit request adds no payment, cash movement or receipt.

Review the CI trace for the aborted first request, zero-payment server state before retry, unchanged body/request ID after reload, one successful retry and one final persisted cash tender. Static checks and Playwright discovery do not replace this live result.

Scope limit: this checks reconnect recovery for a payment request interrupted before reaching the API. Offline sale confirmation, reconnecting drafts across employee/branch changes, multi-device recovery, hardware, and operator acceptance remain open.

## M9.15 — Reject a reused payment ID with a changed amount

After M9.14 successfully retries the saved EGP 42.50 cash payment, submit a second API request using the **same request ID** but change both the tender and received amounts to EGP 42.49:

1. Require the live API to return **409 Conflict** because the request ID is already bound to the original payment payload.
2. Read payment state again and assert the check remains settled at EGP 42.50 with exactly one EGP 42.50 tender.

This is a negative idempotency test: a retry is safe only when its entire command matches the original. No browser state is modified, no action is retried and no additional cash/payment/receipt row may be created. Run only in the `pos-live-regressions` job against disposable `waffarly_pos_e2e`.

Expected final totals remain those from M9.14: nine orders; twelve committed payment commands from thirteen distinct command IDs; thirteen payment-tender rows plus one refund tender; twelve settled-check receipts plus one refund receipt. There are now fifteen HTTP payment attempts across the journey: the M9.14 exact retry adds one repeated identical request, M9.13 has two distinct competing requests, and M9.15 has one changed-payload replay which must be rejected.

Review the CI trace for the reused request ID, altered EGP 42.49 payload, HTTP 409 and unchanged one-row EGP 42.50 payment state. CI execution remains pending.

Scope limit: this checks changed-payload reuse for one cash payment. Cross-action key collisions, cross-employee retries, multi-worker stress and live operator acceptance remain open.

## M9.16 — Recover a Kitchen ready action after its response is lost

Extend the M9.9 takeaway workflow. As the branch manager, forward the first **Mark item ready** request to the live API, confirm the order commits as ready, then abort only the browser-facing response:

1. The queue must offer **Retry saved action**. Reload and verify the server already shows the item ready while the exact saved command remains available.
2. Retry the saved action. Assert its request body and request ID match the first attempt and the API returns the same order in `ready` state.
3. Continue the M9.9 flow: keep unpaid handover disabled, settle the order as cashier, read its receipt, then complete handover as manager.

This uses a real live API commit and response loss; the request is not mocked. Run only in `pos-live-regressions` against disposable `waffarly_pos_e2e`.

Expected commercial totals remain those in M9.15: nine orders, twelve committed payment commands from thirteen distinct payment IDs, thirteen payment-tender rows plus one refund-tender row, twelve settled-check receipts plus one refund receipt. The ready transition has two identical HTTP attempts but changes the item/order state once. The fixture product has no recipe, so this proves Kitchen action replay but not exactly-once recipe-stock deduction.

Review the CI trace for the first live ready commit, dropped browser response, ready state after reload, identical command retry, one ticket/item and successful paid handover. Live CI execution remains pending.

Scope limit: this covers lost-response recovery for one item-readiness action. Preparation, handover, cancellation, kitchen amendments, recipe-backed inventory and real station/operator acceptance remain open.

## M9.17 — Keep Kitchen orders inside the assigned branch

Continue the same disposable live journey after M9.16. The seed creates a second branch with no orders and a cashier assigned only to that branch, with an explicit `view_orders` grant. First, sign in as the branch manager for **Live E2E branch** and confirm the active `contentionOrder` is visible in the Kitchen queue and returned by `GET /pos/orders?branchId=<original-branch>&limit=25`. Then sign out and sign in as **isolated-cashier**:

1. The cashier must have exactly one branch in the selector, **Live E2E isolated branch**, and its Kitchen queue must show the empty state.
2. `GET /pos/orders` for the assigned isolated branch must return 200 with an empty `items` array. The same list request using the original branch ID must return 403.
3. Request the isolated branch list with the active original-branch order ID as its cursor. The API must return 400, proving that pagination cursors cannot cross branch scope.

This verifies both the UI branch assignment and Orders' live API scoping without creating additional sales, payments, or Kitchen tickets. Run only in `pos-live-regressions` against disposable `waffarly_pos_e2e`; never use a developer or production database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Review the trace for the original order in the first branch, the single-branch selector and empty queue for the isolated employee, the empty 200 response, the cross-branch 403, and the foreign-cursor 400. Static checks do not replace this API/PostgreSQL run; live CI execution remains pending.

Scope limit: this covers assigned-branch isolation for Kitchen order listing and pagination. Cross-branch isolation for every POS API domain, account/branch switching with pending drafts, and cashier acceptance remain separate release checks.

## M9.18 — Keep local order drafts within branch and employee scope

Continue the same disposable browser journey after M9.17. First sign in as the isolated cashier and open **New sale**. Its cart must be empty. Then sign in as the cashier assigned to both fixture branches:

1. In **Live E2E branch**, start a new draft, add one **Live POS E2E Item**, and save the note **Branch A only**. Do not confirm the sale.
2. Switch the branch selector to **Live E2E isolated branch**. The active cart must contain no lines from the first branch. Switch back to **Live E2E branch**; the item and note must return intact.
3. Reload with **Live E2E branch** selected. The same item and note must still be present, with no new sale/order request.
4. Sign in again as **isolated-cashier** and open **New sale**. Its branch is the isolated branch and its cart must remain empty, proving the first cashier's saved draft was not exposed to another employee on the same browser.

This checks local workspace scoping through the real authenticated UI. It creates no backend sale, payment, inventory movement or kitchen ticket. Run only in `pos-live-regressions` against disposable `waffarly_pos_e2e`.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Review the trace for the item/note disappearing on branch switch, returning unchanged on the original branch and after reload, and remaining absent for the second employee. Check the API trace has no `POST /pos/orders` for the draft. Live CI execution remains pending.

Scope limit: this verifies draft line/note visibility across the two fixture branches and employees. Pending financial/action replay across account or branch changes and cashier acceptance remain distinct checks.

## M9.19 — Keep order, payment and receipt reads inside the assigned branch

Continue the same disposable live journey after M9.18. As the original-branch manager, read the settled **Live POS E2E Item** order's payment state and retain its check ID and receipt number. Then sign in as **isolated-cashier**, who is assigned only to **Live E2E isolated branch** and has the explicit `view_orders` and `view_receipts` grants needed to reach these read endpoints:

1. `GET /pos/orders/:id` for the original-branch order must return 404 without the product details.
2. `GET /pos/orders/:id/payment-state` must return 404 without payment or receipt details.
3. `GET /pos/orders/:id/checks/:checkId/receipt` must return 404 without receipt content or its receipt number.
4. Keep the M9.17 checks: the original-branch list request returns 403 and an out-of-scope cursor remains rejected. No route may return the settled order's data to the isolated employee.

This checks tenant/branch scoping on the sensitive order summary, tender state and saved receipt reads through the live authenticated API. It creates no sale, payment, refund, inventory movement or Kitchen ticket. Run only in `pos-live-regressions` against the disposable `waffarly_pos_e2e` database; never use a developer, shared or production database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Before accepting this slice, review the trace for the original-branch manager's successful payment-state read, the assigned-branch selector, 404 responses for all three cross-branch reads, absence of the product/receipt number in error responses, the existing 403 list and 400 cursor responses, and no write requests. Static checks and Playwright discovery do not replace this live browser/API/PostgreSQL run.

Scope limit: this verifies cross-branch denial for POS order detail, payment state and check receipt reads for one employee/order. Cross-account isolation, other report domains and live cashier acceptance remain separate release checks.

## M9.20 — Keep receipt history and pagination inside the assigned branch

Continue the same disposable live journey after M9.19 as **isolated-cashier**, who has `view_receipts` but is assigned only to **Live E2E isolated branch**. Use the saved receipt ID and original branch ID from M9.19:

1. `GET /pos/receipts?branchId=<isolated-branch>&limit=25` must return 200 with an empty `items` array.
2. Request the original branch's receipt history. It must return 403, without a receipt list.
3. Request the isolated branch's history with the original-branch receipt ID as `cursor`. It must return 400; the foreign cursor must not expose a row or pagination position.
4. Keep the M9.19 direct-receipt check: the isolated cashier still receives 404 for the original order's saved receipt.

This verifies branch scope on the paginated receipt-history endpoint as well as the direct receipt read. It creates no sales or financial/inventory writes. Run only in `pos-live-regressions` against the disposable `waffarly_pos_e2e` database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Before accepting this slice, inspect the API trace for assigned-branch 200/empty, original-branch 403 and foreign-cursor 400; confirm the page contains no original receipt number and the database receives no writes. Static checks and Playwright discovery do not replace the live browser/API/PostgreSQL run.

Scope limit: this verifies paginated POS receipt history for one employee and two fixture branches. Cross-account access and owner/report receipt exports remain separate checks.

## M9.21 — Keep dining tables and open sessions inside the assigned branch

Continue the live journey after M9.20. As the original-branch manager, fetch **Live E2E branch**'s open dining sessions and confirm **T01** contains the settled `dineInOrder`. Then sign in as **isolated-cashier** assigned only to **Live E2E isolated branch**:

1. `GET /pos/dining/tables?branchId=<isolated-branch>` returns 200 with an empty array; `GET /pos/dining/sessions?branchId=<isolated-branch>` also returns 200 with an empty array.
2. Request the original branch's table list and open sessions. Both must return 403 and expose no table occupancy, session, order, or customer data.
3. Preserve the M9.17–M9.20 assertions for Kitchen orders, order/payment/receipt reads, and receipt-history cursors.

This verifies front-counter table availability and open account/session visibility for an employee assigned to another branch. No new orders or mutations are sent by these checks. Run only in `pos-live-regressions` against the disposable `waffarly_pos_e2e` database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts`.

Before accepting this slice, confirm the manager's source-branch session contains `dineInOrder`, then inspect the isolated cashier's API trace for empty assigned-branch reads and 403 cross-branch reads. Check that session/order/contact data is absent from the error responses and that no write requests were made by these API assertions. Static checks and Playwright discovery do not replace the live browser/API/PostgreSQL run.

Scope limit: this covers POS employee table and open-session reads across the two fixture branches. Moving sessions and owner table administration remain covered by their own authorization checks.

## M9.22 — Reconcile the owner POS operations report against live POS activity

After the M9 live cashier journey has created and settled POS sales and recorded its cash refund, authenticate the disposable fixture's owner through `POST /auth/owner/login`. In the same authenticated browser context, read `GET /owner/pos/reports/operations` for an explicit UTC range covering the journey:

1. The all-branch response must report a positive placed-order count and order value, at least one settled check, positive cash collection, and positive cash and terminal refunds. Cashier activity must include the seeded cashier and a refund actor; summed order counts/values, collections and refunds must reconcile exactly with the report totals. It must contain aggregate facts only, with no merchant ID, item names, customer details or order IDs.
2. Read active branches from the owner API. Filtering by **Live E2E branch** must preserve the journey's order/check/collection/refund and cashier-activity totals. Filtering by **Live E2E isolated branch** must return zero orders, settled checks, collections, refunds and cashier rows.
3. Keep M8.5's mocked desktop/mobile UI coverage and rollback-only PostgreSQL report fixture. This new journey verifies the actual owner session, route guards, SQL aggregation, cashier attribution and branch filtering after real sale/payment/refund writes.
4. While signed in only as the isolated POS employee, requesting the owner report must return 401; POS employee authentication must not authorize the owner endpoint.

The fixture now creates a synthetic owner account with a CI-only password. Run this only as the second test in `pos-live-regressions`, after the live cashier scenario, against the disposable `waffarly_pos_e2e` PostgreSQL service. Never run its seed or live journey against a developer, shared or production database.

CI command: `pnpm exec playwright test --config playwright.pos-live.config.ts` (two integrated journeys are discovered).

Review the API trace for owner login, the all-branch and source-branch matching totals, zero facts for the empty branch, and aggregate-only response data. Static checks and test discovery do not replace the live browser/API/PostgreSQL run; local execution is intentionally blocked by the fixture guard.

Scope limit: this verifies the POS operations report through a live owner session for one merchant and two branches. Cashier/owner usability, manual CSV review, physical devices and production reconciliation remain separate acceptance work. Discount attribution is deferred under POS-D17.

## M9.23 — Recover a terminal refund after the server commit

Continue the disposable live cashier journey using the already-settled EGP 22.50 manual-terminal check from M9.6. Record a partial EGP 5.00 refund with the synthetic terminal reference `M9-23-TERMINAL-REFUND` and the seeded supervisor approval. The live test forwards the first refund POST to the real CI API, verifies its 201 response and then drops only the response to the browser. After reload, reopen the same confirmed order and refund form, verify the exact amount and reference are restored, re-enter supervisor credentials, and explicitly retry the saved request.

Expected result: the retry returns the original refund ID and request ID, the terminal payment shows EGP 5.00 refunded and EGP 17.50 refundable, and the refund receipt records the same terminal reference and approving supervisor. The original EGP 22.50 sale receipt remains unchanged. The browser must send exactly two refund POST attempts with the same request envelope, and local storage must not contain the supervisor password. The M9.22 owner report then reconciles a positive terminal refund with cashier activity.

This is an API record of a synthetic external-terminal refund; the CI journey does not operate a terminal or move real money. In real cashier acceptance, complete the terminal refund first and only then record its reference in POS. Use the same isolated `pos-live-regressions` job and disposable `waffarly_pos_e2e` database as the rest of M9. Do not run the live journey or seed against a developer, shared or production database.

Automated check: `pnpm exec playwright test --config playwright.pos-live.config.ts --list` must discover both integrated journeys. Execute `pnpm exec playwright test --config playwright.pos-live.config.ts` only through `pos-live-regressions`; review the write trace to confirm one committed refund, a lost first response, one exact retry, one saved refund, and no duplicate cash movement. Database coverage separately verifies terminal refunds do not create cash drawer outflow.

Manual cashier check remains pending: using an approved sandbox terminal and disposable sale, return part of a terminal payment on the device, record the reference once in POS, refresh payment state, reopen the refund receipt and verify the original sale receipt and drawer cash are unchanged. Never use a real payment card or customer sale during local acceptance.

## M9.24 — Read the saved merchant accent in the live cashier workspace

Extend the guarded unmocked cashier journey immediately after the synthetic cashier signs in:

1. Wait for the real `GET /pos/appearance` request and require HTTP 200 with the fixture merchant's `accent: orange` and initial `revision: 1` from the fresh database default.
2. Verify the authenticated workspace applies orange and that the appearance query makes exactly one successful request during the initial React StrictMode mount. Other routes should reuse the merchant-scoped React Query result while it remains fresh.
3. Continue the existing shift, order, payment, receipt and kitchen journey unchanged.

This is an actual browser → authenticated API → migrated PostgreSQL read, unlike the owner/cashier UI tests which intercept the API. The test must remain in the CI-only `pos-live-regressions` job with `CI=true` and the exact disposable `waffarly_pos_e2e` database. The live run is not accepted from Playwright discovery or from the separate rollback-only database test.

Manual review: in the isolated local merchant/cashier fixture, choose another accent in the owner POS Registers page, reload the cashier workspace, and verify the saved accent appears across catalog, dining, receipts and shift without changing the local light/dark preference. Do not use a real merchant or create a sale for this check; follow **Merchant POS appearance — saved accent configuration** above.
