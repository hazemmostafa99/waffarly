# API testing

Browser configurations live in `tests/playwright/`; the root `playwright.config.ts`
remains the default entry point. For example, use
`pnpm exec playwright test --config tests/playwright/merchant.config.ts`.
Write local verification logs and scratch reports under the ignored `artifacts/`
directory. Product overview/scope documents live in `docs/product/`.

## Normal checks

From the repository root, run `pnpm check:api`. This runs formatting checks,
typecheck, ESLint, all HTTP/unit tests and the API build, stopping on the first
failure. Build the shared workspace dependencies first on a fresh checkout; see
[CONTRIBUTING.md](../../CONTRIBUTING.md).

HTTP tests use controlled application/persistence providers and local loopback
HTTP connections. They do not establish real PostgreSQL concurrency behavior.
The unit suite also checks database-target safety, tenant-scoped fixture cleanup
and circular static runtime imports between API modules. ESLint continues to
enforce allowed module dependencies, public entry points and controller boundaries.

## Dedicated database setup

Database tests require `TEST_DATABASE_URL` from the process environment or root
`.env.test`. They never fall back to the application's `DATABASE_URL`. The shared
guard rejects a missing/malformed URL, a database name without a `test`, `tests`,
`ci` or `e2e` segment, connection-query target overrides, and the same host/port/
database as `DATABASE_URL` even when the username or schema differs. Environment
values take precedence over files. Credentials are not printed by the guard.

The provided local PostgreSQL service uses its own container, port 5434 and named
volume. It does not use the application's PostgreSQL volume.

```powershell
# Once, if you do not already have .env.test:
Copy-Item .env.test.example .env.test

docker compose -p waffarly-test -f infrastructure/docker/compose.test.yaml up -d --wait
pnpm test:db:prepare
pnpm test:db
```

`test:db:prepare` validates the target and runs Prisma `migrate deploy` against
that test database in a child process. It applies pending existing migrations;
it does not reset a database or change the application's `DATABASE_URL`.
The older `POS_NUMBER_TEST_DATABASE_URL` convention is replaced by the same
guarded `TEST_DATABASE_URL` used by all database suites.

For an already provisioned local or CI test database, set `TEST_DATABASE_URL`
explicitly, apply migrations with `test:db:prepare`, and run the needed suite.
Use a role dedicated to that database. The URL comparison protects against common
configuration mistakes; it does not replace database access permissions.

The API package aliases below all use the same runner. `pnpm test:db` discovers
every `test/database/*.database.test.ts` file. Named suites are defined in
`apps/api/test/support/database-test-suites.ts`; unknown suite names and missing
configured files fail. Tests run serially without forced process exit, so teardown
must release connections rather than hiding leaked handles.

```powershell
pnpm --filter @waffarly/api test:inventory-db
pnpm --filter @waffarly/api test:storefront-orders-db
# Select any named suite through the common runner:
pnpm --filter @waffarly/api test:db subscriptions
```

Offline equivalent from the root when dependencies are already installed:

```powershell
node --import tsx apps/api/test/support/database-runner.ts --prepare
node --import tsx apps/api/test/support/database-runner.ts inventory
```

Stop the test service while keeping its data with:

```powershell
docker compose -p waffarly-test -f infrastructure/docker/compose.test.yaml down
```

## What to run for a change

Always run the normal checks. Then choose the relevant database command:

| Changed behavior                                    | Representative coverage                                                      | API database command        |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- |
| Product configuration/pricing                       | Product snapshots, variants, modifier effects, tenant references             | `test:catalog-db`           |
| Stock identities, ledger, warehouses and thresholds | Units, exact balances, movement replay, stock health                         | `test:inventory-db`         |
| Purchasing                                          | Drafts, tenant references, concurrent receipt confirmation                   | `test:purchasing-db`        |
| Website orders and recipes                          | Snapshot/stock atomicity, recipe acceptance/cancellation, branch rules       | `test:storefront-orders-db` |
| Dining, checks, payment settlement                  | Table sessions, allocation totals, tenders and saved receipts                | `test:pos-db`               |
| Shift lifecycle and delivery cash                   | Opening races, close reconciliation, COD cash, custody and retries           | `test:shifts-db`            |
| Returns                                             | Quantity caps, saved waste records and bounded owner reports                 | `test:pos-returns-db`       |
| Staff roles and sessions                            | Branch assignment, current grants and session revocation                     | `test:employees-db`         |
| Subscriptions and merchant onboarding               | Coverage, priced actions, duplicate collection prevention, atomic assignment | `test:subscriptions-db`     |
| Customer ownership/contact records                  | Tenant associations and customer history                                     | `test:customers-db`         |
| Customer authentication                             | Identity/session persistence                                                 | `test:customer-auth-db`     |

For broad changes, use `test:db` to include the remaining database files as well.
Relevant HTTP/unit files live under `apps/api/test/http` and `test/unit` with
feature names such as `storefront-orders`, `order-lifecycle`, `pos-kitchen`,
`employee-roles`, `subscriptions`, `discount-schemas` and `database-http-errors`.
Behavioral assertions take priority over tests that merely mirror file paths.

## Shared test setup and cleanup

Use `createTestDatabaseClient(testContext)` from `test/support/test-database.ts`.
It checks the target before connecting and registers an after-hook to disconnect
even when an assertion or explicit fixture cleanup throws. Existing immediate
disconnects can remain; the hook provides the failure-path fallback.

Prefer rollback transactions for tests that do not need independent connections.
Concurrency tests may commit uniquely identified fixtures, then delete only their
recorded tenant IDs in `finally`. `merchantFixture` shares stable field defaults.
`enableTestLegacyAccess` explicitly provides non-billing access without inventing
a paid period; `openTestBranchShift` supplies a zero-cash shift when another
feature's test requires it. Billing and shift behavior themselves use their own
dedicated tests and real application operations.

Delete children before parent merchants. Use `deleteTestMerchantSubscriptions`
for the automatically created subscription records: it rejects missing/invalid
tenant IDs and does nothing for an empty list. It receives the current transaction
when cleanup is transactional and never opens an independent one. Other feature
records still need their own ordered cleanup. Do not broaden deletion predicates
or reset a database to make an assertion pass.
