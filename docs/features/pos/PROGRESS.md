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

- Last updated: 2026-10-17.
- Overall: **M1 PARTIAL — interactive design prototype implemented; operational integration remains pending.**
- Current milestone: M1 frontend/prototype foundation. M0 documentation/source audit complete; M2–M9 not started.
- First-release scope: takeaway, delivery, dine-in, tables, split checks; cash/manual external-terminal tender and split tender; online with draft/request recovery.
- Frontend stack: React/Vite, Tailwind v4, shared shadcn/ui, Zustand for client drafts/workspace, TanStack React Query for server state.
- Design: reference-aligned cashier workspace with orange default, local merchant-accent preview, equal light/dark support, responsive order-context picker and 80mm receipt/print-to-PDF preview in development-only `/prototype`. Operator evaluation not performed.
- The confirmed design refinement has been implemented in the isolated prototype. It does not add live order creation, persistent merchant settings, official receipts, physical printer integration or configured tax/fiscal behavior.
- Existing operational baseline: branch-assigned POS employee login and incoming recipe-order accept/start-preparation queue. This must remain functional during migration.
- Runtime verification: five prototype rule/adapter tests and five Chrome prototype journeys pass for the refinement. The employee POS browser regression passed in the earlier slice; its latest rerun fails in the concurrent Merchant Dashboard employee-creation assertion because two status elements match. See the separate evidence below; no live API/database integration is claimed.
- Production readiness: **not established**. All M1–M9 milestones, real end-to-end validation and operational pilot remain required.
- Next action: review the refined UI with cashiers/operators, resolve the employee regression selector against the current Dashboard changes, then finish M1 operational session/queue query migration, tenant-scoped drafts and durable recovery. Later commercial/hardware decisions remain gated.

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

| ID      | Status                | Decision / next action                                                                                                                                         | Gate                                                                  |
| ------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| POS-D01 | CONFIRMED, 2026-10-17 | Takeaway + delivery + dine-in + tables + bill splitting from first release.                                                                                    | Dining cannot be deferred from launch.                                |
| POS-D02 | CONFIRMED, 2026-10-17 | Cash + manually recorded external-terminal payment, with multiple tender methods.                                                                              | No direct provider integration needed for first release.              |
| POS-D03 | CONFIRMED, 2026-10-17 | Online first release, saved drafts and recovery on reconnection.                                                                                               | Full offline selling is deferred.                                     |
| POS-D04 | CONFIRMED, 2026-10-17 | Tailwind, shadcn/ui, Zustand and React Query.                                                                                                                  | M1 architecture requirement.                                          |
| POS-D05 | OPEN                  | Confirm item/equal/custom split semantics, paid corrections, whole-item quantities and table move/merge scope.                                                 | M4                                                                    |
| POS-D06 | OPEN                  | Confirm kitchen dispatch/prepayment/handover policy by fulfillment type and station configuration.                                                             | M6; M5 integration                                                    |
| POS-D07 | OPEN                  | Confirm shared drawer vs employee shifts, role presets and approval/discount limits.                                                                           | M2                                                                    |
| POS-D08 | OPEN                  | Finalize legacy/DIRECT stock cutover and pending/accepted recipe snapshot strategy.                                                                            | M3                                                                    |
| POS-D09 | OPEN                  | Confirm country, tax/fees, receipt/fiscal requirements and numbering. Do not invent tax rates.                                                                 | M5; launch                                                            |
| POS-D10 | PARTIAL               | 80mm + printable/downloadable PDF confirmed by D16; printer/OS/browser, physical width, scanner/drawer needs, terminal policy and adapter details remain open. | M5 adapter; M9 hardware acceptance                                    |
| POS-D11 | OPEN                  | Confirm prepared-item cancellation/waste, refund/return/restock and supervisor rules.                                                                          | M7                                                                    |
| POS-D12 | OPEN                  | Confirm deployment, register provisioning, timezone/business day, retention, load and measurable performance budget.                                           | M9                                                                    |
| POS-D13 | CONFIRMED, 2026-10-17 | Equal support for light and dark themes across POS and KDS.                                                                                                    | M1 tokens/shell; both-theme verification in every frontend milestone. |

Unanswered decisions gate only their dependent behavior. M1 can proceed without resolving all later policies.

Reference-alignment decisions confirmed on 2026-10-17:

| ID      | Status    | Decision / remaining scope                                                                                                                                                                      |
| ------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D14 | CONFIRMED | Merchant-configurable POS accent; orange default. Merchant-level appearance ownership in Merchants; POS theme scope preserves other apps.                                                       |
| POS-D15 | CONFIRMED | Screenshots are the design reference; define missing tokens/components within the project. No external Figma/code source supplied.                                                              |
| POS-D16 | CONFIRMED | 80mm thermal receipt plus printable/downloadable PDF. POS-D10 is now PARTIAL: printer/OS/browser, physical width/hardware and adapter details remain open. Country/fiscal rules remain POS-D09. |

Do not ask again whether orange/configurable branding or 80mm/PDF is wanted. Ask for remaining hardware/fiscal specifics when their implementation depends on them.

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
- [~] Add app providers, one QueryClient, tenant/branch-scoped key factories and typed transport errors/abort handling. Shared provider and isolated prototype keys delivered; live tenant-scoped query/transport migration remains.
- [x] Establish working frontend folders and Tailwind/shared UI conventions for the prototype; no empty scaffolding. Live features remain in their current locations until their migration slices.
- [x] Implement scoped shared light/dark tokens and Light/Dark/System preference for prototype screens; theme/language context preservation and current employee UI regression verified.
- [x] Establish reviewable cashier shell and interactive sample sales, rounds, split, checkout/recovery, tables and kitchen states before broad feature implementation.
- [~] Review prototype in light/dark and Arabic RTL/English LTR: automated journeys and screenshot inspection complete; operator observations and detailed policy decisions remain open.
- [ ] Move session and queue reads/mutations to React Query; preserve existing login/branch/grant behavior.
- [ ] Establish scoped Zustand cart/workspace stores, versioned draft persistence and identity cleanup.
- [ ] Establish durable uncertain-command storage/reconciliation; preserve existing saved accept/prepare envelopes during migration.
- [ ] Retain existing queue pagination during refresh and reject stale responses after branch changes.
- [ ] Verify current accept/prepare retry behavior, no state leakage on account/branch switch, storage-unavailable behavior, focus, RTL and loading/error states.
- [x] Run affected POS/UI checks and existing POS browser regression for this prototype slice; no contract changes. This does not close the unchecked live-integration tasks above.

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
- [!] Latest employee-queue regression rerun: the Merchant Dashboard employee-creation test has an ambiguous `getByRole('status')` locator while both success and loading messages are present. No Dashboard code/test changes were made in this POS refinement.

This slice refines the prototype/design system; it does not mark production sales, merchant-settings persistence, official receipt issuance, downloadable-PDF generation beyond the browser print dialog, or physical-printer acceptance complete.

### M2 — Register, shift and permission foundation

- [ ] Resolve POS-D07; document initial role presets/register provisioning and non-expansive employee permission migration.
- [ ] Introduce Shifts module/contracts/schema/migration; update module registration/dependency lint/docs in the same slice.
- [ ] Implement authorized register selection, opening float, one-open-shift constraint and attributable operators.
- [ ] Add server-enforced capability grants and supervisor identity primitives without shared credentials.
- [ ] Build opening/register shell and owner setup using shared UI and server queries.
- [ ] Test duplicate concurrent open, tenant/branch/register denial, revoked session and exact opening amount.

Exit: an authorized operator can open a valid register shift. Closing/reconciliation is still M8.

### M3 — Sales, authoritative quotes and inventory integration

- [ ] Resolve POS-D08; design additive stock/snapshot migration and historical-order compatibility.
- [ ] Add scoped bounded POS catalog/search/barcode and quote contracts; retain Catalog pricing ownership.
- [ ] Build product grid/search/configurator, cart notes/quantities and multiple suspended drafts.
- [ ] Add cashier order contract with optional walk-in customer; validate delivery details separately from storefront checkout.
- [ ] Add revisions/command results, immutable priced lines and explicit source/stock handler.
- [ ] Implement online confirmation, frozen requirements and DIRECT/RECIPE/mixed posting without double deduction.
- [ ] Prove stale quote review, shortage atomicity, duplicate confirmation and unaffected legacy/storefront handling.

Exit: persisted cashier orders are priced and stock-safe, with no assumption that payment or kitchen release is already delivered.

### M4 — Dining sessions, rounds and split checks

- [ ] Resolve POS-D05 and model tables/session/order/check ownership with compound tenant keys.
- [ ] Build table list/occupancy, start/resume session, server-persisted rounds and same-branch table move.
- [ ] Enforce active occupancy uniqueness and stable locking for simultaneous assignments/moves.
- [ ] Allocate checks by whole items/quantities, equal shares and custom amounts under the selected split policy.
- [ ] Preserve cents/discounts/fees/tax and prevent duplicate line or stock effects across splits.
- [ ] Enforce immutable settled allocations and revision conflicts on concurrent split edits.
- [ ] Test shared-device visibility, repeat rounds, deterministic remainders and session closure prerequisites.

Exit: all required first-release dining/split modes work against the API/database, ready for tender integration.

### M5 — Cash/external-terminal tender and sale documents

- [ ] Resolve POS-D09 and the document/adapter portion of POS-D10; do not label receipts as fiscal-compliant without evidence.
- [ ] Introduce Payments module/exports, allocations and immutable records; Orders coordinates bill/payment commands using the caller transaction.
- [ ] Implement cash received/applied/change, manual terminal confirmation, partial payments, split tender and exact balances.
- [ ] Implement durable command-result recovery and reconciliation-required UI without automatic financial replay.
- [ ] Finalize settled checks and create immutable uniquely numbered sale documents; distinguish bills, acknowledgements and order summaries.
- [ ] Build history/detail/reprint, PDF output and configured thermal layouts; keep physical I/O after commit.
- [ ] Prove concurrent tender caps, duplicate recording, split-check conservation, atomic cash-journal effects and printer/PDF failure isolation.

Exit: a confirmed order/check can be settled and its document recovered after reload without duplicate collection or stock.

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

The print button invokes the browser print dialog, where an operator can select a thermal printer or Save as PDF. M5 still needs a tested downloadable PDF implementation and immutable per-check receipts. Printer width/driver, locale fiscal rules, configured tax/fees and operator usability evidence remain open.

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
- Verification for this follow-up: documentation formatting, relative references and direct whitespace checks only; no runtime checks were required for these documentation changes.

### 2026-10-17 — Reference-aligned design refinement implementation

- Implemented the confirmed design slice in the isolated `/prototype`: shared orange-default POS tokens with four preview accents and light/dark pairs; shared Popover and responsive order-context controls; required delivery contact/address; safe occupied-table resume; and a typed 80mm sample receipt with print/Save-as-PDF styling.
- The local accent is a preview preference, not persisted merchant configuration. Context/sample order/payment behavior remains in-memory. The sample receipt remains an order summary with no fiscal claims or configured tax/fees.
- Verification: shared UI build/lint, POS typecheck/lint, five POS rule tests, production build and five Chrome prototype journeys pass. Print output was visually inspected with browser print emulation. The latest existing employee regression attempt failed on its ambiguous Dashboard status locator; its files were not changed.
- No API/database contracts, printer drivers, official issuance, deployment, commits, database resets or concurrent Merchant Dashboard/API/inventory changes were modified for this slice.
- Next: cashier/operator task review, resolve the separate regression selector in the current Dashboard work, then continue M1 live session/queue React Query migration and durable draft/recovery work.
