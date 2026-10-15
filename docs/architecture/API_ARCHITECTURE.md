# API architecture

The API is a NestJS modular monolith. Organize behavior by business feature;
admin, owner, and public controllers belong to the feature they expose. Feature
implementation instructions live in [apps/api/AGENTS.md](../../apps/api/AGENTS.md).

## Ownership

| Module     | Responsibility                                                                                             | Application dependencies |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| auth       | Credentials, sessions, guards, authenticated request actors                                                | Configuration, database  |
| merchants  | Merchant profiles, applications, first-month activation                                                    | Auth                     |
| plans      | Platform monthly plan definitions                                                                          | Auth                     |
| activities | Business activity and capability definitions/metadata                                                      | Auth                     |
| storefront | Owner design settings, templates, public storefront composition                                            | Auth, catalog            |
| catalog    | Products, categories, reusable modifiers, authoritative pricing, and product inventory configurations      | Auth, inventory          |
| inventory  | Merchant-owned Stock Items/units, branches/warehouses, policy, balances, and transactional movement ledger | Auth                     |
| purchasing | Merchant-owned supplier directory and draft/confirmed purchase invoices                                    | Auth, inventory          |
| orders     | Order submission, snapshots, stock reservation/release, owner actions                                      | Auth, catalog pricing    |
| media      | Tenant-owned image metadata and upload orchestration                                                       | Auth, storage adapter    |
| reports    | Product configuration reports from order snapshots                                                         | Auth                     |
| health     | Liveness and database readiness                                                                            | Database                 |

Modules import other modules through their `index.ts` entry points. Each Nest
module exports only deliberately shared providers. `AppModule` composes features;
configuration and database modules provide the shared technical dependencies.
Import rules are enforced by the API ESLint configuration.

## Inside a feature

Simple features stay flat. Catalog separates products, categories, modifiers, and
pricing. Product configuration rules, transaction persistence helpers, HTTP
schemas, and response mapping have separate files. Keep transaction helpers on
the caller's transaction client; preserve revision and tenant constraints.

`common/` owns shared HTTP validation, logging, and exact money arithmetic.
`infrastructure/` owns Prisma and storage adapters. Shared technical code must not
depend on feature modules. The database package owns schema/client/migrations;
contracts own framework-independent HTTP types. Neither contains API use cases.

## Compatibility and verification

Structural changes preserve existing routes (including `/auth/owner/storefront`),
cookie/session behavior, validation error formats, decimal-string money values,
revision conflicts, and order snapshots. Routes do not need to mirror disk paths.
No database migration is needed for module reorganization.

Tests live under `apps/api/test/http`, `test/unit`, and `test/database`.
HTTP tests mostly replace persistence or application providers; they do not prove
PostgreSQL concurrency behavior. Dedicated database suites exercise real queries,
tenant references, and transaction behavior against a migrated database.

## Growth work separate from structural refactoring

- Existing list endpoints need a compatible pagination contract; the public
  catalog currently returns the full visible catalog.
- Configuration reports currently aggregate loaded order snapshots in memory;
  use bounded queries/database aggregation when their data volume requires it.
- Local image storage is the initial adapter. Shared/object storage and delivery
  configuration are needed before running API replicas on separate filesystems.
- Profile query plans and indexes with representative data before adding caches,
  queues, or independent services. Modular code alone does not establish capacity.

Track completed structural changes and remaining work in
[API_REFACTOR_PROGRESS.md](API_REFACTOR_PROGRESS.md).
