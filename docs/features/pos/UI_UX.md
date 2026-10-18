# POS UI and UX — Design Contract

## Purpose and status

- Date: 2026-10-17.
- Companion requirements: [FEATURE.md](FEATURE.md); execution evidence: [PROGRESS.md](PROGRESS.md).
- Status: design contract with an isolated development prototype, live cashier checkout and saved receipt history/reprint. Automated browser checks cover split tenders, retrying the same command after an interrupted response, narrow-screen checkout and printing/reopening a saved receipt; real-operator usability trials and physical hardware acceptance remain open. See Progress for exact evidence.
- References: the original CosyPOS screenshot and the later orange-accent POS, order-context picker and bakery receipt screenshots. The user confirmed that the screenshots are the source reference; define missing tokens/components in this repository.
- CONFIRMED refinement: merchant-configurable POS accent, orange by default; first receipt target is 80mm thermal plus printable/downloadable PDF for an ordinary POS receipt. The live POS now saves immutable settled-check receipts and offers branch-scoped reprint from the receipt history. The print layout targets 80mm and the browser print dialog can save to PDF; merchant settings, direct one-click PDF generation and physical printer support remain open. ETA fiscal integration is deferred by the user.
- CONFIRMED: light and dark themes have equal support. Neither is a secondary release or a kitchen-only theme.
- Confirmed operating scope: takeaway, delivery, dine-in/tables/split checks; cash/manual external-terminal payments and split tender; online operation with saved drafts/recovery.
- Stack: Tailwind v4 and shared shadcn/ui, React Query for server facts, Zustand for client drafts/workspace. Follow Feature's architecture and existing localization conventions.

The primary design goal is predictable work during a busy shift: keep the current order visible, make common operations direct, explain consequential actions, and preserve context when interrupted. Attractive styling must support that goal.

## Assessment of the supplied reference

| Keep                                                      | Adapt for this POS                                                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear navigation, product area and persistent order panel | Put branch/register/shift, fulfillment type and current table/order identity in a compact workspace header.                                                             |
| Calm dark surfaces and restrained pastel accents          | Define complete light/dark semantic tokens; reserve status colors for meaning. Category tints must not look like preparation/payment statuses.                          |
| Recognizable categories and product cards                 | Replace the large category tiles with compact scrollable tabs/chips so more sellable products remain visible. A category overview can be optional for very large menus. |
| Cart totals and checkout access in a fixed location       | Show remaining balance, sent/new items and applicable charges explicitly. Use distinct kitchen and payment actions.                                                     |
| Quick access to running orders                            | Provide labeled suspended drafts/table sessions with count and identity, plus an overflow list; do not rely on tiny unlabeled tabs.                                     |

Specific risks in the reference: secondary text is visually small/low-contrast; quantity controls are small; the remove affordance looks dependent on a swipe/hover reveal; repeated card steppers add clutter; payment choices and a generic “Place Order” button obscure whether the next action sends food, collects money or both. These are visual assessments, not measured failures of the original product.

## Workspace and information hierarchy

### Cashier desktop / landscape target

Use the full viewport, with no marketing header or decorative dashboard metrics above the selling workspace.

| Region                 | Proposed layout                                   | Contents                                                                                                                                                     |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation rail        | About 72–88px wide with icons and short labels    | Sell, Tables, Orders, Kitchen; shift/history/settings behind role-appropriate secondary navigation. Current section is explicit.                             |
| Workspace header       | About 56–64px high; wraps when needed             | Branch/register, shift state, connection/last-sync state, user/theme/language controls. Branch switching is deliberate.                                      |
| Product workspace      | Remaining flexible width                          | Search/scanner entry, compact category tabs, product grid/list, loading/empty/stale states.                                                                  |
| Order panel            | Approximately 360–420px on supported wide screens | Order/table identity, fulfillment selector, items, notes/customer access, price breakdown, action area. Validate width with long Arabic names and modifiers. |
| Draft/session switcher | Compact strip or drawer access                    | Current draft plus named suspended drafts; active dining sessions remain server-backed and distinct from local drafts.                                       |

These dimensions are prototype targets, not fixed requirements for every device. Establish breakpoints from content and the agreed hardware. Mirror logical regions for RTL while preserving readable numbers and product content.

At narrower tablet widths, collapse the rail before squeezing product controls. If a persistent order panel no longer fits, use a labeled order drawer with item count/total and a persistent access button. On portrait/mobile, use separate menu/order views with a visible order summary; do not shrink the full desktop arrangement. Checkout must remain usable when the on-screen keyboard is open.

### Product discovery and configuration

- Search by name/code; scanner input routes to the same lookup without stealing focus from customer/amount inputs. Give exact barcode matches clear precedence; ambiguous or unknown codes receive explicit feedback.
- Category tabs show the selected category and allow overflow navigation without clipped labels. Search results preserve enough category context to understand the result.
- Product cards prioritize name and price. Images are optional supporting information, not a dependency for recognizing the product. Avoid different card heights caused by missing images or long names.
- Keep catalog density responsive: use three columns on tablet, four on standard cashier desktops and five on extra-wide displays; keep one column on narrow phones. Use a compact 96px image tile and slightly smaller catalog labels, while preserving legible order/payment text and comfortable controls. Treat these as prototype breakpoints to validate on target registers.
- Tapping an unconfigured simple product adds one draft unit with immediate local feedback. Required variants/modifiers open a configurator before adding. Keyboard users can reach the equivalent actions.
- Configurator shows required choices, defaults, minimum/maximum counts, quantity, resulting quote, notes and one clear Add/Update action. Preserve choices when a validation or quote request fails.
- Do not silently apply a different variant, substitute an unavailable choice or accept a stale quote. Explain the change and keep the editable draft.
- Display a quantity badge for matching items already in the current draft. Put primary quantity editing in the cart; optional card shortcuts must remain touch-accessible without crowding every card.
- Merge draft lines only when product/variant/modifiers/notes and relevant context match exactly. Never merge a new draft line into an already sent/paid line in a way that hides a new round.
- Unavailable products remain understandable with a reason; do not rely on a faint disabled color or allow an invalid confirmation.

### Order panel and actions

The panel must make these facts answerable without opening a dialog: which order/table is active, which lines are new, what the kitchen has received, what is paid, and what remains due.

- Display fulfillment type (Takeaway / Delivery / Dine-in) prominently; table identity is required for a dining session. Do not require a customer account for a basic walk-in sale.
- Group new unsent items separately from sent/preparing/served items. Each persisted group shows its actual state; edits to sent/paid work follow amendment rules.
- Cart lines show quantity, product/variant, modifiers, preparation note indicator and line total. Quantity/remove/edit controls have labeled touch targets and keyboard access; no hover/swipe-only destructive action.
- On narrow touch screens, show new and sent order items as compact horizontal rows. Group product/variant and price opposite quantity/remove controls. Reduce visible button surfaces, labels and summary spacing, while keeping quantity/remove hit areas and the main confirmation target at least 44px. Secondary actions may use smaller controls, remain separated and keep accessible names.
- A simple unsent-item removal is immediate with undo. Consequential sent-item cancellation/refund uses an explicit reason/approval flow. Undo cannot reverse a completed commercial transaction locally.
- Keep the amount due and relevant action area visible while the item list scrolls. Show subtotal, discount, configured charges/tax and paid amount without hiding fees behind an unlabeled total.
- Show separate “Send to kitchen” and “Take payment” actions where applicable. Which action is primary depends on order state and the confirmed branch dispatch policy; UI styling must not choose POS-D06 implicitly.
- For immediate sales that need one combined confirm-and-pay action, label it with its actual effect and amount, and only expose it when the supported policy/transaction does that. Never use a generic “Place Order” label for multiple meanings.
- Actions display meaningful pending state and prevent duplicate submission. A successful local button animation is not proof that the server committed.

## Dedicated workflows

### Tables and dining

- Start with a fast table grid/list, grouped by configured area if available; a graphical floor-plan editor is not required for launch.
- Each table shows table number/name, occupancy, time open, order progress and outstanding balance. Use text/icon cues alongside color. Keep “free,” “occupied,” “food ready,” and “payment due” distinguishable.
- Opening an occupied table resumes its live session. A free-table selection starts an explicit session; conflicting assignment from another terminal explains the conflict and opens/refetches the current state.
- New rounds use the same menu/order layout and a clear “new items” group. Previously sent lines stay visible and protected from accidental direct edits.
- Moving a session is a guided destination selection with availability and a summary of the move. Preserve bills/payments; avoid a drag-only interaction.
- Before releasing a table, show outstanding work/balance and the required resolution. Paying one split check must not make the entire table appear settled.

### Split check workspace

Use a dedicated spacious view, not a stack of nested dialogs. Keep the original order summary, check allocations and unallocated remainder visible together.

- Clearly separate “Split bill” from “Split payment methods.”
- Offer supported split modes with a short explanation: by items, equal shares, custom amounts. Final semantics remain POS-D05; prototypes must label assumptions.
- By items: select a line/available quantity and assign it to a check; show modifier/discount context and remaining quantity. Provide buttons/keyboard actions even if optional drag-and-drop is added.
- Equal/custom: show each amount and exact remainder distribution. The preview must conserve the original total; no hidden rounding discrepancy.
- Each check shows amount, paid amount, remaining balance and a clear settled indicator. Paid allocations cannot be silently reassigned.
- Before confirming a split, show what changes; on stale revision, preserve proposed choices where safe and explain what another operator changed.

### Checkout and payment

Use a focused checkout sheet/dialog on wide screens and a full view on narrow screens. Keep order/check identity and amount due visible throughout.

- Cash and External terminal are separate, explicit choices. External terminal means the operator records an already confirmed external transaction; no simulated provider success state.
- Cash entry displays received amount, applied amount and change, with useful exact/common amount shortcuts and a keypad on touch devices. Currency input must handle the supported locale without float settlement logic.
- Split tender shows each proposed/recorded payment and the remaining amount. Distinguish partial collection from full settlement in the final action label and success state.
- External-terminal entry shows amount/reference fields and asks for explicit operator confirmation according to the approved terminal policy. Never collect card credentials.
- An uncertain recording gets an inline persistent state: “Checking payment result” / “Payment result needs checking,” with the appropriate reconciliation action. Do not encourage a second payment while the first result is unknown.
  - Keep unresolved payment recovery visible from every authenticated POS route. After reload, fetch the latest server balance and require the cashier to explicitly replay the exact saved command ID; never automatically resubmit a financial write on reconnect.
- On success, show the committed paid amount/change and receipt actions. New sale is a deliberate, fast next action. Receipt printer failure stays recoverable on the completed sale.
- Errors stay next to the relevant field/action and preserve entries; do not use disappearing toast messages as the only financial feedback.

### Kitchen display

- Same light/dark theme support, with a focused station workspace instead of the full cashier chrome. Large order/table identity, clear elapsed time, prominent modifiers/notes and direct preparation/ready actions.
- Organize queued/preparing/ready work with a layout that remains readable at the agreed station distance and viewport. Never hide an urgent note to fit a decorative card.
- Show station-level progress and other-station dependencies without suggesting the whole order is ready early.
- New/changed/cancelled work has explicit visual markers and acknowledgement. Optional sound is configurable and never the only signal; do not promise sound before browser/device validation.
- Preserve scroll/selection while updates arrive. New work must not move a ticket underneath an operator's pointer while they are confirming an action.

### History, exceptions and shift close

- Orders/history search supports order/document number, table/customer when permitted, date and status. Execution/payment states have separate labels.
- Order detail gives a readable event timeline and distinct actions: reprint, cancel remaining work, refund, record return. Show only authorized actions and explain stage restrictions.
- A refund preview states original sale, selected quantities, original discounts/charges, refundable amount, money method and separate stock/waste decision before execution.
- Shift close is a short guided sequence: outstanding attempts, cash count, variance review and confirm. Preserve count input if reconciliation fails; don't expose expected cash before the blind count step.
- Empty states explain the next useful action; permission/connection/configuration failures must not look like “no orders.”

## Light and dark themes — equal support

Use shared semantic CSS variables in `@waffarly/ui`; map them to Tailwind utilities. Avoid hardcoded component colors and independent POS theme sheets that diverge from the shared token model.

| Token group                                            | Purpose                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Background / surface / elevated surface / border       | Workspace, cards and dialogs with distinguishable hierarchy in both themes.                                   |
| Foreground / muted foreground                          | Readable primary and secondary labels, including small timestamps and disabled explanations.                  |
| Primary / primary foreground / focus ring              | Main action, selection and keyboard focus with sufficient contrast in both themes.                            |
| Success / warning / destructive / info and foregrounds | Consistent operation statuses accompanied by text/icon labels.                                                |
| Category accent pairs                                  | Restrained menu tints whose foreground remains readable; not reused as ambiguous financial status indicators. |

- Use the confirmed orange POS default with merchant-configurable accent pairs and neutral surfaces. The isolated prototype now previews orange, plum, teal and blue in both themes; other applications keep their existing appearance. Use restrained category accents, simple borders and minimal shadows; avoid decorative gradients in the workspace.
- Provide Light / Dark / System preference, persisted as a non-sensitive workspace preference. Manual override takes precedence over system; switching theme preserves cart, focus, open dialog, filters and recovery state.
- Apply the preference before the workspace becomes visible where practical to avoid a theme flash. Verify existing workspace chrome and shared components; a POS theme must not unexpectedly restyle other applications.
- Every required screen/state must be reviewed in both themes, including overlays, numeric entry, hover/focus/disabled/error, printer-failure and reconciliation states. Print/PDF uses a deliberate paper layout independent of screen theme.
- Theme is not tied to role. Cashier and kitchen may each select either theme.

## Typography, density and interaction rules

- Prototype with a readable 14–16px interface base, larger order identity/totals, tabular monetary figures and stable alignment. Validate the chosen Arabic/Latin fonts with real long labels; do not solve overflow by shrinking critical text.
- Use a consistent small spacing scale and modest corner radii. Product cards and tables may be dense; primary, quantity and destructive hit targets remain at least the Feature's proposed 44px minimum and do not overlap. Secondary mobile actions can use smaller controls with clear labels and spacing.
- One obvious primary action per focused step; secondary actions remain discoverable. Financial/state-changing actions state their effect. Contextual shortcuts must not conflict with browser, scanner or text-entry behavior.
- Support search focus, product selection/configuration, cart editing and checkout by keyboard. Enter in a search/input must not accidentally settle a bill; Escape must not discard committed work or close an unresolved operation without recovery access.
- shadcn/Radix dialogs keep focus, have readable labels/descriptions, return focus to the origin, and offer keyboard dismissal where safe. Validation focuses the first actionable issue.
- Keep routine cart additions unobtrusive. Use persistent inline feedback for money/stock/connection uncertainty; avoid modal confirmation for every reversible draft edit.
- Loading preserves context: skeletons for initial reads, unobtrusive background refresh, explicit blocking only for consequential commands. Avoid full-screen spinners on every poll.
- Local cart feedback should be immediate; test a proposed target below 100ms on agreed hardware. Network-dependent actions show pending state promptly and truthful completion after the response. Final performance budgets remain POS-D12.

## State and failure design checklist

Design each applicable screen for initial loading, background refresh, empty result, search miss, validation error, forbidden action, stale revision, unavailable product/shortage, command pending, unknown result, success and disconnected/stale data.

Never hide an unresolved commercial operation in a toast or clear its cart to imitate success. Persisted recovery is exposed in the workspace; another user cannot view/replay the previous actor's private drafts. On reconnect, show reconciliation before allowing a conflicting financial command. Disconnected draft editing remains clearly labeled as unconfirmed.

Polling must not reset filters, loaded pages, text input, scroll or currently focused controls. Theme/language changes must not reset form/draft state. A permission change invalidates available actions through the server-state model, not a persisted UI flag.

## Design delivery and usability gates

### Before broad feature layout implementation

1. Inventory shared UI primitives/theme tokens; add only those needed by the next slice. M1 must preserve the existing incoming-order screen while the new shell is introduced.
2. Build a reviewable interactive prototype of the selling workspace, product customization, occupied-table round, split check and checkout. Include representative error/reconciliation states, Arabic RTL and both themes. Any sample data must be clearly isolated from operational routes and must not masquerade as real orders/payments.
3. Validate the layout at proposed desktop/landscape tablet widths and an agreed narrower viewport. Actual deployment sizes remain POS-D10. Provide screenshots of matching light/dark and LTR/RTL states.
4. Walk through the tasks below with a cashier/operator. Record observations and adjust the design before broad implementation. A prototype may be reviewed before the dependent business rules are finalized; it must not silently decide them.

### Proposed usability tasks

| Task                                                                       | Evidence to record                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Find a simple item, add two, correct quantity and collect cash             | Time/actions, mis-taps, change readability and any assistance.                   |
| Configure size/add-ons/note, suspend draft and resume another              | Choice clarity, preservation of selections, and mistaken order identity.         |
| Open a table, send a round, return later and add another                   | Whether sent/new items and kitchen status are understood without explanation.    |
| Split items between two checks, pay one using two methods                  | Allocation mistakes, remaining balance visibility and unintended table release.  |
| Recover after an uncertain payment response and reload                     | Whether the operator avoids collecting again and can locate the original result. |
| Cancel prepared work, record an authorized refund and handle print failure | Whether money, waste/restock and receipt actions are distinguishable.            |
| Complete the same core flow in Arabic/RTL, light/dark and by keyboard      | Overflow, focus order, translation clarity, contrast and task completion.        |

Targets are proposals to measure, not claimed test results: no assistance for routine tasks after a short orientation; no loss of draft context; no duplicate financial action; no accidental payment/stock change through normal keyboard use. Establish timing/mis-tap budgets from actual operator/hardware trials and record them under POS-D12.

Track design work in the existing milestones: M1 shell/tokens/prototype foundation; M3 selling; M4 tables/splitting; M5 checkout/documents; M6 KDS; M7 exceptions; M8 closing; M9 usability/device acceptance. A polished static screenshot alone does not complete any operational milestone.

## Current prototype scope

Run the existing POS Vite dev server and open `/prototype` (normally `http://localhost:5175/prototype`). The development route is excluded from the production router; it imports no live API client. The normal login and incoming-order routes retain their existing workspace chrome.

Implemented preview: product search/categories/configuration/notes/quantities, separate new/sent lines, independent running drafts, table selection and additional rounds, equal/item/custom split previews, partial cash/manual-terminal tenders, interrupted-reply recovery, kitchen progress and settled/ready handover. Light/Dark/System, a local merchant-accent preview and Arabic/English work across the prototype; narrow screens use explicit menu/order views. The order-context control is shared by the header and cart, uses an anchored popover on desktop and a bottom sheet on phones, stages context edits, resumes occupied sample tables, and requires delivery name, phone and address. Existing sample orders with sent lines or payments have locked context fields.

The in-memory adapter resets sample orders/payments on reload; only local theme and accent-preview preferences persist. The accent is not a merchant setting. Recovery demonstrates same-session result reconciliation, not durable production recovery. The sample dispatch rule is explicit sending followed by independent payment/preparation; it does not resolve POS-D06. Split amounts in the adapter demonstrate the interaction, not the final persisted quantity/discount/tax allocation model. The sample receipt is an order summary labeled non-fiscal, with tender received/change details and an 80mm print/Save-as-PDF layout. It does not issue a per-check immutable financial document. Delivery fees are unconfigured. Physical hardware, actual cash management, refunds, real authentication/tenant grants, stock posting and fiscal issuance remain later milestones.

## Reference alignment and missing-component plan — 2026-10-17

Status: the isolated preview and live cashier receipt action/history are implemented; production accent settings and physical printer acceptance remain TARGET. Confirmed choices: define the system from the screenshots, merchant-configurable accent with orange POS default, and 80mm receipt plus printable/downloadable PDF. Equal light/dark and Arabic/RTL support remain required. The browser print dialog offers Save as PDF; direct one-click file generation and printer models remain open under POS-D10. ETA fiscal issuance is deferred under POS-D09.

### 1. Extend the shared design system

Implemented: scoped light/dark tokens now use orange by default with readable orange/plum/teal/blue accent and foreground pairs. Added a shared, keyboard-dismissable Popover primitive and reused the shared Dialog on narrow screens. No extra tabs/select/tooltip/sheet primitive was needed for this slice. Keep POS theme overrides scoped so other applications retain their existing appearance.

The prototype exposes a clearly labeled local accent preview and persists only that preview preference. Merchant POS appearance remains a tenant-level setting owned by the Merchants business module when its API is implemented. The owner selects the accent; ordinary cashiers retain theme/language/workspace preferences. React Query owns the resolved merchant setting; Zustand may hold unsaved preview input, never the authoritative tenant configuration. Use validated light/dark foreground/background pairs and preview contrast before saving. Do not persist one merchant's effective branding as an unscoped device-global setting.

### 2. Refine the selling workspace

- Follow the reference's compact rail, scrollable category tabs, search, photo-capable product grid and persistent order panel. Expose supported workflows with accessible names/tooltips and clear selected states.
- Use actual catalog images in live workflows, consistent image ratio and stable price/unit placement. Design missing-image/failure fallbacks; sample illustrations remain suitable for the isolated preview. No stock photos are written into live product records.
- Keep long names/variants discoverable, sold-out reasons visible, and add/customize controls usable by touch and keyboard. An icon-only dense reference does not require tiny hit areas in our implementation.
- Preserve new versus sent/preparing items, paid allocations and additional rounds. Send, Take payment and Handover remain distinct actions driven by real state and confirmed dispatch policy.
- Put essential totals/actions in a stable location; avoid nested scrolling that hides the amount due or an open payment result.

### 3. Build one order-context picker

Implemented in the prototype: one shared app component uses an anchored popover on wide screens and a bottom-sheet Dialog on narrow screens. Header and order-panel entry points read the same active context; duplicate controls stay synchronized. The sample adapter validates entry and table occupancy locally; production still needs server validation, grants, revisions and persisted dining state.

| Mode     | Required interaction                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Dine-in  | Current table/session, searchable/grouped table choices, availability, selected-table state and a server-validated move flow.     |
| Takeaway | Optional customer/reference plus approved pickup details; a basic walk-in stays quick.                                            |
| Delivery | Customer/contact, address and configured delivery/fee details; a name-only form is insufficient for an actionable delivery order. |

Stage draft changes and apply explicitly. Closing an unapplied form keeps the existing context. Sent/paid orders need lifecycle eligibility, actor grants and revision checks for any change. An occupied table resumes/reports its session under policy; selection cannot silently steal a table or merge orders. Keep a table grid/list for launch; the reference's graphical floor-plan editor remains deferred.

### 4. Replace the sample receipt with a reusable document design

Follow the reference's paper hierarchy: merchant identity/logo, compact metadata, readable item/quantity rows, aligned amounts, separated totals, tender/change and footer. Paper and PDF use a high-contrast light layout regardless of screen theme; the preview frame follows the app theme. Design print margins/content width for 80mm paper, test actual printable width on the target printer, and keep app controls out of output.

- Show configured merchant/branch identity and fiscal fields, issued number, original order/check identity, timestamp/timezone, cashier and fulfillment/table context.
- Wrap purchased names and modifiers without losing amount alignment. Use tabular figures and receipt-appropriate typography with a readable Arabic fallback.
- Render subtotal, original approved discounts, configured charges/tax and total from the same saved financial snapshot used by checkout. The reference's sample tax rate, coupon, currency and merchant data are not business defaults.
- Distinguish applied payment, cash received, change and remaining balance. Support mixed tenders and per-settled-check receipts without double-counting an order summary as another sale.
- Prepare clear variants for a pre-payment bill, settled receipt, partial-payment acknowledgement, copy/reprint, refund/correction and kitchen ticket. Customer financial details do not belong on kitchen tickets by default.
- Add a real barcode/QR only for a defined stable lookup identifier/destination; omit it until its workflow is defined. A decorative code is not fiscal integration.
- Keep document rendering separate from issuance, refund commands, printer I/O and PDF generation. Reprint preserves the original identity; printing failure does not repeat the sale.

Implemented in the prototype: a typed sample order summary, 80mm paper layout, and browser Print/Save-as-PDF action. The paper remains light in dark mode and print output excludes app controls. M5 still owns real per-check issuance, immutable snapshots, actual PDF generation and document contracts; physical printer/fiscal validation remains a separate acceptance gate. No sample tax rate, fiscal number, QR code or printer model is presented as configured business data.

### 5. Component ownership and destinations

| Layer                           | Reuse / add as required                                                                  | Responsibility                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/ui/src/`              | Button/Input/Textarea/Dialog/Popover; add further primitives only when a slice uses them | Accessible behavior, tokens and presentation; no commerce state.              |
| `packages/ui/src/pos-theme.css` | Light/dark tokens and resolved merchant accent pairs                                     | Scoped appearance, separate from device theme preference.                     |
| Prototype feature               | Reference-aligned cards/panel, context-picker sample and document preview                | Isolated review, no live API writes or official receipt numbering.            |
| POS Sales/Dining                | One `order-context-picker` component                                                     | Query-owned persisted context, draft form state and server-validated changes. |
| POS Receipts                    | `ReceiptDocument`, `ReceiptPreview`, document actions and print stylesheet               | Pure typed document rendering with separate query/mutation adapters.          |
| Merchants API / owner settings  | Tenant-scoped POS appearance configuration                                               | Merchant accent authorization/persistence when implemented.                   |
| Orders API / M5                 | Immutable document snapshots, number/check/payment relationships                         | Existing planned sale-document owner; no duplicated frontend totals engine.   |

Files delivered in this design slice:

```text
packages/ui/src/popover.tsx
packages/ui/src/pos-theme.css
apps/pos/src/features/prototype/components/
  order-context-picker.tsx
  sample-receipt-document.tsx
apps/pos/src/features/prototype/prototype.css
```

Future production destinations, created with their integration slices:

```text
apps/pos/src/features/sales/components/
  order-context-picker.tsx
apps/pos/src/features/receipts/
  components/receipt-document.tsx
  components/receipt-preview.tsx
  receipt.print.css
  receipts.queries.ts
  receipts.mutations.ts
```

Graduate business-free presentation into one reusable app component with sample/live adapters rather than maintaining divergent prototype/production copies. A new workspace package needs actual cross-app reuse.

### 6. Delivered preview and remaining review gates

1. The prototype now uses orange-default shared POS tokens and a local merchant-accent preview across light/dark themes.
2. The one order-context control now supports desktop popover and narrow sheet interactions for dining, pickup and delivery.
3. The sample receipt now has a separate typed document view and paper-only 80mm print/Save-as-PDF presentation.
4. Five Chrome journeys cover light/dark, Arabic/English, desktop/tablet/phone, split tender, payment recovery, kitchen, receipt and print emulation. The latest employee-queue regression attempt failed at an ambiguous Merchant Dashboard test locator; see Progress.
5. Complete cashier/operator task trials and record observations before implementing the operational sales flows. No reference-alignment task alone completes M2–M9 or establishes API, printer or fiscal readiness.
6. Keep future routes/contracts backward-compatible during staged migration; record schema rollout, data preservation, feature enablement and recovery for each persistence slice.
