# API organization progress

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
