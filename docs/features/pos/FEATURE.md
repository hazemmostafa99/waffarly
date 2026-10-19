# Complete POS — Feature and Architecture Contract

## Status and authority

- Last reviewed: 2026-10-18.
- Status: M1 and M2 remain partial; M3 is in progress; M4 dining sessions and split checks are implemented and verified within their defined scope; M5 is in progress. The live POS supports authenticated catalog search, server quotes, configurable cart lines, persisted drafts, online sale creation with stock-safe handling, table sessions, rounds, table moves, item/equal/custom split checks and a cash/terminal checkout UI. M5 records partial tenders and net cash drawer effects transactionally, and the POS client now recovers exact pending payments across navigation/reload through explicit cashier replay. Fully settled checks now create immutable ordinary receipt snapshots, with branch-scoped history/reprint and an 80mm browser print/Save-as-PDF layout. Physical printer acceptance and direct one-click PDF file generation remain open; a dedicated kitchen display remains unfinished. ETA fiscal integration is deferred by the user's latest direction.
- Companion execution ledger: [PROGRESS.md](PROGRESS.md). Read both before each implementation slice.
- UI/UX companion: [UI_UX.md](UI_UX.md). Follow its workspace, interaction, dual-theme and usability requirements for frontend slices.
- Applications: `apps/pos`, `apps/api`, and owner configuration/reporting in `apps/merchant-dashboard`; preserve storefront compatibility.
- Shared packages: `packages/contracts`, `packages/database`, `packages/ui`.
- Follow [root instructions](../../../AGENTS.md), [API instructions](../../../apps/api/AGENTS.md), [API architecture](../../architecture/API_ARCHITECTURE.md), and [UI/localization conventions](../../architecture/UI_AND_LOCALIZATION.md).
- The user requested these references, the frontend stack and an interactive prototype, then clarified that its design should become the production POS baseline. The live `/catalog` selling screen now uses Tailwind utilities and shared POS tokens while keeping real API, React Query and Zustand draft flows. Operator review on 2026-10-18 found substantial visual and usability gaps across the live routes; the Step 1 visual handoff is **not accepted**. Follow the cross-page correction plan in [UI_UX.md](UI_UX.md) and deliver one tested page slice at a time. `/prototype` remains a development-only sample for interactions not yet migrated. Printer hardware details remain open; ETA fiscal issuance is deferred.

Use these labels: **EXISTING** means observed in source; **CONFIRMED** records an explicit user choice; **TARGET** is the proposed implementation contract; **OPEN** needs a decision before its affected slice; **DEFERRED** is outside the first release. Update decisions before changing dependent behavior. Later explicit user instructions take precedence over this document.

### Current implementation update — 2026-10-18

- `apps/pos` uses React Query for session, queue, catalog and quote state, and Zustand for merchant/employee/device-scoped drafts and exact command envelopes, with branch identity stored on branch-specific operations. Existing accept/prepare retry IDs are preserved. The production cashier has a compact searchable product grid, product configuration, quantities/notes, multiple drafts and dine-in/takeaway/delivery context.
- `GET /pos/catalog` is implemented in Catalog and derives merchant scope from the authenticated POS employee. `POST /pos/orders/quote` also uses Catalog's authoritative pricing. `POST /pos/orders` is owned by Orders: it requires the assigned `sell` grant and an open register shift, rechecks product revisions, persists immutable priced lines with POS shift/operator attribution, and replays only an exact request fingerprint.
- POS stock handling follows POS-D08: DIRECT requirements post once at sale confirmation; recipe requirements are snapshotted per order and post once at kitchen acceptance; products without explicit mappings retain legacy variant reservation. Additive migrations preserve storefront and historical-order behavior. Owner storefront reads/status actions exclude POS orders; POS kitchen reads include them.
- Orders owns branch-scoped POS dining tables, open table sessions, added rounds, same-branch moves to available tables, revisioned/idempotent split-check allocation, and ordinary receipts. Every new POS sale starts with one unpaid check; dine-in sales also attach to the active table session. Check tender commands are order/check locked and replay-safe; payment rows, net cash journal entries, and a frozen receipt snapshot for a fully settled check commit together. `GET /pos/orders/:id/payment-state` returns tenant/branch-scoped check balances and tender history; `GET /pos/orders/:id/checks/:checkId/receipt` retrieves the saved document; `GET /pos/receipts` returns bounded cursor pages for an assigned branch. The receipt and item/tender facts are not reconstructed from current catalog data. The POS saves an exact payment envelope before sending the write, surfaces it across authenticated POS routes and requires an explicit same-command retry after recovery; it never auto-replays a financial write. Recovery is scoped to the same merchant, employee and browser device, with branch identity retained in the command. ETA fiscal integration is out of current scope.
- The POS uses the shared English/Arabic language switcher; the dining and split-check controls have Arabic copy and follow the shared RTL document direction.
- The production workspace now uses `features/workspace/PosWorkspaceFrame` for the reference-aligned full-screen rail, header, language/theme controls and orange-default appearance tokens. `/catalog` continues to use the operational catalog, server quote/order APIs, durable Zustand drafts and payment recovery; the demo store remains isolated to `/prototype`. Appearance theme/accent preview state is shared, but accent selection is still a local preview and is not saved as merchant configuration. This is the first bounded design migration, not a migration of every sample-prototype interaction.
- Migration `20261017170000_pos_existing_order_checks` backfills one unpaid whole check for each historical positive-total POS order. It intentionally leaves old table/session facts unset because that history was not captured. The migration has been applied only to the configured local PostgreSQL database; production rollout remains pending.
- The Shifts module supports owner register setup and assigned cashier/supervisor shift opening with an exact opening float. A locked register row serializes openings; the database enforces one active shift per register. Shift close/reconciliation, cash movements and commercial supervisor approvals remain later work.
- The development-only `/prototype` remains isolated from the production API; its sample checkout/receipt interactions do not stand in for live cashier, tender or receipt records. Its visual language is now used by the production selling workspace. See [PROGRESS.md](PROGRESS.md) for exact verification and limitations.

## Step-by-step implementation and test handoff

Implement and review one bounded POS substep at a time. When a substep is complete, update this file and [PROGRESS.md](PROGRESS.md), then give the operator a handoff before starting dependent work. Each handoff must include:

1. The changes made, in the order an operator will encounter them.
2. Exact automated commands/results, test counts, and whether each check used unit fixtures, HTTP stubs, intercepted browser responses, or a real local database/browser.
3. A numbered manual test with prerequisites, UI actions, and observable pass conditions; include the expected record/payment effect where applicable.
4. Remaining limits and any hardware, live-integration, or operator checks that were not run.

Stop after delivering that handoff. Wait for the operator’s test results and resolve any reported issue before beginning the next dependent substep. Never describe mocked or local-only evidence as live production acceptance.

### Prototype design adoption — Step 1 visual handoff

This step applies the prototype's visual direction to the real selling route using Tailwind classes and the same shared button primitive as the preview, without routing production actions through sample state. The live frame and catalog use the existing shared semantic theme stylesheet only; they do not add route-specific CSS. Operator review found the visual result incomplete; use the correction plan in [UI_UX.md](UI_UX.md) before repeating this handoff. It does not complete M1–M5 or replace the separate M5.5 payment/receipt acceptance.

Before manual testing, make sure the local API/database and demo fixture are available. If the `cashier-demo` fixture is missing, follow [the local demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md): seed the local fixture if needed, assign it the Cashier role, create **POS Testing Register**, sign in at `http://localhost:5175/login`, then open a test shift. The guide contains the local-only credentials and exact setup. Do not use production credentials or data for this visual check.

1. Open `/prototype?view=sell` and `/catalog` in separate tabs. Compare the rail/header, category strip, card density, order panel and primary/secondary button treatment; product data can differ because the prototype uses samples and `/catalog` uses the live catalog. In `/catalog`, confirm the active **New sale** state and saved-draft strip. At 1440px, confirm four product cards fit across the grid; at an extra-wide desktop, confirm five fit. Product cards should stay compact, and order items should use the compact single-row treatment. Confirm branch/register/shift and online status still reflect the real session.
2. Switch Light ↔ Dark, refresh, and confirm the selected theme persists and the live product, cart and controls remain legible. Open **Accent** and select a different color; confirm the live workspace changes accent and that the UI explicitly says this is a local preview, not saved merchant configuration.
3. Switch to Arabic. Confirm RTL direction, the navigation rail on the right, and that the product and order panels remain usable. Switch back to English.
4. Add a real catalog item to the current draft. Confirm its server-quoted EGP amount appears in the cart; open its item-note control, enter a note, and verify the compact row shows it. Create a second draft, then return to the first and confirm its item and note are retained.
5. Refresh `/catalog`. Confirm the draft is restored and no sale, payment, kitchen send or stock movement was created by these UI checks. At a 390px-wide viewport, confirm the screen has no horizontal page overflow and primary cart actions remain reachable.
6. Stop before **Confirm order** so the visual review does not create a sale or kitchen/stock side effect. Record any screen that feels unlike the supplied reference or makes a common cashier task harder.

This handoff uses local UI behavior and does not prove a live browser-to-database sale. After the operator reports the result, take only the next agreed migration slice. M5.5's payment and saved-receipt test card above remains independently pending, and M6 remains gated by its handoff.

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

This slice refines `/shift` only. The page now has deliberate responsive top spacing, a short task description and a wider content frame; the open-shift card uses semantic success and information tokens that follow both POS themes, and gives register/branch identity, opening operator/time, and the opening cash float distinct hierarchy. The new-shift form groups branch, register and float inputs with consistent touch-sized controls and a clear saved-request explanation. Missing branch assignment and an empty register list now have separate guidance; retry reloads whichever register or current-shift query failed. A failed register/current-shift read now blocks opening until the state is successfully checked, preventing an uncertain state from looking like an empty register. An unreadable saved operator name uses the localized fallback. Tailwind utilities, shared POS tokens and the existing `Input`/`PosButton` are used. Shift open/retry command behavior, API contracts, employee permissions, database and cash handling are unchanged; shift closing and reconciliation remain M8.

The focused mocked browser suite is `tests/ui/pos-shift.spec.ts`, run with `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-shift.config.ts --reporter=list`. All 14 desktop/phone cases pass. It covers the new-shift form, open-shift attribution/float, light/dark theme switching, no-branch and no-register states, register/current-shift query failures and retries, opening blocked during uncertainty, Arabic unreadable-name fallback, RTL and responsive content fit at 1440×900 and 390×844. Mocked HTTP validates the screen and query retry only; it does not validate a live register or shift transaction.

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

Target split modes are by selected items/quantities, equal shares, and custom amounts; details and correction policy are POS-D05 below. Hardware models were not supplied. No tax rate or service-charge percentage has been configured. No ETA adapter has been implemented; fiscal issuance is deferred and ordinary receipt/PDF output is not a tax invoice or eReceipt.

## Outcome and release boundary

A cashier must be able to open a shift, create or receive an order, manage a table, send work to the kitchen, collect one or more payments, issue/reprint a sale document, hand over the order, handle an authorized cancellation/refund, and reconcile the drawer. The kitchen must see the correct work and amendments. Owners must trace every commercial and inventory effect.

First release includes:

- Fast catalog search, existing optional variants/modifiers, quantities, barcode lookup where configured, customer/fulfillment details, notes, suspended carts, server quotes, and permission-controlled discounts.
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
| Orders       | `StorefrontOrdersService`, `OrderLifecycleService`, immutable price/selection snapshots                                    | Current status union: pending, accepted, rejected, preparing, cancelled; no ready/completed transition.                                                  |
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

Additional TARGET ownership from POS-D14: existing `merchants` owns tenant-level POS appearance configuration through authenticated owner settings and a read-only POS appearance query. Owner writes require current authorization, revision checks and validated theme/accent pairs; device light/dark preference remains local UI state. Orders retains issuance/immutable document snapshots. Finalize transport and update current architecture/dependency rules in the implementation slice; do not add a generic Settings module or reverse dependencies into Orders.

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
3. Prices and totals are decimal strings at HTTP boundaries, integer arithmetic internally using existing money helpers. Use the current currency precision, reject mixed currencies, and define deterministic cent allocation for equal splits/discounts. No float-based settlement.
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
- Kitchen line progress supports queued/preparing/ready/cancelled, station completion and whole-order readiness. Avoid duplicate tickets on retry. Record acknowledgement of amendments/cancellations; never silently remove already displayed work.
- Dispatch timing is branch policy pending POS-D06: confirmed versus paid orders. Acceptance/stock posting and kitchen dispatch must have one unambiguous event per line; prepayment policy must not prevent configured dine-in rounds.
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

| ID      | OPEN decision                                                                                                             | Proposed default / dependency                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D06 | Kitchen dispatch and payment-before-handover policy per fulfillment type; station setup                                   | Confirmed rounds dispatch for dine-in; configurable prepayment for takeaway/delivery. Resolve before M6 and final tender/fulfillment integration.                                                                    |
| POS-D09 | DEFERRED by user, 2026-10-17: no ETA fiscal integration in current scope                                                  | Build ordinary POS receipt output only; do not claim it is a tax invoice/eReceipt. Revisit ETA only if the user changes scope or a launch requirement is established.                                                |
| POS-D10 | Remaining printer/OS/browser, physical printable width, PDF adapter, drawer/scanner needs and terminal reference policy   | 80mm thermal + printable/downloadable PDF confirmed under D16. The live receipt uses browser print and Save as PDF; physical device/adapter acceptance and direct one-click PDF generation remain open before M5/M9. |
| POS-D11 | Cancellation/refund permissions, prepared-item waste, physical-return eligibility, no-receipt returns, correction policy  | Reason plus privilege/approval; original-sale-linked refunds; no automatic ingredient restoration. Resolve before M7.                                                                                                |
| POS-D12 | Deployment topology, register/device provisioning, business-day timezone, retention, expected load and performance budget | Keep POS as existing app; merchant/branch timezone and realistic peak-load fixtures must be explicit. Resolve before M9.                                                                                             |

## Verification and release gates

### M5.5 cashier handoff — tender concurrency and print-failure isolation

Run automated race/rollback checks only against the configured local test database, never production:

1. From the repository root run `pnpm --filter @waffarly/api build`, then `pnpm --filter @waffarly/api test:pos-db`. The PostgreSQL test must prove that two simultaneous copies of one exact payment command return the same recorded result and create one payment/journal effect; two different commands competing to collect 0.75 EGP each against a 1.00 EGP balance produce one success, one conflict, and a remaining 0.25 EGP; and a simulated cash-journal failure rolls back payment, journal, order-revision and check-settlement writes together.
2. Run `pnpm exec playwright test --config playwright.pos-dining.config.ts --reporter=list`. The receipt-output failure case must show an accessible error while keeping the settled receipt visible, reopening it from history after reload, and sending no second payment command. Record that this suite intercepts HTTP and is not a live browser-to-API/database test.

Before the next dependent POS step, manually verify in a local development environment with a test cashier, test register/shift and migrated test database:

Prepare the cashier and register using the [local inventory/POS demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md). Its seed creates an isolated merchant, branch, recipe product and cashier account; the owner must assign the cashier role and create a register before opening a shift.

1. Create a small EGP test order and settle it using cash plus a manually recorded terminal tender. Confirm that the receipt appears once, shows the item, total and both tender methods, and remains available in Receipts after leaving the checkout and reloading the page.
2. On the saved receipt page, open browser developer tools and temporarily run `window.print = () => { throw new Error('blocked'); };`. Click **Print / Save PDF**. Confirm an inline error explains that the receipt is saved, the receipt contents remain visible, and the Network panel shows no new `POST .../payments` request.
3. Return to Receipts, reload, reopen the same receipt, and confirm its receipt number and totals are unchanged. Reload the page to restore the browser’s normal print function, choose **Print / Save PDF**, select **Save as PDF**, and verify the output is 80mm wide with no on-screen action buttons.

Pass means payment/journal state is unchanged by print failure, no racing tender exceeds the balance, and the same receipt can be reopened and printed without another collection. Do not use a production order or real customer payment for these checks. Physical-printer/driver acceptance is still a separate M9 task.

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
