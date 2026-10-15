# API architecture and feature workflow

Read this file before implementing or changing API features. Follow it together
with the repository's root `AGENTS.md`. For database and shared-contract work,
apply the relevant boundary rules here too.

## Before implementation

1. Read the feature specification under `docs/features/` and inspect existing
   routes, services, contracts, schema, and tests for the affected feature.
2. Read `docs/architecture/API_ARCHITECTURE.md` for current ownership and
   dependencies. Distinguish implemented architecture from remaining work.
3. Name the business module that owns the behavior. Extend it before creating a
   new module. Admin, owner, and public access are controller concerns, not
   separate homes for the same business rules.
4. Identify the affected HTTP contract, tenant boundary, transaction boundary,
   concurrency rules, and verification needed. Preserve existing behavior during
   structural refactors; make behavior changes explicit.
5. Inspect the working tree. Preserve unrelated changes and never read or print
   secret values from `.env` files.

## Organization and dependencies

- Keep a modular monolith in `src/modules/<business-feature>/`. Each feature owns
  its controllers, application services, business rules, mapping, and persistence.
- Use small flat modules for simple features. Add `http/`, `application/`,
  `domain/`, and `persistence/` directories only where they make responsibilities
  easier to navigate. Do not create empty layers or one folder per trivial file.
- Controllers parse HTTP input, use the authenticated actor, call application
  services, and return explicit contracts. Keep database queries and business
  decisions out of controllers.
- Application services coordinate use cases and transactions. Extract independent
  calculations and configuration rules into named functions; extract substantial
  persistence helpers when it clarifies queries and transaction ownership.
- Cross-module imports use the owning module's `index.ts` public entry point.
  Export the Nest module and only providers/types deliberately shared with other
  modules. Register shared providers with Nest `exports` and import their module.
  Do not import another module's controller, private mapper, or repository.
  Register new modules in `AppModule` and their allowed dependencies in
  `apps/api/eslint.config.mjs`; document any dependency change.
- Keep dependencies acyclic. Public storefront composition may use catalog;
  orders may use catalog pricing. Catalog must not depend on storefront or orders
  application services. Database constraints/queries needed to protect existing
  order history do not require importing the orders application module.
- `common/` contains small, genuinely shared primitives such as money arithmetic
  and HTTP validation. Business rules stay in their feature. Avoid generic CRUD
  base services, catch-all utilities, speculative interfaces, and duplicate helpers.
- `infrastructure/` contains technical adapters such as Prisma and file storage.
  Adapters must not import business modules. Introduce an abstraction where a real
  external dependency needs substituting, not around every class.
- `packages/contracts` contains transport types and framework-independent shared
  values. Never import NestJS, Prisma, or API implementations there. Preserve root
  package exports when organizing contract files.
- `packages/database` owns the Prisma schema, generated client, and migrations.
  Frontends never import it. Keep application business behavior in the API.

For a small new feature, start with this shape (only add files actually needed):

```text
src/modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.schemas.ts
  <feature>.service.ts
  index.ts
test/http/<feature>.e2e.test.ts
test/unit/<feature>.test.ts
test/database/<feature>.database.test.ts
```

Use catalog's product rules, mapping, and transaction helpers as the example when
a feature grows beyond that shape. Use storefront settings as the example of a
typed owner controller with a Zod validation pipe.

## Authentication, tenants, and persistence

- Use the existing admin/owner guards and typed actor decorators. Authenticate
  once per request; controllers must not repeat session/account queries.
- Derive `merchantId` from the authenticated actor. Public storefront operations
  resolve it from the validated storefront slug. Never trust a tenant supplied in
  an owner request body.
- Scope tenant-owned reads, writes, and references by `merchantId`. Preserve the
  schema's compound tenant relationships. Test foreign-tenant references where
  the feature introduces or changes them.
- Preserve optimistic revision checks, database uniqueness, and attributable
  writes. Translate database conflicts into the feature's existing HTTP behavior.
- Keep order creation, stock reservation/release, and immutable order snapshots
  atomic. Transaction helpers receive the active transaction client; they must
  not start independent transactions or silently use the root Prisma client.
- Use decimal strings at HTTP boundaries and integer arithmetic for money. Reuse
  `common/money/`; never calculate prices using floating-point arithmetic.
- Add migrations for schema changes; do not rewrite applied migrations or hand
  edit generated Prisma code.
- Keep filesystem/provider operations behind storage adapters. Preserve tenant
  paths, signature/size checks, and cleanup if database persistence fails.

## Validation, growth, and completion

- Keep Zod request schemas beside their HTTP feature. Reuse `ZodValidationPipe`
  or `parseRequest` and preserve the endpoint's error response shape. Domain invariants still
  apply to calls made outside HTTP controllers.
- Give new potentially large list endpoints bounded queries and an explicit
  pagination contract. Plan compatible migrations for existing unbounded APIs.
  Avoid full-table/in-memory reporting when database aggregation is appropriate.
- Add focused tests for meaningful behavior: authorization, tenant isolation,
  validation, pricing, stale updates, and transaction/concurrency invariants as
  applicable. Moving files alone does not justify tests that merely assert paths.
- Keep HTTP tests under `test/http`, unit tests under `test/unit`, database tests
  under `test/database`, and shared fixtures/helpers under `test/support`.
- Run API typecheck, lint, build, and the default test suite. Run the affected
  database tests when changing queries, persistence, or transaction behavior.
  Database suites require a reachable migrated database; report skipped or blocked
  checks accurately. Never reset a database to make tests pass.
- From the repo root use `pnpm --filter @waffarly/api <script>`; see `package.json`
  for dedicated database test scripts. Use the Node version in `.node-version`.
  Follow the root Turborepo instructions before changing Turbo commands/config.
- Update feature/architecture docs when ownership, dependencies, or contracts
  change. Explain what changed, verification, and any remaining limitations.
