# API organization progress

## Remaining large-module cleanup — 2026-11-14

- Shifts: extracted opening/closing, session reads, reconciliation, close reports,
  branch/approval checks, manual cash activity and order cash helpers. Cash custody
  now separates safe, drawer and transfer operations; owner/POS controllers have
  separate files. Existing service APIs and reconciliation exports remain.
- Subscriptions: separated access, onboarding assignment, pricing quotes,
  administrative commands, queries/history and record mapping. Overloads and
  transaction-client forwarding remain compatible.
- Inventory: separated stock item operations, branch/warehouse management,
  inventory policy, health reads and reorder thresholds. Owner policy, ledger and
  health routes now have dedicated controllers under the existing URL prefix.
- Merchants: separated onboarding, applications, public addresses and directory
  reads; Catalog: separated product create/update, modifier links, availability
  changes and reads, reusing existing persistence helpers and rules.
- Employees: moved owner staff configuration from Auth to EmployeesModule,
  registered in AppModule with Employees → Auth allowed in ESLint. Auth keeps
  sign-in/session/permission enforcement and exposes its username validator through
  its public entry point. Updated source/test callers and employee ownership docs.
- Added plain-English purpose comments, operation-step comments and module guides.
  See [API_MODULE_GUIDE.md](API_MODULE_GUIDE.md) for the complete navigation map.

No route, request/response contract or schema changes are intended. Existing
transaction bodies, locks, revision checks and replay semantics were preserved.
Database regression runs exposed stale fixture cleanup in four cash/shift suites:
merchant subscriptions now have to be removed before their test merchant. Cleanup
was corrected using the exact test tenant IDs, with no database reset or migration.

Final verification on Node 24.11.1:

- API typecheck, ESLint and TypeScript build passed.
- Default API HTTP/unit suite: 264 passed, zero failed or skipped.
- Selected PostgreSQL suite: 12 passed, zero failed or skipped, across Catalog,
  product inventory, Inventory, stock visibility, Subscriptions, Shifts,
  reconciliation, cash custody, POS dining and Employees test files.
- Formatting completed on changed source, tests and documentation.

The installed local CLI entry points were used directly (the package manager
shim attempts a network download in this environment). The selected database
command used `--test-force-exit --test-isolation=none --test-concurrency=1` and
the configured local PostgreSQL database. These are backend regression results;
they do not establish browser, physical printer, cash-count or operator acceptance.
No schema migrations, shared contracts or frontend workflows changed.

## Orders internal cleanup and reading guide — 2026-11-14

Continued the Orders refactor with explicit lifecycle action helpers, shared
transition data and authorization checks inside the existing transaction. Split
checkout item persistence, discount/receiving-branch rules and the legacy website
status command. Separated customer session/identity, scoped queries and customer
response mapping; separated delivery queries/access rules and return queries/
mapping; extracted dining table management and moved owner table controllers to
the owner HTTP folder. Existing application service methods and constructors
remain compatible with their callers.

Added a short plain-English purpose comment to every Orders TypeScript file and
comments for meaningful steps in longer writes. The module README and scoped
AGENTS.md document the layout and naming/comment conventions.

No HTTP contract, schema or external module dependency changes are intended.
Transaction ownership, statement order within extracted actions and replay/tenant/
branch/permission checks were retained. Formatting and source review only; no
automated checks, build, lint, typecheck, tests, browser or database operations ran.
The manual acceptance scenarios in the Orders guide remain pending.

## Orders responsibility split — 2026-11-14

Grouped Orders HTTP controllers by storefront, Marketplace customer access, POS
and owner entry points, and moved business files into named responsibility
folders. Split the mixed storefront controller and separated its request schemas.
Extracted cashier sale creation, kitchen amendments, pickup collection, payments,
refunds, receipt issuance/history and sale queries from PosOrdersService, which
now delegates through its existing application API. Dining check allocation lives
in billing; order queue reads live in fulfillment. Updated existing source/test
imports and added explanatory comments at transaction boundaries.

No schema, route, shared contract or external module dependency changes are
intended. Existing transaction bodies, replay checks and authorization predicates
were retained. Source formatting ran with the locally installed Prettier; no
automated checks, tests, typecheck, lint, build, database or browser verification
ran under the manual-QA instruction. Runtime acceptance is pending. See the
[Orders guide](../../apps/api/src/modules/orders/README.md) for ownership,
remaining cleanup and manual scenarios. Historical verification below describes
earlier work, not this refactor.

## Implemented

- Added `apps/api/AGENTS.md` and a root instruction linking it for API, database,
  and shared-contract work. It defines the feature implementation checklist.
- Replaced the dashboard-oriented Super Admin module with merchants, plans, and
  activities modules; templates live with storefront settings.
- Removed storefront settings from authentication. Existing HTTP routes remain.
- Extracted orders, media, and configuration reports from catalog.
- Separated product management from authoritative pricing and public catalog
  queries. Extracted product response mapping, configuration rules, reference
  checks, and transaction helpers for reusable modifiers and variant attributes.
- Orders depend on the catalog's exported pricing provider. Product writes retain
  their revision checks, order-history protection, and existing transactions.
- Added module public entry points and ESLint rules enforcing allowed feature
  dependencies, private-import restrictions, controller/database separation, and
  shared infrastructure independence.
- Guards attach typed owner/admin actors. Feature controllers reuse those actors
  instead of repeating session/account lookups.
- Centralized Zod parsing, exact money conversion, and Prisma conflict detection.
- Extracted file writes, path checks, deletion, and URL generation into a local
  media storage adapter behind the injectable `MediaStorage` provider.
- Grouped tests into HTTP, unit, and database suites; default test discovery now
  includes new HTTP/unit test files automatically.
- Added regression coverage for module wiring, storefront route compatibility,
  tenant source, one authentication lookup per request, and upload failure cleanup.

## Verification

Baseline: 51 default API tests passed before refactoring. After restructuring,
58 default tests pass using Node 24.11.1; API lint, typecheck, and build pass.

Catalog and order PostgreSQL suites were attempted but could not connect
(`ECONNREFUSED`). Docker's Linux engine is also unavailable in this environment.
These suites are not verified by the passing HTTP/unit checks. Re-run them against
the configured migrated database when it is available:

```powershell
pnpm --filter @waffarly/api test:catalog-db
pnpm --filter @waffarly/api test:storefront-orders-db
pnpm --filter @waffarly/api test:activities-db
```

No schema migrations or API response/route changes are part of this refactor.

## Separate growth work

Existing list endpoints and the public catalog need a compatible pagination
design. Reporting needs representative data/query profiling before replacing
in-memory aggregation. Multiple API hosts need shared/object media storage and
matching delivery configuration. These behavior/deployment changes are not
silently introduced by reorganizing the code.
