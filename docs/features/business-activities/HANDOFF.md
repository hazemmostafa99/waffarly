# Business activities handoff

Updated: 2026-11-25

## Goal and acceptance

Make a merchant's chosen activity shape dashboard, POS, products, and stock while
preserving the working restaurant flow. Deliver clothing first, then agree and
add the remaining retail differences in small tasks. See [the plan](README.md)
and [task list](TASKS.md).

## Current state

- Workspace: `F:\Projects\waffarly`; current branch: `business-activities`.
  It was created from `main` at the user's request and renamed from the
  initial `codex/business-activities` name at their request.
- Approved scope in this chat: create the English plan, small task list,
  project workflow rules, documentation index link, and this handoff. No feature
  code implementation was approved or started.
- Today, the activity keys are `restaurant`, `clothing`, `supermarket`, and
  `other`. Super Admin stores the choice; the runtime changes only a few paths.
  The restaurant flow is the baseline to keep working.
- The project has a manual-QA/no-automated-checks preference. Report checks that
  actually run; do not label untested behavior as verified.

## Documentation delivered

- `README.md`: goal, current state, flow, examples, guardrails, and risks.
- `TASKS.md`: ordered, small delivery tasks and their completion conditions.
- Root `AGENTS.md`: feature coding and handoff rules.
- `docs/README.md`: entry link for future work.
- `RESTAURANT_BASELINE.md`: Task 01 checklist and user-accepted restaurant
  baseline; individual steps were not independently run by the agent.

## Task 02 implementation

User approved the limited shared-settings task. `packages/contracts/src/activities.ts`
now defines `BUSINESS_ACTIVITY_SETTINGS` for every current key. Restaurants
initially select recipe stock and have kitchen and tables; the other keys
initially select direct stock and have no kitchen or tables.
`packages/contracts/src/index.ts` exports it. These are
target settings only; no dashboard, POS, API, or database behavior reads them
yet. `TASKS.md` records the completed definition.
`defaultInventoryMode` is only the new-product starting choice. The user
clarified that restaurant products may use either `RECIPE` or `DIRECT`, and the
current product builder offers both; the shared settings must not restrict it.
The local TypeScript compiler completed `packages/contracts/tsconfig.json`
with `--noEmit` successfully; `git diff --check` passed. No app flow or
automated test suite was run for this constants-only task.

## Task 03 implementation

User approved passing the chosen activity to both merchant apps. The owner
profile already contained `activity`; API POS sessions now include the merchant
activity. `resolveBusinessActivitySettings` returns the selected settings and
uses the `other` settings for a missing or unknown key. Dashboard and POS
layouts place the resolved settings in their outlet contexts for later tasks.
No navigation, sale, stock, or restaurant product-mode behavior changed.

Contracts build, API/dashboard/POS typechecks, and direct resolver assertions
for restaurant, clothing, unknown, and missing keys passed. No live app journey
or API/database suite was run for this wiring task.

## Task 04 implementation

User approved the narrow dashboard navigation task. `merchant-navigation.ts`
filters the Tables link when `hasDiningTables` is false. `MerchantNavigation`
receives the resolved activity settings, and `/pos-tables` redirects to the
dashboard for merchants without dining tables. Restaurants keep the original
link and page. Shared sales, inventory, delivery, and report links are not
classified as restaurant-only by this task.

Dashboard TypeScript check passed. Focused navigation assertions confirmed
restaurant includes Tables, clothing and supermarket omit it, and clothing
still has POS registers. The route guard was typechecked but not exercised in
a live browser; no live app journey was run.

## Task 05: clothing product setup, first slice

User approved a small Product Builder UI slice. The existing generic variant
model and save path were reused. Clothing merchants now see clothing examples
in product information and choices. A new clothing variant draft starts with
one blank choice and editable Size and Color attributes; added rows get the
same starter. Merchants must enter the choice name, attribute values, and a
valid price before applying. Restaurant examples and Small/Medium/Large starter
remain unchanged. No API or database behavior changed.

Dashboard TypeScript check and `git diff --check` passed. The edited builder
files were formatted. A live clothing merchant create/save/reopen flow was not
run, so Task 05 remains in progress until that review is recorded.

## Uncommitted retail slice found on 2026-11-25 (Tasks 06–09, partial 11–12)

A later session found a large uncommitted change on `business-activities` that
was not recorded here. It is reviewed below; it is not committed. See the
live clothing review section for what was run.

- Activity keys: `home_goods` and `electrical` added to the shared contracts
  (labels, settings: direct stock, no kitchen/tables) and Arabic labels.
  Migration `20261125120000_retail_activities` widens the merchant, application
  and business-activity key checks. Super Admin, onboarding and API validation
  read the shared key list, so they include the new keys. On 2026-11-25 the
  user decided to keep both keys as two separate activities. Their deeper
  differences (units, barcode rules, warranty details) remain Tasks 11/12.
- Product Builder: activity-specific examples for supermarket (packs) and
  home goods/electrical (models), plus matching variant starters.
- Dashboard: retail merchants see sales wording, retail quick actions, no
  fulfillment donut, and no delivery-couriers link/route (`hasKitchen` false).
  Return report shows "Returned to stock" and "In-store sale".
- POS: retail merchants land on `/catalog`; kitchen, tables and delivery
  screens are hidden and guarded by `ActivityAccess`. Retail sales are
  in-store only (API rejects other fulfillment), create no kitchen ticket,
  and complete when fully settled. Catalog search goes to the API, which also
  matches SKU, barcode and category; Enter on an exact barcode adds that
  choice.
- Returns: clothing cashiers choose per line "Sellable — return to stock"
  (restores the frozen direct-stock share through the ledger) or "Damaged —
  waste". Migration `20261125121000_clothing_return_condition` allows
  `restock`. Other activities keep waste-only returns.
- Tests were added/updated for barcode search, retail fulfillment, POS home,
  restock returns, and return-request parsing; they were not run.

Fix made in this session: the POS catalog query key changed on every
keystroke with no kept data, so a scanner's Enter usually found an empty list
and added nothing. Server search is now debounced (250 ms), the previous list
stays visible while loading, and Enter looks up the exact barcode from the API
when it is not already loaded.

Checks actually run: contracts build; `tsc --noEmit` for UI, API,
merchant-dashboard, POS, super-admin and storefront; Prettier on the edited
POS file; `git diff --check`. API unit/database suites were not run.

## Live clothing review — 2026-11-25

The user applied both migrations (`pnpm db:migrate`) and started the apps.
The agent drove Super Admin (5173), Dashboard (5174) and POS (5175) in the
built-in browser. Test logins are in the session scratchpad, not the repo.

Checked and working:

- Super Admin lists `home_goods`/`electrical` with Arabic labels. Created
  disposable merchant "Clothing QA 05ea8c" (clothing). The user approved a
  test activation; its reference says no payment was collected.
- Dashboard: sales wording, retail quick actions, no fulfillment chart; no
  Tables/Couriers links; pasted `/delivery-couriers` redirects home.
- Task 05: created "QA Cotton T-shirt" with clothing examples, one
  "M / Blue" choice (SKU, barcode 9912345670001, Size M, Color Blue), linked
  to direct stock item "QA T-shirt M Blue"; saved, reopened, all values kept.
- Stock: opening balance 5 + purchase 1 at 80 EGP = 6 pieces.
- POS: lands on `/catalog`; menu has no Kitchen/Tables/Delivery; pasted
  `/kitchen` and `/dining` redirect to `/catalog`; fixed "In-store sale".
  Typing the barcode and pressing Enter opened the product with M / Blue
  preselected. Sale #1 (2 pieces, 400 EGP, test cash) completed on full
  payment; receipt shows in-store sale and Size/Color. Stock 6 → 4.
- Returns: 1 sellable return → stock 4 → 5, labelled "رجع للمخزون";
  1 damaged return → stock stayed 5, labelled "هالك". Approval needs a
  different employee with the supervisor role (existing rule).

Fixed during the review (typechecked, rechecked live):

- POS sales list heading "Sales" and nav "Inventory" were untranslated; the
  sale row said "تيك أواي". Added Arabic labels to `packages/ui` (rebuilt its
  `dist`) and show "بيع داخل المحل" for retail rows and the details dialog.
- Dashboard quick actions "Inventory / Item returns / Business reports" were
  untranslated; now Arabic via the shared locale.
- The live `/pos-item-returns` page uses `ReferenceRecordReports.tsx`, not the
  edited `ItemReturnReportsPage.tsx` (not routed). Its details did not show
  restock vs waste and claimed food ingredients are not restored. Details now
  show each line's condition and a correct note when stock was restored.

Open findings (not fixed):

- Restaurant wording still shown to clothing merchants: variant composer and
  review ("size or type", "Apply sizes and prices"), add-ons example "extra
  cheese, sauce", stock item placeholder "burger meat", POS picker "اختر
  الحجم", warehouse note about recipe consumption, "Kitchen" employee role.
- A clothing return that is all waste still shows the food-ingredient note.
- Existing behavior, not from this branch: POS sale fails with a generic
  error when a stock item has no cost (API says to record a cost; opening
  balance does not set one); POS login needs the full stored business code
  (`<slug>-<merchant id>`) while Super Admin displays only the short slug;
  "Refund" and "Approved by" appear in English in the POS.
- `prisma migrate dev` asked for a new migration name after applying the two
  migrations, so Prisma sees schema drift; not investigated.
- Restaurant recheck (Task 10) was not run in this review.

## Activity wording — slice 1 (2026-11-25)

User decision: each supported activity gets its own natural wording;
`other` (and any activity without its own entry) uses neutral wording. The
user reviews the Arabic wording drafts.

- `packages/contracts/src/activity-wording.ts` holds
  `BUSINESS_ACTIVITY_WORDING` (restaurant, clothing, supermarket, home_goods,
  electrical, other), `resolveActivityWording` (unknown/missing → `other`)
  and `activityChoicePhrases`, which builds short phrases such as "Duplicate
  size" from each activity's nouns. Restaurant entries reproduce the previous
  text.
- Product Builder reads it: `ProductBuilderPage` resolves it once and passes
  `wording` to the information, choices, variant editor, add-on editor,
  customer preview, review, side preview and stock step. The earlier
  `clothing` / `modelVariants` / `packVariants` conditions were removed.
- Not yet covered: recipe/ingredient wording (only shown in recipe mode),
  add-on "by size" texts in `ModifierDetailsEditor`,
  `ChoiceConfigurationOverview`, `CopyInventoryDialog`,
  `InventoryConsumptionPreview`, `ProductCostPreviewPanel`, the inventory
  pages (`CreateStockItemDialog` still says "burger patty"), the POS, and
  hiding kitchen-only features such as the Kitchen employee role.

Checks run: contracts build; `tsc --noEmit` for dashboard, POS and API; a
script compared 21 restaurant phrases with the previous text (0
differences) and confirmed unknown/missing activity → neutral wording. Live
check on the clothing merchant: new product and the size editor show
clothing wording, with no "حجم/أحجام" left in the editor. Restaurant screens
were not opened live (no restaurant login in this session).

User approved the slice 1 Arabic drafts on 2026-11-25.

## Activity wording — slice 2: inventory (2026-11-25)

- The wording file's `stock` section now also has `itemsTitle` (sidebar and
  breadcrumb name of `/inventory/items`) and `textOverrides`: replacements for
  `inventory-copy.ts` sentences that mention recipes, ingredients or the menu,
  keyed by the English sentence. Restaurant has no overrides and keeps
  "الأصناف والخامات". Shops share one set (`shopStock`) plus their own stock
  item example, which also replaces "e.g. Milk or flour".
- Dashboard: `useInventoryText()` (in `inventory-copy.ts`) replaces the local
  `inventoryCopy(value, locale, t)` helpers on inventory, purchasing and
  profitability pages; outside the merchant layout it applies no overrides.
  `activityLinkLabel` renames the items link in `MerchantNavigation` and in
  `getMerchantBreadcrumbs`. `CreateStockItemDialog` uses the activity example.
- `MerchantLayout.tsx` also has Prettier-only reformatting from this slice;
  restoring it was blocked by a permission check.

Checks run: contracts build; dashboard `tsc --noEmit`; a script confirmed
restaurant has 0 overrides and its title is unchanged, and every override key
exists in `inventory-copy.ts`. Live on the clothing merchant: sidebar and
breadcrumb show "أصناف المخزون"; items page note has no recipes; both
new-item forms show "مثال: تيشيرت أزرق مقاس M"; branches note reads
"يُستخدم المخزن الافتراضي لخصم المخزون عند البيع". Profitability "Menu section"
override was not seen live (no sales data in that view).

## Activity wording — slice 3: POS (2026-11-25)

- `activityPosTextOverrides(activity)` in the wording file returns POS text
  replacements keyed by the English POS key. Activities with a kitchen
  (`hasKitchen`) get none, so restaurant POS text is unchanged. Shops get
  "sale" wording instead of "order" (50 keys: menu, sale screen, switcher,
  confirm/cancel, history, payment) and the product picker uses the
  activity's choice name ("اختر المقاس واللون", "اختر العبوة", "اختر الموديل",
  "اختر النوع").
- POS: `apps/pos/src/lib/use-pos-text.ts` (`usePosText`, same signature as
  `t`; no employee in context → plain `t`) is used by the catalog screen,
  confirmed-order panel, order switcher, checkout dialog and order context,
  refund dialog, receipt view and sales history. The workspace menu applies
  the same overrides directly from the employee session.
- Added Arabic for "Refund" (استرداد) and "Approved by" (اعتمده) in
  `packages/ui` (rebuilt `dist`); this also applies to restaurants.

Checks run: contracts and UI builds; POS `tsc --noEmit`; script: restaurant
0 overrides, clothing 50, and every override key exists in `ar.ts`. Live on
the clothing cashier: menu "المبيعات", sale screen "البيع الحالي / تأكيد البيع /
بدء بيع جديد / كل المبيعات", no "طلب" left on the sale screen, picker
"اختر المقاس واللون", history "المبيعات المعروضة / حالة البيع / تفاصيل البيع".
Not changed: rare error-recovery messages; the history status filter still
lists kitchen statuses (next slice: hide kitchen-only features).

## Activity feature settings in the backend (2026-11-25)

User decision: each activity's features are real backend settings, managed
from the Super Admin activities page, with fixed rules for what an activity
can have at all. Kitchen and dining tables are restaurant-only; delivery is
available to every activity and on by default (shops sell by phone/POS
delivery; storefront orders will also land in the POS later).

- Contracts (`activities.ts`): `ACTIVITY_FEATURES` (kitchen, diningTables,
  delivery), `ACTIVITY_FEATURE_AVAILABILITY`, `resolveActivityFeatures`
  (saved switches limited to availability; nothing saved → all available
  on), `actorActivityFeatures`. `BusinessActivitySettings` keeps only
  `defaultInventoryMode`; `hasKitchen`/`hasDiningTables` were removed.
  `OwnerProfile` and `PosEmployeeSession` carry `activityFeatures`.
- Database: migration `20261125130000_activity_feature_settings` adds
  `kitchenEnabled`, `diningTablesEnabled`, `deliveryEnabled` to
  `business_activities`, keeps restaurant rows on, and adds a CHECK that only
  `restaurant` may enable kitchen or tables.
- API: `admin/activities` returns `features` + `availableFeatures` and
  accepts `features` (unavailable feature → 400). `AuthService` loads the
  saved switches on every owner/POS request. `ActivityFeatureGuard` +
  `@RequireActivityFeature` (auth module) protect POS kitchen, POS dining
  (two controllers), POS deliveries, POS couriers, owner tables and owner
  couriers (403). POS sale: `requireFulfillmentFeature` (dine-in needs
  tables, delivery needs delivery); without a kitchen there is no ticket and a
  delivery sale is created `ready` (accepted/ready now) for courier dispatch.
  Employees: Kitchen role refused (400) when kitchen is off.
- Super Admin: activities editor has a switch per feature (unavailable ones
  disabled with "غير متاحة لهذا النشاط"); table has a Features column.
- Dashboard/POS read `activityFeatures` from the session: sidebar and route
  guards (couriers follow delivery, tables follow diningTables), Kitchen role
  hidden, POS menu (Tables / Delivery follow-up / Kitchen), sale types
  (shops: In-store + Delivery with the customer form), kitchen statuses
  hidden from the history filter, POS wording keyed on the kitchen switch.

Checks run: contracts, database (Prisma generate) and UI builds;
`tsc --noEmit` for API (with tests), storefront, dashboard, POS and Super
Admin; unit tests added (`test/unit/activity-features.test.ts`, updated
`pos-orders.test.ts`) but not run. Migration applied with
`prisma migrate deploy` after the user closed a stuck `migrate dev` prompt.
Live (clothing): Super Admin table and editor correct; direct PATCH enabling
kitchen → 400; cashier session features correct; POS tables and kitchen
endpoints → 403, deliveries → 200; owner tables → 403, couriers → 200;
Kitchen-role employee → 400; switching delivery off in Super Admin
immediately removed the POS menu item and made deliveries return 403;
switching it back on showed In-store/Delivery buttons; a POS delivery sale
(#2) appeared under "جاهز للتوصيل" without any kitchen step; dashboard shows
couriers, hides tables, `/pos-tables` redirects home, Kitchen role hidden.
Not checked live: restaurant screens (no restaurant login), courier dispatch
and cash-on-delivery settlement for the shop sale (no courier configured).
Open: the delivery follow-up screen still says "طلب #"; owner-side storefront
order inbox is not activity-gated (by decision); Prettier reformatted a few
unrelated lines in touched files.

Marketplace check (localhost:3000, local reference data): sections shown
are موبايلات، إلكترونيات، موضة، المنزل، مطاعم، سوبر ماركت، الجمال. These do not
match the system activity keys one to one: mobiles and beauty have no
activity, fashion ≈ clothing, home ≈ home_goods, electronics vs electrical
needs a decision.

## Checks and limits

On 2026-11-25, `main` was merged into `business-activities` as `02038d5a`
with no conflicts. The new `main` commit renamed Waffarly display text to
Wfarly across the apps; it did not add another business-activity task or
change the database schema. Both the new display text and activity-aware
dashboard/Product Builder code remain present after the merge. TypeScript
checks passed for merchant-dashboard, POS, storefront, super-admin, and UI.
The merge was not pushed. Work continues on `business-activities`.

The original documentation links and `git diff --check` passed. Task 01 source
review confirmed restaurant recipe defaults and settings routing. The user's
running restaurant flow was accepted by the user as working. The agent's port
checks were from a separate command session and do not establish the state of
the user's running apps. Browser inspection was unavailable because Computer
Use could not determine the current URL safely. Corepack could not reach the
registry for pinned pnpm, and Docker engine access was denied in the command
session. See `RESTAURANT_BASELINE.md` for exact results. Example
behavior for future activities is proposed, not implemented or verified. The
exact scope of supermarket and home goods/electrical activities still needs a
decision before their tasks.

## Next action

The clothing live review above passed after its fixes. Activity wording
slice 1 (Product Builder) is done and waits for the user's review of the
Arabic drafts (approved). Slices 2 (inventory) and 3 (POS) are done, and
activity features are now backend settings managed in Super Admin. Next
candidates: shop courier dispatch/settlement live check, storefront orders
for shops landing in the POS, recipe-mode text for shops, and a restaurant
recheck (Task 10). Restaurant recheck (Task 10) is on hold at the user's
request. Commit only with the user's approval.

Tasks 01–04 are recorded above. Task 05 has one completed UI slice but still
needs a live clothing create/save/reopen review. Next, inspect that flow with a
disposable clothing merchant before closing Task 05 or planning Task 06 stock
work. Verify branch and working tree before further changes, and plan any new
code slice for approval.

On 2026-11-25, the agent tried to open the documented Dashboard URL
`http://localhost:5174/login` in a browser; it returned
`ERR_CONNECTION_REFUSED`. Docker's local engine was also unavailable in this
session. No clothing merchant or product was created. Source review confirmed
that the current builder sends each variant's name, price, and Size/Color
attributes in the product save request, then maps saved attributes back into
the edit form. This checks the code path, not the live save/reopen result.
Resume the manual review when a reachable Dashboard and disposable clothing
merchant are available; leave Task 05 open until then.
