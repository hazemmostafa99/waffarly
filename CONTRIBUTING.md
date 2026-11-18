# Working on Waffarly

Start here when running the project or making an API change. This guide describes
the current workflow; older feature delivery notes also contain historical states.

## Set up once

Use Node **24.11.1** and pnpm **10.34.5**, as pinned in `.node-version` and
`package.json`. Install dependencies with `pnpm install`. Copy any missing local
environment files from their examples; preserve existing local values.

Follow [local setup](docs/setup/LOCAL_DEVELOPMENT.md) for the application database,
frontend environments and ports. From the root, prepare the shared packages:

```powershell
pnpm --filter @waffarly/contracts build
pnpm --filter @waffarly/database build
pnpm --filter @waffarly/ui build
```

Apply application migrations deliberately with the normal development database
commands in that guide. Database tests have a separate setup described below.

## Daily commands

```powershell
pnpm dev
# Or run the API alone after building its shared dependencies:
pnpm --filter @waffarly/api dev

# Formatting, typecheck, lint, HTTP/unit tests, then build; stops on failure:
pnpm check:api

# Database tests are an explicit separate command:
pnpm test:db
```

`check:api` does not connect to PostgreSQL for the database suite or apply
migrations. Its HTTP tests use test providers. It includes the module dependency
cycle test and the existing lint boundary rules.

If the package-manager shim cannot start in an offline environment with dependencies
already installed, these equivalent local entry points work from the root:

```powershell
node --import tsx apps/api/test/support/check-api.ts
node --import tsx apps/api/test/support/database-runner.ts all
```

## Find the code

- [Module map](docs/architecture/API_MODULE_GUIDE.md): the owner of each responsibility.
- [Complete operation traces](docs/architecture/API_WORKFLOWS.md): entry point,
  operation, rules and transaction for sales, collection and website orders.
- [Test map and database workflow](docs/testing/API_TESTING.md): the checks to run
  for a change, shared fixtures and isolated database setup.
- [API rules](apps/api/AGENTS.md): implementation, tenant and dependency boundaries.
- [Current verification ledger](docs/architecture/API_REFACTOR_PROGRESS.md): what
  was exercised, rather than assumed from file organization.

## Make an API change

1. Find the feature contract and the module that owns the operation.
2. Trace its controller, application entry point and responsible operation file.
3. Keep authenticated tenant/branch scope, authorization, request identity and
   transaction ownership explicit. Preserve existing routes for structural work.
4. Name new functions for the business action. Give extracted files a short
   plain-English purpose comment; comment significant business steps and reasons.
5. Reuse an existing application service or rule before introducing another
   abstraction. Keep small features flat and independent operations easy to find.
6. Run `pnpm check:api`, then the affected database suite when persistence,
   transactions or authorization predicates are involved. Use the test map.
7. Update the relevant module/feature guide and report the checks actually run.

## Diagnose a failure

Check the failing step first. Type errors point to inputs/outputs and imports;
lint errors can identify private cross-module imports or controller/database
coupling. Database test setup errors identify missing or unsafe test configuration
before opening a connection. Never weaken an invariant just to satisfy an outdated
fixture: supply its required subscription, branch, shift and permissions explicitly.

For a running API, inspect `/health` and `/health/db`, then the method, path, status,
timestamp and `errorCode` in the response and structured access/exception logs.
`DATABASE_UNAVAILABLE` points to connectivity; `ORDER_SHIFT_REQUIRED` means an
open receiving-branch shift is required. A 409 may also mean a stale reviewed
price/revision or a conflicting retry ID. [Database connection troubleshooting](docs/setup/DATABASE_CONNECTIONS.md)
describes startup and readiness behavior. Health routes are available after the
API has successfully started listening.

An operation's `requestId` identifies an exact retry command, not a general HTTP
trace ID. Keep it when investigating an uncertain result. Do not automatically
repeat a financial write or include passwords, cookies, contact details or full
database connection strings in bug reports and log excerpts.
