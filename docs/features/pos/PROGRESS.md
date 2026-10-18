# Complete POS — Implementation Progress

## Tracking rules

Read [FEATURE.md](FEATURE.md) first. This file is the execution ledger, not evidence that planned behavior exists.
Read [UI_UX.md](UI_UX.md) before frontend design/implementation; it defines the reference assessment, layouts, dual-theme requirements and usability gates.

- `[ ]` Not started.
- `[~]` In progress, or implemented but verification incomplete.
- `[x]` Complete within the stated scope, with recorded evidence.
- `[!]` Blocked by a specific unresolved dependency; record why and what unblocks it.

After every implementation slice:

1. Update Current Status, the relevant milestone, decision register, verification ledger and delivery log.
2. Record actual changed files and exact check commands/results. Distinguish source review, mocked browser checks, HTTP stubs and real PostgreSQL/live browser integration.
3. Do not mark a milestone complete until its exit condition in Feature and required checks pass. Passing lint/build alone is insufficient for behavioral work.
4. Preserve unrelated changes; inspect `git status` before editing overlapping files. Never read/print `.env` secrets or reset a database to make tests pass.
5. Resolve an OPEN decision before its dependent behavior; update Feature and this ledger together. Do not promote a proposed default to CONFIRMED without an explicit user answer.
6. Preserve historical evidence and failures. Record skipped/environment-blocked checks separately from regressions. Never copy earlier test results as a fresh run.
7. Keep new routes/contracts backward-compatible during staged migration; record schema rollout, data preservation, feature enablement and recovery for each persistence slice.
8. Add only the folders/files needed for a working slice. Do not scaffold the entire target structure or add speculative infrastructure.

## Current status

- Last updated: 2026-10-18.
- Overall: **M1 PARTIAL; M2 PARTIAL; M3 IN PROGRESS; M4 COMPLETE within its exit scope; M5 IN PROGRESS.** Cashier/operator usability review and live cashier-to-database acceptance remain open for release readiness.
- Current milestone: M5 only — transactional backend settlement, the live cashier checkout UI and durable same-device payment recovery are implemented as separate slices; ordinary sale receipts remain. ETA fiscal integration is deferred by the user. M0 and M4 are complete; M1/M2 browser and session verification gaps remain; M3 live cashier/operator acceptance remains; M6–M9 have not started.
- First-release scope: takeaway, delivery, dine-in, tables, split checks; cash/manual external-terminal tender and split tender; online with draft/request recovery.
- Frontend stack: React/Vite, Tailwind v4, shared shadcn/ui, Zustand for client drafts/workspace, TanStack React Query for server state.
- Design: reference-aligned cashier workspace with orange default, local merchant-accent preview, equal light/dark support, responsive order-context picker, denser responsive catalog and 80mm receipt/print-to-PDF preview in development-only `/prototype`. Operator evaluation not performed.
- The production POS authenticates employees, preserves the recipe-order queue, and supports live catalog/search, server quotes, configurable products, saved cashier drafts and idempotent online sale creation. Each POS sale has an initial check; dine-in sales require a configured table and create/resume its server-side session. Cashiers can add rounds, move sessions to free tables and split orders by whole item quantities, equal cents or custom amounts. M5 records partial cash/manual-terminal tenders, exact check balances and net cash drawer effects; the live checkout supports split tender, per-check balances and safe recovery after navigation/reload using explicit replay of the saved request ID. Ordinary receipts and kitchen dispatch remain unfinished. ETA fiscal integration is deferred.
- Owners can configure branch-scoped POS registers. Assigned cashier/supervisor employees can select an assigned branch/register and open a shared shift with an exact opening float. POS sales require that open shift and persist both shift and individual operator attribution.
- Owners can create/update branch-scoped POS dining tables. Occupied tables cannot be renamed or deactivated; an open session may move only to an available active table at its branch. Table merging is deferred.
- Cashier/supervisor grants are derived from the owner-assigned role, while existing queue grants remain stored and effective for legacy employees. New employees start as cashiers in the owner editor; the owner can select supervisor, while legacy employees retain their current role unless edited. Supervisors receive discount/void/refund approval capabilities, but no commercial approval endpoint exists yet; numeric limits remain unconfigured.
- Shift opening and sale confirmation are online-only. Drafts and exact request envelopes are durably stored and reused after reconnect; the API replays exact sale and check-payment requests safely. All 33 migrations, including the additive dining, historical-check and payment/cash-journal changes, are applied to the configured local PostgreSQL database; no production deployment was made.
- The reference visual refinement remains previewed in the prototype; the live checkout uses shared semantic light/dark and accent tokens. Persistent merchant appearance settings, ordinary receipts and physical printer integration remain unfinished. ETA tax-document integration is out of scope.
- Existing operational baseline: branch-assigned POS employee login and incoming recipe-order accept/start-preparation queue. This must remain functional during migration.
- Runtime verification: API typecheck/lint/build and all 123 HTTP/unit tests pass when run serially. Shared UI build/lint pass; POS typecheck/lint/build and 15 unit tests pass. The PostgreSQL integration test passes session rounds, all three split modes, partial cash and terminal tenders, exact balances/change, payment replay, one cash-journal entry, settled-check immutability and payment-state reads. Five Chrome tests cover split-tender checkout, same-command retry after an interrupted reply, committed-payment recovery after route change/reload, narrow-screen balance/action visibility, and dining moves/split checks using intercepted HTTP responses; these are not live browser-to-API/database coverage. Schema validation/client generation and all 33 migration statuses pass.
- Production readiness: **not established**. All M1–M9 milestones, real end-to-end validation and operational pilot remain required.
- Latest UI slices: catalog cards are smaller with four columns on standard cashier desktops, five on extra-wide screens, three on tablets and one on narrow phones; mobile order items now use compact horizontal rows, smaller visible button surfaces/type and 44px quantity/remove hit areas.
- Next action: implement one M5 slice at a time, next building immutable ordinary per-check receipt records and the confirmed 80mm/PDF output. ETA fiscal integration is deferred by the user. M3 live cashier/operator review, M1/M2 session/browser checks, production migration rollout and an end-to-end cashier-to-database journey remain open. POS-D08 is confirmed: recipe stock posts at kitchen acceptance; new pending orders freeze requirements while allowing recipe edits; unmapped legacy products preserve their prior reservation flow.

## Worktree and environment baseline

Source audit on 2026-10-17 found pre-existing changes, preserved without modification:

- `apps/api/package.json`
- `apps/api/src/modules/auth/pos-employee.service.ts`
- `apps/api/test/database/recipe-order-lifecycle.database.test.ts`
- `apps/merchant-dashboard/src/dashboard-copy.ts`
- Untracked `apps/api/src/scripts/seed-arabic-inventory-demo.ts`
- Untracked `docs/features/inventory/LOCAL_DEMO_GUIDE_AR.md`

These overlap potential later API/auth/stock work. Inspect current contents and diffs before implementation; do not restore them to a baseline commit.

During the UI/UX documentation follow-up, additional Merchant Dashboard inventory/purchasing/navigation and merchant-inventory browser-test changes appeared in the shared worktree. They were left untouched; the list above is the initial snapshot, not a claim that later worktree changes are absent.

Observed shell tooling: Node `v20.19.0`, pnpm `10.34.5`; repository `.node-version` requires `24.11.1` and the root manifest requires Node 24.11–24.x. Use the required Node version for implementation/build/test validation. This mismatch is not a runtime test failure, and no application checks were attempted in this documentation task.

## Source audit evidence

| Evidence                                                                     | Finding                                                                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/pos/src/POSScreen.tsx`                                                 | Branch recipe-order list, accept/prepare actions, 15-second refresh and saved uncertain request keys. No sell/cart/tender/shift/table workflow. |
| `apps/pos/src/POSLayout.tsx`, `Login.tsx`, `routes.tsx`, `lib/api-client.ts` | Existing session shell, login, queue route and credentialed transport.                                                                          |
| `apps/pos/package.json`, `components.json`, `vite.config.ts`                 | React/Vite, shared UI and Tailwind/shadcn setup; POS does not declare Query/Zustand yet. Lockfile already includes these libraries elsewhere.   |
| `packages/ui/src/theme.css`, `index.ts`; UI architecture document            | Shared Tailwind sources/tokens, adapted shadcn components and isolated locale provider.                                                         |
| `packages/contracts/src/pos.ts`, `catalog.ts`                                | Two current POS permissions and pending/accepted/rejected/preparing/cancelled order status union.                                               |
| `apps/api/src/modules/orders/*`, `auth/*`                                    | Shared lifecycle with recipe stock transactions, branch authorization and owner-only pre-preparation cancellation.                              |
| `packages/database/prisma/schema.prisma`                                     | Existing order snapshots/actions/stock-batch links; no complete POS financial/dining model. Purchase invoices are not sales receipts.           |
| `apps/api/eslint.config.mjs`, API architecture/instructions                  | Enforced module public-entry imports and acyclic ownership; no backend POS catch-all module.                                                    |
| `tests/ui/pos-employees.spec.ts`, `playwright.pos-employees.config.ts`       | Mocked API browser regression for existing staff queue; not live browser-to-database proof.                                                     |
| `docs/features/inventory/FEATURE.md`, `PROGRESS.md`                          | M6b incoming-order scope and historical verification; financial refund, walk-in sale and completion remain separate work.                       |

## Confirmed and open decisions

The full requirements/defaults live in Feature. This register tracks disposition and the affected milestone.

| ID      | Status                | Decision / next action                                                                                                                                                                                                                                                           | Gate                                                                  |
| ------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| POS-D01 | CONFIRMED, 2026-10-17 | Takeaway + delivery + dine-in + tables + bill splitting from first release.                                                                                                                                                                                                      | Dining cannot be deferred from launch.                                |
| POS-D02 | CONFIRMED, 2026-10-17 | Cash + manually recorded external-terminal payment, with multiple tender methods.                                                                                                                                                                                                | No direct provider integration needed for first release.              |
| POS-D03 | CONFIRMED, 2026-10-17 | Online first release, saved drafts and recovery on reconnection.                                                                                                                                                                                                                 | Full offline selling is deferred.                                     |
| POS-D04 | CONFIRMED, 2026-10-17 | Tailwind, shadcn/ui, Zustand and React Query.                                                                                                                                                                                                                                    | M1 architecture requirement.                                          |
| POS-D05 | CONFIRMED, 2026-10-17 | Item/equal/custom split checks; whole item quantities; move an open session to a free same-branch table; defer table merge; block shift close while checks remain unsettled. Paid correction authorization remains under D11/M7.                                                 | M4; M8                                                                |
| POS-D06 | OPEN                  | Confirm kitchen dispatch/prepayment/handover policy by fulfillment type and station configuration.                                                                                                                                                                               | M6; M5 integration                                                    |
| POS-D07 | CONFIRMED, 2026-10-17 | One shift per register; operators are individually attributed. Cashier/supervisor roles; supervisors approve discounts, voids and refunds; numeric limits remain unset. Existing grants are preserved; new accounts default to cashier and legacy role grants are owner-managed. | M2                                                                    |
| POS-D08 | CONFIRMED, 2026-10-17 | Deduct recipe requirements at kitchen acceptance; snapshot requirements per order so recipe edits do not affect pending sales; preserve legacy reservation for unmapped products.                                                                                                | M3                                                                    |
| POS-D09 | DEFERRED, 2026-10-17  | User said official ETA documents are not needed in current scope. Ordinary POS receipts must not claim tax-document status; reopen only if the user changes scope or a launch requirement is established.                                                                        | Deferred                                                              |
| POS-D10 | PARTIAL               | 80mm + printable/downloadable PDF confirmed by D16; printer/OS/browser, physical width, scanner/drawer needs, terminal policy and adapter details remain open.                                                                                                                   | M5 adapter; M9 hardware acceptance                                    |
| POS-D11 | OPEN                  | Confirm prepared-item cancellation/waste, refund/return/restock and supervisor rules.                                                                                                                                                                                            | M7                                                                    |
| POS-D12 | OPEN                  | Confirm deployment, register provisioning, timezone/business day, retention, load and measurable performance budget.                                                                                                                                                             | M9                                                                    |
| POS-D13 | CONFIRMED, 2026-10-17 | Equal support for light and dark themes across POS and KDS.                                                                                                                                                                                                                      | M1 tokens/shell; both-theme verification in every frontend milestone. |

Unanswered decisions gate only their dependent behavior. M1 can proceed without resolving all later policies.

Reference-alignment decisions confirmed on 2026-10-17:

| ID      | Status    | Decision / remaining scope                                                                                                                                                                                                               |
| ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D14 | CONFIRMED | Merchant-configurable POS accent; orange default. Merchant-level appearance ownership in Merchants; POS theme scope preserves other apps.                                                                                                |
| POS-D15 | CONFIRMED | Screenshots are the design reference; define missing tokens/components within the project. No external Figma/code source supplied.                                                                                                       |
| POS-D16 | CONFIRMED | 80mm thermal receipt plus printable/downloadable PDF for an ordinary POS receipt. POS-D10 is now PARTIAL: printer/OS/browser, physical width/hardware and adapter details remain open. ETA fiscal integration is deferred under POS-D09. |

Do not ask again whether orange/configurable branding or 80mm/PDF is wanted. Ask for remaining hardware specifics when their implementation depends on them; do not schedule ETA integration unless its scope is reopened.

## Milestone checklist

### M0 — Contract and source audit

- [x] Read repository/API instructions and current architecture; inspect affected source/schema/contracts/tests and worktree.
- [x] Record confirmed launch choices and selected frontend stack.
- [x] Define backend ownership/dependencies, frontend state ownership and target folder structure.
- [x] Define domain invariants, transaction/recovery rules, delivery milestones and release gates.
- [x] Create Feature and Progress as linked implementation references.
- [x] Verify documentation formatting, local references and whitespace; results below.

Exit: planning artifacts are ready to implement. No software feature completion is implied.

### M1 — Frontend foundation and existing-flow migration

- [x] Declare exact compatible React Query/Zustand POS dependencies; preserve workspace lockfile consistency. Added Lucide icons and the existing workspace's tsx version for focused tests.
- [x] Add app providers, one QueryClient, tenant/branch-scoped key factories and typed transport errors/abort handling. Session, queue and catalog features use the live query layer.
- [x] Establish working frontend folders and Tailwind/shared UI conventions for the prototype; no empty scaffolding. Live features remain in their current locations until their migration slices.
- [x] Implement scoped shared light/dark tokens and Light/Dark/System preference for prototype screens; theme/language context preservation and current employee UI regression verified.
- [x] Establish reviewable cashier shell and interactive sample sales, rounds, split, checkout/recovery, tables and kitchen states before broad feature implementation.
- [~] Review prototype in light/dark and Arabic RTL/English LTR: automated journeys and screenshot inspection complete; cashier/operator observations remain open.
- [x] Move session and queue reads/mutations to React Query; preserve existing login/branch/grant behavior.
- [x] Establish scoped Zustand cart/workspace stores and versioned draft persistence. Identity/device/branch scoping, storage failure and live cashier draft recovery are covered.
- [x] Establish durable uncertain-command storage for existing accept/prepare actions; preserve exact saved request IDs during migration and require explicit retry/reconciliation.
- [x] Retain existing queue pagination during refresh and reject stale responses through identity-scoped query keys.
- [x] Verify existing accept/prepare retry behavior, scope isolation, storage-unavailable handling, focus/reconnect, RTL and loading/error states through unit and browser checks. Payment recovery remains an M5 gate.
- [x] Run affected POS/UI/API checks and the existing POS browser regression. The catalog endpoint has authenticated HTTP coverage; sale commands have unit/HTTP and PostgreSQL coverage.

Exit: foundation works and the current incoming-order workflow is preserved; no new sales promise yet.

### Reference-aligned design refinement — implemented in the isolated prototype

- [x] Record the user's reference-source, merchant-accent and receipt-format choices; update Feature/UI_UX.
- [x] Inventory shared primitives and define scoped orange-default semantic accent pairs for both themes.
- [x] Refine the isolated POS and add a local merchant-accent preview; retain sample illustrations and item-name wrapping.
- [x] Add one shared accessible Popover primitive; reuse the existing Dialog as the narrow-screen bottom sheet.
- [x] Add one synchronized order-context picker with dine-in/table resume, quick takeaway and required delivery name/phone/address fields.
- [x] Add typed sample receipt presentation and 80mm print/save-as-PDF output, isolated from M5 official issuance and configured fiscal rules.
- [x] Recheck light/dark, Arabic/English, desktop/tablet/phone, split/recovery, receipt and print-only layouts in five Chrome journeys.
- [ ] Complete cashier/operator usability tasks and record observed time, assistance and mis-taps.
- [x] Correct the POS employee browser test's ambiguous status locator and verify the employee login/queue regression passes again. No Merchant Dashboard behavior was changed for this fix.

This slice refines the prototype/design system; it does not mark production sales, merchant-settings persistence, official receipt issuance, downloadable-PDF generation beyond the browser print dialog, or physical-printer acceptance complete.

### M2 — Register, shift and permission foundation

- [x] Resolve POS-D07: one open shift per register with individually attributed operators; cashier and supervisor roles; supervisor approvals for discounts, voids and refunds; no numeric limits configured.
- [x] Add cashier/supervisor role presets and owner assignment. New owner-created accounts default to cashier; existing legacy employees receive no new sell/open-shift grants unless the owner assigns a role.
- [x] Introduce the Shifts module, shared contracts, Prisma models/migration, module registration, dependency lint rule and API architecture entry.
- [x] Implement assigned-branch register selection, exact opening-float normalization, idempotent opening requests and a one-open-shift database constraint. Shift opener and each sale's operator attribution are persisted.
- [~] Enforce the initial role capability server-side. Supervisor approval capabilities are available in the role contract; sensitive sale commands are not implemented until their owning milestones.
- [x] Build the POS opening screen with React Query and durable Zustand recovery, plus the owner register setup page.
- [~] HTTP/unit and browser-stub checks cover role permissions, auth boundaries, request validation, register setup and shift opening. The PostgreSQL test passes for duplicate replay, competing opens, foreign-tenant and branch denial. Revoked-session database coverage and a complete cashier browser journey remain pending.

Exit: an authorized operator can open a valid register shift. The PostgreSQL concurrency and tenant/branch boundary checks pass; a complete cashier browser journey and revoked-session verification remain. Closing/reconciliation is still M8.

### M3 — Sales, authoritative quotes and inventory integration

- [x] Resolve POS-D08; add additive stock/snapshot migrations and preserve historical-order compatibility.
- [x] Add tenant-scoped catalog/search and quote contracts while retaining Catalog pricing ownership.
- [x] Build the compact product grid/search/configurator, line notes/quantities and multiple persisted cashier drafts.
- [x] Add cashier order contracts with optional walk-in customer and delivery-specific validation.
- [x] Add catalog revision checks, exact idempotent command results, immutable priced lines, explicit POS source and stock handling.
- [x] Implement online confirmation, frozen recipe requirements and DIRECT/RECIPE/mixed posting without double deduction.
- [x] Verify stale quote rejection, shortage atomicity, duplicate confirmation, database rollback/restoration and unaffected legacy/storefront behavior in HTTP/unit and PostgreSQL tests.
- [~] Complete live cashier browser walkthrough and cashier/operator review; the in-app browser connection failed before navigation, so visual acceptance remains open.

Exit: persisted cashier orders are priced and stock-safe, with no assumption that payment or kitchen release is already delivered.

### M4 — Dining sessions, rounds and split checks

- [x] Resolve POS-D05 for split modes/whole quantities, same-branch moves, deferred merge and shift-close blocking; retain paid correction authorization under D11/M7.
- [x] Add owner-managed branch tables and model table/session/order/check ownership with compound tenant keys.
- [x] Build table occupancy and open-session views, create/resume sessions from dine-in orders, add rounds and move sessions to a free same-branch table.
- [x] Enforce one open session per table and stable table-row locking for simultaneous moves.
- [x] Allocate checks by whole item quantities, equal cents or custom cents; validate exact item and order-total conservation.
- [x] Persist an initial check for every POS sale and preserve one source order/stock posting across all split checks.
- [x] Make check edits revisioned and idempotent; reject stale and concurrent split edits. Settled allocation immutability remains a M5 integration invariant because settlement is not implemented yet.
- [x] Verify table move and whole-item split UI behavior in Chrome with intercepted HTTP responses; check the orange action, Arabic copy and RTL switch. Item/equal/custom math, authorization/contracts and persistence/concurrency have unit, HTTP and PostgreSQL coverage.
- [ ] Complete a cashier/operator usability review; this is a release-readiness task and does not block M4's API/database exit criteria.

Exit: all required first-release dining/split modes work against the API/database, ready for tender integration. API, PostgreSQL and automated browser checks pass; live operator acceptance remains a release-readiness gap.

### M5 — Cash/external-terminal tender and ordinary sale receipts

- [x] Keep official ETA fiscal-document integration out of current scope per the user's latest direction. Ordinary POS receipts must not be represented as tax invoices/eReceipts; the confirmed 80mm/PDF requirement remains.
- [x] Introduce the Payments module and transaction-scoped tender recording. Orders owns order/check locks, branch/shift eligibility, idempotent command results and settlement; Payments owns exact tender/change rules; Shifts records net cash in the same transaction.
- [x] Implement backend cash received/applied/change, manually confirmed external-terminal tender, partial payments, split tender, remaining balances and settled-check state.
- [x] Persist exact payment command results for safe server replay. The live POS stores the exact pending request before sending it, restores it after reload, and requires an explicit cashier action to replay the same ID; financial writes are never automatically retried.
- [x] Expose branch-scoped payment state with check balances, settlement state and recorded tender history for checkout.
- [x] Build the live payment dialog for new sales and dining orders, with check selection, cash/terminal split tenders, cash received/change, remaining-balance preview and same-command retry for uncertain replies.
- [x] Settle and lock paid checks. Ordinary immutable receipt records, numbering, customer history/reprint and PDF/thermal output are unfinished.
- [ ] Build history/detail/reprint, PDF output and configured thermal layouts; keep physical I/O after commit.
- [ ] Prove concurrent tender caps, duplicate recording, split-check conservation, atomic cash-journal effects and printer/PDF failure isolation.

Exit: a confirmed order/check can be settled and its ordinary POS receipt recovered after reload without duplicate collection or stock. Receipt issuance/output is not complete; M5 remains in progress.

### M6 — Kitchen display and fulfillment

- [ ] Resolve POS-D06; define station configuration, dispatch/prepayment and handover gates per fulfillment type.
- [ ] Persist station tickets/lines, dispatch events and amendment/cancellation acknowledgements.
- [ ] Build queue with age, table/order number, variants/modifiers, preparation notes and stale/connectivity state.
- [ ] Implement item/station readiness, order readiness and completion/handover; distinguish no-preparation products.
- [ ] Support additional rounds and post-dispatch changes as deltas, preserving paid/prepared history.
- [ ] Prove multi-station/multi-device concurrency, duplicate dispatch safety, correct cancellations and no excess customer/payment visibility.

Exit: POS/table/storefront work can reach the correct kitchen station and be handed over with truthful persisted progress.

### M7 — Cancellation, refunds, returns and supervisor approval

- [ ] Resolve POS-D11; document command matrix for stage, payment, physical handling and approval threshold.
- [ ] Implement rejection/preparation-stage cancellation and kitchen notification as separate from financial refund.
- [ ] Add original-sale-linked full/partial refunds with quantity/amount caps and reservations for in-progress actions.
- [ ] Add supported DIRECT return/restock and prepared-item waste handling; reverse original batches only when eligible.
- [ ] Bind supervisor approval to exact payload/revision/actor/expiry and record both identities/reason.
- [ ] Test simultaneous partial refunds, late-shift refund, expired approval, insufficient permission, already-prepared line and repeated requests.

Exit: money, order progress and physical stock remain reconciled through supported exception paths.

### M8 — Shift close, operational reports and owner controls

- [ ] Implement paid-in/out/drops, reason/approval requirements and signed journal entries.
- [ ] Implement closing barrier, blind count, expected/actual cash, variance and immutable close snapshot.
- [ ] Reject postings to closed shifts and resolve pending attempts; prove close/tender/refund race behavior.
- [ ] Add scoped owner register/table/station/policy/permission configuration; UI respects server grants.
- [ ] Add sales/collections/refunds/outstanding/waste/discount/preparation/shift reports using SQL aggregation and bounded details.
- [ ] Prevent document/order-summary double counting and distinguish accepted orders from paid sales.
- [ ] Test day/timezone boundaries, later-shift refunds, filters/export and attribution.

Exit: operators can reconcile a complete business shift and owners can explain all commercial/inventory adjustments.

### M9 — Release verification and pilot

- [ ] Resolve POS-D09/D10/D12 and every launch-critical decision; record actual topology/hardware/load budget.
- [ ] Run live browser -> API -> migrated PostgreSQL journeys for takeaway, delivery, dine-in, split checks and refunds.
- [ ] Run the Feature scenarios for duplicate requests, uncertain commits, reconnect, account switching and resource contention.
- [ ] Rehearse additive migrations on fresh/representative databases and enable/disable/recovery procedure without data loss or double posting.
- [ ] Verify real printer/PDF/scanner/drawer scope, keyboard/touch, Arabic RTL/LTR and agreed device viewports.
- [ ] Complete UI/UX task trials and state/contrast/focus checks in both themes; record measurements and operator feedback, not screenshot appearance alone.
- [ ] Measure representative peak throughput/query latency against the agreed budget; record fixture size and results.
- [ ] Verify monitoring/alerts, backup restoration, incident/reconciliation procedures and unresolved-command operator recovery.
- [ ] Wire all new suites into package scripts/CI; run affected API/POS/contracts/database/UI and neighboring regression checks.
- [ ] Run a controlled real-operator pilot; reconcile cash/tenders/documents/stock/kitchen/session closure and record release acceptance.

Exit: launch is reviewable with real evidence. No mandatory task remains incomplete or silently deferred.

## Verification ledger

| Date       | Check                                                                                                                         | Result                                            | Scope / limitations                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-10-17 | `git status --short`; targeted source/schema/contracts/test and architecture reads                                            | PASS — source audit completed                     | Read-only; existing unrelated changes recorded. No runtime behavior inferred.            |
| 2026-10-17 | `node --version`; `pnpm --version`; `.node-version` read                                                                      | Node 20.19.0; pnpm 10.34.5; required Node 24.11.1 | Environment observation only. No application check attempted.                            |
| 2026-10-17 | `pnpm exec prettier --check docs/features/pos/FEATURE.md docs/features/pos/PROGRESS.md`                                       | PASS, exit 0                                      | Both documentation files; formatting only.                                               |
| 2026-10-17 | PowerShell local Markdown link resolution across both POS documents                                                           | PASS, exit 0; 12 local references resolve         | Extracted Markdown link targets and checked paths relative to each document.             |
| 2026-10-17 | `git diff --check -- docs/features/pos/FEATURE.md docs/features/pos/PROGRESS.md`; direct PowerShell trailing-whitespace check | PASS, exit 0                                      | New files are untracked, so direct content checking is required in addition to Git diff. |
| 2026-10-17 | Application lint/typecheck/build/tests, database and browser execution                                                        | NOT RUN — documentation-only task                 | Historical inventory/M6b evidence is not a fresh check.                                  |

UI/UX follow-up verification, 2026-10-17:

- `pnpm exec prettier --check docs/features/pos/FEATURE.md docs/features/pos/PROGRESS.md docs/features/pos/UI_UX.md`: PASS, exit 0.
- PowerShell relative Markdown-link resolution over all three files: PASS, 16 local references resolve.
- Direct PowerShell trailing-whitespace check and `git diff --check -- docs/features/pos`: PASS, exit 0. Direct content checking includes the untracked files.
- Application/database/browser checks: NOT RUN; documentation only. Interactive prototype and operator usability trials remain unchecked milestone work.

For future slices, record exact commands, exit status, test counts where available, database fixture/environment, skipped checks and reasons. New suite names in the checklist are targets; confirm actual package scripts before invoking them. API implementation must follow its required typecheck/lint/build/default-test and affected-database checks. Do not modify Turbo commands/configuration without first reading installed Turbo docs.

### M4 implementation verification — 2026-10-17

- `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api typecheck`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api lint`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api build`: PASS, exit 0.
- `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/api test`: PASS, 118 HTTP/unit tests. A first sandbox run hit `spawn EPERM`; a later full run concurrent with the PostgreSQL test had six file-level failures, then the full suite rerun by itself passed 118/118. The overlap is recorded; no root cause was established for that intermediate failure.
- From `apps/api`, `$env:DOTENV_CONFIG_PATH='..\..\.env'; fnm exec --using 24.11.1 node --import dotenv/config --test --test-isolation=none dist/test/database/pos-dining.database.test.js`: PASS, 1 PostgreSQL integration test against the configured local database. It verifies rounds, initial checks, item/equal/custom split persistence, replay, stale revisions, branch scope and competing table moves. Adding item persistence first exposed an invalid nested Prisma relation write; the service now connects each allocation through its compound order/merchant-scoped line key, and the rebuilt integration test passes.
- `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/contracts build`: PASS. `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos typecheck`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos lint`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/pos build`: PASS. POS tests via `fnm exec --using 24.11.1 node --import tsx --test --test-isolation=none src/features/prototype/prototype-model.test.ts src/app/pos-workspace-store.test.ts` from `apps/pos`: PASS, 9 tests.
- `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/merchant-dashboard typecheck`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/merchant-dashboard lint`; `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/merchant-dashboard build`: PASS. POS production bundle is 600.30 kB minified (183.34 kB gzip); Dashboard bundle is 837.78 kB minified (239.78 kB gzip). Both exceed Vite's 500 kB advisory and should be considered for code splitting during hardening.
- `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-dining.config.ts tests/ui/pos-dining.spec.ts`: PASS, 1 Chrome journey. It exercises moving a session and splitting whole item quantities, uses intercepted HTTP responses, and asserts the orange action color, no horizontal page overflow, Arabic copy and RTL document direction. This is not live API/database browser coverage.
- `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database exec prisma migrate deploy --config ./prisma.config.ts`: PASS; migration `20261017170000_pos_existing_order_checks` applied to local PostgreSQL. `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database db:check`: PASS; schema validates, Prisma client generates, and all 31 migrations are up to date. No production database was changed.
- Initial default-sandbox attempts for Node's child-process test runner, Vite/Rolldown and Prisma's schema engine returned `spawn EPERM`; reviewed reruns completed. The in-app browser remains unavailable from the earlier M3 attempt; M4 browser QA used Playwright Chrome.
- A later parallel type/lint run exhausted Node memory; all affected checks passed when rerun sequentially.

### M5.1 backend check settlement verification — 2026-10-17

- Scope: one backend slice only. Added the Payments contracts/module and `POST /pos/orders/:id/checks/:checkId/payments`; Orders validates tenant/branch, originating open shift, check state and revision under locks, and stores exact idempotent action results. Payments records cash received/applied/change and manually confirmed external-terminal tenders in integer cents. Cash applied is journaled through Shifts in the same transaction. No checkout UI, receipt issuance, ETA adapter, KDS, or later milestone was implemented in this slice.
- Persistence/contracts: added `PosOrderPayment`, check settlement state/revision and `PosShiftCashMovement`, plus additive migrations `20261017180000_pos_check_payments` and `20261017190000_pos_payment_action_kind`. The second migration extends the existing action-kind constraint for payment replay records; applied migrations were not edited. Local PostgreSQL only; no production deployment.
- PASS: API `typecheck`, `lint`, and `build`; the complete HTTP/unit suite passes **122 tests across 23 suites**. The first default-sandbox test run could not start a Node worker (`spawn EPERM`); the reviewed local rerun passed.
- PASS: rebuilt `test/database/pos-dining.database.test.js` against configured local PostgreSQL. It verifies item/equal/custom split persistence, partial cash with change, manual-terminal balance settlement, exact replay without duplicate payment, one net cash-journal row, and immutability after settlement. This is a focused integration test, not a concurrency/load proof.
- PASS: `fnm exec --using 24.11.1 pnpm.cmd --filter @waffarly/database db:check`; schema validation, Prisma generation and migration status report all **33 migrations applied**. The sandbox attempt validated/generated successfully but Prisma's Windows schema engine returned `spawn EPERM`; local rerun passed. No database reset was used.
- Failure/correction preserved: the first payment DB integration run exposed that the existing `order_action_kind` constraint rejected `pos_payment`. Added the follow-up additive migration above, applied it locally, rebuilt and reran the integration successfully.
- Files: `apps/api/src/modules/payments/*`, Orders payment route/service/schemas, Shifts cash-journal integration, `packages/contracts/src/pos-payments.ts`, Prisma schema and migrations 32–33, payment/order tests, API dependency boundaries, and the POS Feature/Progress/API architecture references. Existing unrelated edits in the shared worktree were preserved.
- Next slice: build the live cashier payment/balance UI. Keep uncertain-reply recovery and ordinary 80mm/PDF receipt issuance as separate slices. ETA fiscal integration is deferred by user direction.

### M5.2 live cashier checkout UI verification — 2026-10-17

- Scope: added a branch-scoped `GET /pos/orders/:id/payment-state` read model and a shared live checkout dialog available after a new sale and from dining-session orders. It selects among split checks, shows check amount/collected/remaining, lists prior tenders, supports up to four cash/manual-terminal tenders, previews applied total/change/new balance, and disables collection for settled or cancelled checks. An ambiguous response locks editing and permits only replay of the exact same in-memory command while the dialog remains open; persistence across navigation/reload is the next separate slice.
- Changed files: `apps/pos/src/features/payments/*`, checkout entry points in catalog/dining, POS Arabic payment labels and test script; `packages/contracts/src/pos-payments.ts` and its public exports; Orders payment-state service/route and its HTTP/database tests; checkout browser test and POS dining Playwright config; Feature/Progress/UI_UX/API architecture documentation. No database schema or migration changed.
- PASS: contracts build; API typecheck/lint/build; POS typecheck/lint/build; shared UI build/lint (one existing Fast Refresh warning in unchanged `badge.tsx`). POS tests pass **12/12** including exact-cent tender previews. The default POS test attempt hit Windows `spawn EPERM`; the reviewed local rerun passed.
- PASS: serial API suite `fnm exec --using 24.11.1 node --import tsx --test --test-isolation=none dist/test/http/*.test.js dist/test/unit/*.test.js` from `apps/api`: **123 tests, 23 suites, 0 failures**, including the new authenticated payment-state route. The package's parallel `test` command previously exhausted memory in Go/esbuild workers and showed several file-level failures; the serial rerun passed all tests.
- PASS: `fnm exec --using 24.11.1 pnpm.cmd exec playwright test --config playwright.pos-dining.config.ts --reporter=list`: **4 Chrome tests**. It covers a cash/terminal partial split and updated balance, exact request-ID reuse after an interrupted response, 390px checkout overflow/visibility, and the existing dining move/split journey. The phone screenshot was visually checked: the payment total, remaining balance, and primary action stay visible while tender inputs scroll. API replies are intercepted; this is not live cashier-to-API browser coverage.
- PASS: the rebuilt local PostgreSQL `pos-dining.database.test.js` integration test verifies persisted partial/settled payment state and tender history in addition to dining/split/cash-journal behavior. All 33 migrations were already applied; this slice adds none.
- Environment note: default-sandbox Vite, test-worker and Playwright commands returned `spawn EPERM`; reviewed local reruns passed. POS production output is 616.14 kB minified and still triggers Vite's existing >500 kB chunk advisory.
- Next slice: persist the exact pending payment envelope and reconcile safely after a reload or navigation. Ordinary 80mm/PDF receipt issuance remains a later M5 slice. ETA integration remains deferred.

### M5.3 durable cashier payment recovery verification — 2026-10-18

- Scope: bumped the Zustand workspace storage schema to v3 while retaining v1/v2 parsing and existing drafts/actions. The POS saves the exact branch/check/request ID/revision/tender envelope before the API write. The workspace remains scoped by merchant, employee and device; recovery envelopes retain branch identity. Storage failures block new payment writes, and a failed durable clear retains the saved envelope so another command cannot replace it.
- Recovery behavior: a shared notice in the authenticated POS shell surfaces pending payments across routes. Reopening performs a read-only payment-state refresh; only an explicit “Check saved result” action replays the exact saved ID. There is no automatic replay on reconnect or load. A successful or definitive response clears the envelope durably; if that clear fails, the same command stays available for safe idempotent replay.
- Changed files: POS workspace types/validation/persistence and unit tests; POS shell and payment dialog/recovery notice; catalog/dining checkout props; Arabic payment strings; checkout Playwright journey; Feature, Progress, UI_UX and API architecture references. No API/database contract, schema or migration changed.
- PASS: POS typecheck/lint, shared UI build/lint, POS unit suite (**15 tests**), Prettier and scoped `git diff --check`. The UI lint keeps one existing Fast Refresh warning in unchanged `packages/ui/src/badge.tsx`.
- PASS: five Chrome journeys. The recovery case simulates the server committing a payment while its reply is lost, then navigates away, reloads, and verifies the notice returns. It confirms no payment retry occurs automatically and that the cashier’s explicit replay uses the same request ID while the mock server retains exactly one payment. A 390px Arabic RTL screenshot confirms the saved-result action remains visible without horizontal overflow. HTTP responses are intercepted; this is not live browser-to-API/database coverage.
- PASS: POS production build; output is 622.73 kB minified and still triggers Vite’s >500 kB chunk advisory. No database test was required because this slice changes only client persistence and invokes the existing idempotent payment endpoint.
- Limit: recovery depends on the same merchant/employee/browser profile. Clearing browser storage after an unknown result removes the local retry envelope; the server’s check balance/history remain authoritative. Full offline collection is not supported.
- Next slice: implement ordinary per-check receipt snapshots and 80mm/printable-PDF output. Keep these receipts explicitly non-fiscal. ETA integration remains deferred.

### Interactive prototype verification — 2026-10-17

All implementation commands used Node 24.11.1 via an explicit PATH prefix. Dependencies were added offline from the existing `F:/.pnpm-store`; no global configuration was changed. Initial default-sandbox test/browser attempts returned `spawn EPERM`; reviewed outside-sandbox reruns completed successfully.

| Check                                                                                                                  | Result               | Scope / limits                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @waffarly/ui build`                                                                                     | PASS                 | Shared components/types, dialog, themes and translations.                                                                                                                                                                                |
| `pnpm --filter @waffarly/ui typecheck` and `pnpm --filter @waffarly/ui lint`                                           | PASS, exit 0         | Existing Fast Refresh warning in unchanged `badge.tsx`; no new lint warning.                                                                                                                                                             |
| `pnpm --filter @waffarly/pos typecheck` and `pnpm --filter @waffarly/pos lint`                                         | PASS, exit 0         | Includes prototype and focused test source; no POS lint warnings.                                                                                                                                                                        |
| `pnpm --filter @waffarly/pos test`                                                                                     | PASS, 5 tests        | Exact splits/amount parsing including Arabic/Persian digits, tender caps, interrupted-reply replay, paid allocation preservation and kitchen/settlement handover gating against the in-memory adapter. Not PostgreSQL/concurrency proof. |
| `pnpm --filter @waffarly/pos build`                                                                                    | PASS                 | Production router excludes `/prototype`; main bundle about 518 kB minified / 162 kB gzip with a >500 kB advisory. No capacity claim.                                                                                                     |
| Production JavaScript marker inspection                                                                                | PASS                 | No preview route, fixture ID, mock-query or draft-store markers. Shared Arabic/English translation strings remain intentionally included; searching translated copy alone is not evidence of a fixture leak.                             |
| `pnpm exec playwright test --config playwright.pos-prototype.config.ts`                                                | PASS, 4 Chrome tests | Light/dark/system, Arabic RTL, customization/notes, split tender/recovery/receipt, kitchen/handover, search/keyboard/Escape/focus restoration, 820px tablet and 390px phone. All commercial data is the isolated adapter.                |
| `pnpm exec playwright test --config playwright.pos-employees.config.ts --output test-results/pos-employees-regression` | PASS, 1 Chrome test  | Existing owner employee creation, POS login, saved accept retry, preparation and Arabic browser regression. API responses are mocked.                                                                                                    |
| Existing development server `GET http://127.0.0.1:5175/prototype`                                                      | PASS, HTTP 200       | Reused the user's existing server; did not start or stop it. The in-app Browser connector failed to initialize; browser QA used existing local Playwright/Chrome instead.                                                                |

Screenshots inspected/generated under ignored `test-results/`: `pos-prototype-light.png`, `pos-prototype-dark.png`, Arabic light/dark, split, kitchen, tables, payment recovery, tablet and phone views. Prototype screenshot checks use reduced motion to avoid capturing intermediate theme transitions. Earlier keyboard tests exposed missing modal trigger-focus restoration; the shared dialog was corrected, including StrictMode close-event handling, and the final four journeys pass. The floating order-access control is hidden while the narrow-screen cart is open so it cannot cover the amount due.

Final source/document `pnpm exec prettier --check` and scoped `git diff --check` passed. Direct content whitespace checks included new untracked files; all 16 relative Markdown references resolve.

No API/database/schema changes, real payment-provider calls, inventory movements, live browser-to-database integration, physical printing verification or operator usability trials were performed. M1 remains partial and M2–M9 remain not started.

### Reference-aligned design refinement verification — 2026-10-17

All commands used Node 24.11.1. The tests and browser runner first hit the Windows sandbox's `spawn EPERM`; their approved workspace reruns are recorded with final results below.

| Check                                                                                                                                  | Result                     | Scope / limits                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @waffarly/ui build`                                                                                                     | PASS                       | Shared Popover export, POS tokens and Arabic catalog compile.                                                                                                                                                                                                         |
| `pnpm --filter @waffarly/ui lint`                                                                                                      | PASS, one existing warning | No errors; unchanged `badge.tsx` Fast Refresh warning remains.                                                                                                                                                                                                        |
| `pnpm --filter @waffarly/pos typecheck` and `pnpm --filter @waffarly/pos lint`                                                         | PASS                       | POS prototype, picker, document and test source; no lint warnings.                                                                                                                                                                                                    |
| `pnpm --filter @waffarly/pos test`                                                                                                     | PASS, 5 tests              | Existing amount/split/tender/recovery/kitchen invariants against the in-memory adapter.                                                                                                                                                                               |
| `pnpm --filter @waffarly/pos build`                                                                                                    | PASS                       | 521.60 kB minified JS / 162.92 kB gzip; Vite retains the >500 kB advisory.                                                                                                                                                                                            |
| `pnpm exec playwright test --config playwright.pos-prototype.config.ts --reporter=list`                                                | PASS, 5 Chrome tests       | Accent persistence, light/dark, Arabic RTL, delivery validation, mobile sheet, desktop popover, occupied-table resume, checkout recovery, print emulation and existing prototype journeys. Sample data only.                                                          |
| Production JS marker inspection                                                                                                        | PASS                       | No unique prototype route, fixture ID, design-store key or prototype class marker. Shared translation strings remain in the common locale catalog and are not treated as fixture leakage.                                                                             |
| `pnpm exec playwright test --config playwright.pos-employees.config.ts --output test-results/pos-employees-regression --reporter=list` | FAIL, 1 test               | The Merchant Dashboard employee-create assertion's `getByRole('status')` matches both “Employee account created.” and “Loading employees…”. This test/page was left untouched; the earlier slice's successful run remains historical evidence, not the latest result. |
| Print screenshot inspection                                                                                                            | PASS for layout preview    | 80mm paper-only emulation excludes checkout actions and app chrome; no physical printer or downloadable-file output was exercised.                                                                                                                                    |

Screenshots are under ignored `test-results/`: `pos-prototype-light.png`, `pos-prototype-dark-orange.png`, `pos-prototype-dark.png`, `pos-prototype-context-mobile.png`, `pos-prototype-receipt-80mm.png`, and `pos-prototype-receipt-print.png`, along with the existing split, recovery, kitchen, table and viewport captures.

### Catalog density refinement — 2026-10-17

- The cashier catalog now uses four columns at 1200px, five at 1800px, three at 800px, two at 480px and one below 480px. Product artwork is 96px tall; product names/prices are 13px and supporting descriptions are 10px. The workspace title is 24px. Order/payment typography and cart controls were left unchanged.
- `pnpm --filter @waffarly/pos typecheck`, `lint`, and `build`: PASS under Node 24.11.1. Build retains the existing 521.60 kB minified JS (>500 kB) advisory.
- `pnpm exec playwright test --config playwright.pos-prototype.config.ts --reporter=list`: PASS, 5 Chrome tests. The browser spec now asserts four desktop columns/96px artwork, five extra-wide columns, three tablet columns and one phone column; the light screenshot was visually inspected.
- `pnpm --filter @waffarly/pos exec tsx --test src/features/prototype/prototype-model.test.ts`: PASS, 5 tests. The package-level `pnpm --filter @waffarly/pos test` glob did not expand under Windows `cmd`; running the test file directly avoided that shell limitation. Initial default-sandbox build/unit invocations also returned `spawn EPERM`; reviewed reruns passed.
- `pnpm exec prettier --write` was applied to the changed route, CSS, browser spec and UI/UX contract. No order rules, API contracts or milestone completion states changed.

### Mobile order-panel density refinement — 2026-10-17

- Tightened the narrow-screen order header, draft-line card, sent-item rows and total summary. The due amount and primary action remain prominent; quantity controls retain 44px hit areas.
- `pnpm --filter @waffarly/pos typecheck`, `lint` and `build`: PASS under Node 24.11.1. The existing >500 kB JavaScript bundle advisory remains.
- `pnpm --filter @waffarly/pos exec tsx --test src/features/prototype/prototype-model.test.ts`: PASS, 5 tests. `pnpm exec playwright test --config playwright.pos-prototype.config.ts --reporter=list`: PASS, 5 Chrome tests. The Arabic 390px journey asserts 8px line-card padding and a 44px-or-larger quantity target; updated phone screenshot was visually inspected.
- One browser attempt timed out because the test opened a configurable product dialog and continued without completing it. The test now uses the fixture's existing draft line; the full suite passed on rerun. This was test setup, not an application failure.
- Updated `order-panel.tsx`, the browser spec, UI_UX and this ledger. Order/payment behavior and M1–M9 status are unchanged.

### One-row order items and compact controls — 2026-10-17

- User asked to put each order item on one row and reduce text and buttons. Draft rows now place product/variant, line price, quantity controls and remove action on one horizontal row; sent rows align quantity, item, kitchen status and price. Mobile icon surfaces are 32px while quantity/remove hit areas stay 44px; secondary actions are 36px and the primary send/payment button is 44px.
- `pnpm --filter @waffarly/pos typecheck`, `lint` and `build`: PASS. `pnpm exec playwright test --config playwright.pos-prototype.config.ts --reporter=list`: PASS, 5 Chrome tests, including Arabic phone assertions for card height, visible control size, 44px hit area and sent-item row height.
- Visually inspected `test-results/pos-prototype-phone-arabic.png`. Updated `order-panel.tsx`, the browser spec, UI_UX and this ledger; no order behavior or production API changed.

The print button invokes the browser print dialog, where an operator can select a thermal printer or Save as PDF. M5 still needs a tested downloadable PDF implementation and immutable per-check receipts. Printer width/driver, locale fiscal rules, configured tax/fees and operator usability evidence remain open.

### M2 verification — 2026-10-17

- PASS: `@waffarly/contracts` build; database `db:validate`, Prisma client generation and database package build; API typecheck/lint/build; POS typecheck/lint/build; Merchant Dashboard typecheck/lint/build.
- PASS: all 107 API HTTP/unit tests, run serially with Node 24.11.1; POS unit suite, eight tests. These include employee role grants, owner/POS endpoint authorization, strict tenant payload validation, exact opening-float normalization, and durable retry-envelope persistence.
- PARTIAL: the owner register page rendered successfully and showed the created register in the first browser run. The combined owner/cashier regression did not complete: after fixing its ambiguous status locator, Chrome returned `ERR_INSUFFICIENT_RESOURCES` and opened blank pages during later reruns. The cashier shift screen has no completed browser assertion yet.
- PASS: `pnpm --filter @waffarly/api exec tsx --test test/database/shifts.database.test.ts` against the configured local PostgreSQL database, after applying `20261017120000_pos_register_shifts`. The migration status is clean. No production deployment was made.
- NOT RUN: revoked-session database coverage and a complete cashier browser journey. The browser regression encountered local Chrome `ERR_INSUFFICIENT_RESOURCES`; do not treat owner-page rendering or HTTP stubs as browser proof.
- Build note: POS output is 557.13 kB minified (172.78 kB gzip) and Merchant Dashboard output is 820.82 kB minified (235.71 kB gzip); Vite reports both above its 500 kB advisory threshold.

### M3 verification — 2026-10-17

- PASS: API `typecheck`, `lint` and `build` under Node 24.11.1. The serial compiled HTTP/unit run passes 111 tests with `fnm exec --using 24.11.1 node --test --test-isolation=none dist/test/http/*.test.js dist/test/unit/*.test.js` from `apps/api`.
- PASS: six focused PostgreSQL tests from the storefront-order and recipe-order lifecycle suites, run serially with `$env:DOTENV_CONFIG_PATH='..\..\.env'; fnm exec --using 24.11.1 node --import dotenv/config --test --test-isolation=none dist/test/database/storefront-orders.database.test.js dist/test/database/recipe-order-lifecycle.database.test.js` from `apps/api`. Coverage includes mixed DIRECT/RECIPE/legacy sales, exact request replay, stale quote rejection after a real product edit, direct-stock shortage rollback with no order/action/movement/variant debit, frozen recipe acceptance, cancellation restoration and POS/storefront list separation.
- PASS with local elevated process access: `pnpm --filter @waffarly/database db:check` validated the schema, regenerated Prisma Client and confirmed all 29 migrations are applied. The standard sandbox run reached migration status but Prisma's Windows schema engine returned `spawn EPERM`.
- PASS: `pnpm --filter @waffarly/contracts build`, `typecheck`, `lint`; POS `typecheck`, `lint`, `build`, `test`; shared UI `build`, `typecheck`, `lint`; Merchant Dashboard `typecheck`, `lint`. The POS source test script passes all nine cases with local elevated process access; its initial default-sandbox run could not spawn the `tsx` helper. Shared UI lint reports one existing Fast Refresh warning in unchanged `packages/ui/src/badge.tsx`.
- PASS with local elevated process access: POS Vite production build transformed 2,040 modules and emitted 583.85 kB minified JS (179.40 kB gzip). Vite's >500 kB chunk-size advisory remains. The standard sandbox build could not load the Windows Tailwind native binding and returned `spawn EPERM`; the elevated local build succeeded.
- NOT VERIFIED: live cashier browser walkthrough and screenshot. The local preview started on port 5181, but the in-app browser connection failed before navigation, so no browser-to-database sale evidence is claimed. A previous cashier browser run also ended with local Chrome resource exhaustion; neither result is counted as UI acceptance.
- Test corrections: the first stale-quote assertion used a revision below the request schema minimum, so the fixture now edits the product after quoting and verifies a conflict on the original command. The first direct-shortage check used the merchant's default `negativeStockPolicy: allow`; the focused fixture now sets `prevent` and proves the failed sale leaves stock, variants, orders, actions and movement batches unchanged. The final PostgreSQL run passes all six tests.
- Environment note: an initial batch of simultaneous Node checks exceeded the local heap. Serial reruns of POS typecheck and Prisma validation passed. Migrations are applied only to the configured local development/test database; no production migration or deployment occurred.

## Delivery log

### 2026-10-17 — POS planning and architecture

- Request: write reusable Feature/Progress implementation references with proper architecture/folder structure and Tailwind/shadcn/Zustand/React Query.
- User decisions: first release includes dine-in/tables/split checks; cash plus manual external-terminal records and split tender; online with saved drafts/recovery.
- Created this ledger and Feature; recorded current incoming-order baseline, modular ownership, folder destinations, state boundaries, transaction/tenant/concurrency rules and M0–M9 release gates.
- Architecture direction: extend Orders for sales/dining/kitchen/documents; introduce focused Payments and Shifts modules; retain shared Catalog/Inventory algorithms and enforce acyclic module exports.
- Implementation status: M0 planning completed; M1–M9 not started. No app code, dependencies, database schema/data or existing user modifications changed.
- Verification: source audit complete; final documentation checks recorded in the ledger before handoff. Runtime verification remains outside this documentation task.
- Next: M1 foundation; resolve POS-D07 before M2 and later decisions at their dependent milestones.

### 2026-10-17 — UI/UX reference and dual-theme contract

- User supplied a CosyPOS visual reference and requested an attractive interface that makes operational work easy; explicitly selected equal light/dark support.
- Added UI_UX with a reference assessment, workspace layout, product/cart behavior, tables/rounds, split checks, tender/recovery, kitchen and exception flows, semantic themes and measurable usability tasks.
- Linked the design contract from Feature/Progress and recorded POS-D13. Added foundation/prototype and release usability checks without changing M1–M9 implementation status.
- No app UI/prototype has been implemented or usability-tested in this slice. Business decisions POS-D05–D12 remain open; the visual design does not select their policies.
- Verification: documentation formatting, relative links and whitespace checked before handoff; no application/database/browser checks run for these documentation changes.

### 2026-10-17 — Interactive POS prototype

- Authorization: user accepted building the proposed interactive design prototype.
- Added an isolated development-only `/prototype` route, sample catalog/order adapter, separate React Query cache keys, Zustand draft/workspace store and shared QueryClient provider. The in-memory sample store never imports the live API client. Only the preview theme preference persists across reload.
- Implemented product/category/search/configuration/notes, per-order unsent drafts and running-order switcher; table sessions/rounds; equal/item/custom split interactions; partial cash/manual-terminal payments and interrupted-reply reconciliation; non-fiscal sample receipt; kitchen progression and handover/table release. These are design interactions, not completed production domain milestones.
- Added scoped semantic light/dark tokens, Light/Dark/System control, shared solid button variant/native modal adapter, SVG food illustrations, Arabic copy and responsive menu/order views. Kept existing login/queue chrome intact and verified the previous staff regression.
- Files: POS app providers/router and `src/features/prototype/*`; POS dependency/test manifest and lockfile; shared UI dialog/button/theme exports/localization; dedicated Playwright config/browser spec and prototype rule tests. Preserved unrelated ongoing Merchant/API/inventory work.
- Verification: commands/results above. No rollout, commit, production deployment, database reset or operational data mutation.
- Remaining: real operator review, final dispatch/split/tax/hardware policies, full M1 live session/queue/durable recovery work, then M2–M9 business integration. The prototype intentionally does not resolve these decisions.

### 2026-10-17 — Reference-aligned design-system and receipt plan

- User supplied orange/dark POS, order-context picker and bakery receipt references and requested a plan to follow/extend the design system.
- Confirmed POS-D14–D16: merchant-configurable accent with orange POS default; screenshots are the design source and missing tokens/components are defined locally; 80mm thermal receipt plus printable/downloadable PDF.
- Updated UI_UX with shared token/component ownership, photo-capable catalog/fallbacks, synchronized fulfillment/table/customer forms, document variants, per-check/partial-tender facts, paper/theme behavior and refinement sequence. Added Merchants ownership for future tenant POS appearance settings; Orders retains document issuance/snapshots.
- Added the pending design-refinement checklist. No app code, API contracts, schema, printer integration or current green prototype styling changed in this planning follow-up. Existing prototype/browser test evidence above was not rerun or relabeled as new verification.
- Remaining before physical/fiscal integration: printer/OS/browser, actual printable width and operating country/tax rules. Confirmed accent/source/80mm/PDF choices must not be asked again.

### 2026-10-17 — Denser cashier product catalog

- User asked for smaller typography and product tiles so more menu items fit in the selling workspace.
- Updated the development prototype to a responsive 1/2/3/4/5-column catalog, shortened artwork from 128px to 96px, reduced catalog label spacing/type and workspace title slightly, and gave category tabs some of their vertical space back. Kept order/payment controls unchanged.
- Added browser assertions for desktop, tablet and phone catalog density; visually inspected the refreshed desktop screenshot. Updated UI_UX and this ledger. Verification and the Windows shell limitation are recorded above.

### 2026-10-17 — Compact mobile order panel

- User asked to shrink the mobile order panel shown in the Arabic screenshot. Tightened mobile-only header/line/summary typography and spacing while keeping quantity controls at 44px and the total/primary action clear.
- Added a browser check for the compact draft card and touch target; visually inspected the Arabic phone screenshot. Exact verification and one corrected test-fixture timeout are recorded above.

### 2026-10-17 — One-row order items and smaller controls

- User asked to put order items on one row and reduce the font/buttons. Reflowed draft and sent items horizontally, shrank mobile text and visible icon surfaces, and kept quantity/remove hit areas 44px with 36px secondary actions.
- Browser assertions verify the compact row dimensions and Arabic phone screenshot; exact checks are recorded above.
- Verification for this follow-up: documentation formatting, relative references and direct whitespace checks only; no runtime checks were required for these documentation changes.

### 2026-10-17 — Reference-aligned design refinement implementation

- Implemented the confirmed design slice in the isolated `/prototype`: shared orange-default POS tokens with four preview accents and light/dark pairs; shared Popover and responsive order-context controls; required delivery contact/address; safe occupied-table resume; and a typed 80mm sample receipt with print/Save-as-PDF styling.
- The local accent is a preview preference, not persisted merchant configuration. Context/sample order/payment behavior remains in-memory. The sample receipt remains an order summary with no fiscal claims or configured tax/fees.
- Verification: shared UI build/lint, POS typecheck/lint, five POS rule tests, production build and five Chrome prototype journeys pass. Print output was visually inspected with browser print emulation. The latest existing employee regression attempt failed on its ambiguous Dashboard status locator; its files were not changed.
- No API/database contracts, printer drivers, official issuance, deployment, commits, database resets or concurrent Merchant Dashboard/API/inventory changes were modified for this slice.
- Next: cashier/operator task review, resolve the separate regression selector in the current Dashboard work, then continue M1 live session/queue React Query migration and durable draft/recovery work.

### 2026-10-17 — M1 live POS foundation and catalog read

- Migrated employee session and existing recipe-order queue reads/mutations to React Query. Preserved branch/grant checks, queue polling and pagination, retry IDs and accept/start-preparation behavior. Added authenticated POS catalog browsing at `GET /pos/catalog`; the endpoint derives merchant identity from the POS employee session and returns the existing tenant-scoped sellable projection.
- Added the feature-scoped API/query/UI files and a versioned Zustand workspace draft/recovery store scoped by merchant, employee and browser device. Drafts carry branch/context/product selections and notes, not authoritative prices, payment facts, permissions or order status. Existing uncertain accept/prepare IDs are migrated and replayed exactly; new mutations are blocked if their recovery envelope cannot be saved.
- Fixed the employee browser regression selector and corrected the prototype's visible compact quantity controls to retain 44px hit areas. Existing compact product grid and one-row mobile order-item design remain in the isolated prototype.
- Files: POS `app/providers.tsx`, `app/pos-workspace-store.ts`, `features/auth/*`, `features/orders/*`, `features/catalog/*`, session/login/layout/queue/router/API client, prototype order panel; API catalog query/controller/module and HTTP test; shared catalog contract/export; POS browser specs/config; this ledger and Feature.
- Verification under Node 24.11.1: contracts build/typecheck/lint; API typecheck/lint/build; POS typecheck/lint/unit tests/build; 96 API HTTP/unit tests passed serially; five catalog PostgreSQL integration tests passed; one employee browser regression and five prototype Chrome journeys passed. The catalog route has authenticated HTTP coverage; the five database tests verify related catalog projections and persistence, not a live browser-to-sale flow. No checkout exists to test yet.
- The initial parallel full API test run exhausted memory in worker processes; rerunning the same HTTP/unit set serially passed all 96 tests. POS production build passes with a 546.79 kB minified JavaScript bundle (170.46 kB gzip), above Vite's 500 kB advisory threshold.
- No POS schema migration or commercial write endpoint was added. Production sale creation, quote/cart UI, payment, official receipt, kitchen routing and dining workflows remain unimplemented. M1 stays partial pending cashier/operator evaluation; M2 is gated by POS-D07.
- Next: gather cashier/operator feedback and resolve POS-D07 (register/drawer ownership, role presets and approval limits) before implementing the register/shift foundation.

### 2026-10-17 — M2 register and shift foundation

- User confirmed one shift per register with individually attributed operators, and cashier sales with supervisor approval grants for discounts, voids and refunds. Numeric thresholds remain unset.
- Added Shifts ownership, register/shift contracts, scoped Prisma models and migration, owner register endpoints, POS assigned-register/current-shift/open-shift endpoints, lock-backed idempotent opening, and database uniqueness for one active shift per register. Existing employee queue permissions are preserved; owner-created employees default to cashier, while legacy employees gain no sales/shift grants unless the owner assigns a role.
- Added owner register setup, cashier shift-opening UI, React Query requests and a durable Zustand opening-request envelope. The opener is attributed on the shift; sale-level operator attribution remains part of M3.
- Files include `apps/api/src/modules/shifts/*`, auth employee role mapping, `packages/contracts/src/{pos,shifts}.ts`, the Prisma schema/migration, POS `features/shifts/*` and workspace storage, Merchant Dashboard POS register setup/navigation, API unit/HTTP/PostgreSQL tests, POS storage tests, the employee browser scenario, and API architecture/feature/progress documentation.
- Verification and limits: API typecheck/lint/build and 107 serial HTTP/unit tests pass; the focused PostgreSQL duplicate/concurrent-open and scope test passes; POS typecheck/lint/build and eight unit tests pass; Merchant Dashboard typecheck/lint/build pass; schema validation/client generation pass. The migration is applied to the configured local PostgreSQL database. The browser run was blocked by local Chrome resource exhaustion after the owner register UI rendered; no production deployment was made.
- M2 remains partial. Closing/reconciliation, cash movements, real sale actor attribution, and executing discount/void/refund approvals belong to later milestones; sales/cart/checkout are still M3/M5 work.

### 2026-10-17 — M3 online cashier sales and stock compatibility

- Implemented the live compact cashier screen with React Query catalog/quote requests, a scoped Zustand cart/draft/recovery store, configurable items, notes, quantities, takeaway/delivery/dine-in context and durable confirmation requests. Sale confirmation is online-only and requires an open assigned register shift.
- Added Catalog-owned authoritative pricing for POS quotes and Orders-owned quote/create routes. Confirmation rechecks catalog revisions, snapshots immutable prices/selections and recipe requirements, records cashier and shift attribution, and fingerprints idempotent actions. POS orders are excluded from owner storefront fulfillment reads and included in POS kitchen reads.
- Added DIRECT sale consumption, RECIPE consumption at kitchen acceptance and legacy variant reservation compatibility. Cancellation/rejection restore recorded inventory effects; warehouse and stock-item archive guards account for pending snapshots and posted movements.
- Added contracts, Prisma models and additive migrations, API module architecture, POS UI/localization and focused unit/HTTP/PostgreSQL coverage. Updated Feature/Progress to resolve POS-D08 and describe the delivered flow.
- Verification and limits: API 111 HTTP/unit tests and six focused PostgreSQL tests pass; POS nine unit tests, typecheck/lint/build pass; database validation, shared UI build/typecheck/lint and Merchant Dashboard typecheck/lint pass. Exact commands, build size, environment constraints and browser limitation are recorded above.
- M3 remains in progress until a live cashier browser walkthrough and operator review pass. Payments/split tender/official receipts remain M5; table sessions/split checks remain M4; KDS work remains M6; cancellations/refunds/approvals remain M7.

### 2026-10-17 — M4 dining sessions and split checks

- User confirmed the proposed D05 behavior: split checks by whole items, equal shares or custom amounts; move an open session only to an available table in the same branch; defer table merging; block shift close while any check is unsettled. Paid-check corrections remain under D11/M7.
- Extended Orders with owner-managed dining tables, POS occupancy/session reads, dine-in session create/resume, additional rounds, revisioned/idempotent session moves and check splits. Item splits conserve whole quantities; equal/custom splits use exact cents. All new POS sales receive one initial check, including takeaway/delivery. Historical positive-total POS sales receive a single unpaid whole check through an additive backfill; unknown historical table/session facts remain unset.
- Added the cashier dining view and split dialog, table deep links from the catalog, owner table settings, shared contracts, compound tenant/branch relationships, concurrency locks and focused unit/HTTP/PostgreSQL tests. Updated the API architecture and feature/progress contracts.
- Used the shared language switcher and added Arabic labels for dining, table moves and all split modes; the browser journey verifies the page changes to Arabic RTL.
- Verification: API 118 HTTP/unit tests, API typecheck/lint/build, nine POS unit tests, POS typecheck/lint/build, Merchant Dashboard typecheck/lint/build, contracts build, one focused PostgreSQL integration test, one mocked-HTTP Chrome dining journey, and Prisma validation/client generation/migration status all pass. Exact commands and environment limits are recorded above.
- M4 exit criteria pass. Cashier/operator usability review and live browser-to-API/database acceptance remain open release-readiness work; payments and official per-check documents remain M5. The historical-check migration is local only; production rollout has not occurred.
