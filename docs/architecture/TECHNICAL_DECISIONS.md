# Technical decisions

## Product decisions preserved from the source documents

The approved product constraints remain in `PROJECT_OVERVIEW.md` and `MVP_SCOPE.md`. The first Super Admin implementation slice follows later product-owner decisions recorded in `docs/features/SUPER_ADMIN.md`. It does not implement the remaining proposed or open product requirements.

## Initial implementation choices

These are reversible setup decisions made to produce a usable monorepo; they are not new product approvals:

| Area               | Initial choice                                   | Reason                                                                                                                                                              |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace          | pnpm 10.34.5 workspaces                          | Reproducible package linking and workspace scripts.                                                                                                                 |
| Task runner        | Turborepo 2.11.7                                 | Coordinates independent app/package tasks and dependency builds.                                                                                                    |
| Node.js            | 24.11.1 (Node 24 LTS line)                       | Supported by the chosen toolchain; Node 20 is end of life.                                                                                                          |
| Dashboards and POS | React 19.3.0 + Vite 8.3.3                        | Small, independently runnable SPA shells on separate local ports. POS deployment remains undecided.                                                                 |
| Storefront         | Next.js 16.4.0 App Router                        | Uses the confirmed storefront framework.                                                                                                                            |
| API                | NestJS 12.1.3, TypeScript 5.9.3, Express adapter | Modular HTTP foundation with strict compile settings. TypeScript 5.9 is pinned because the selected TypeScript ESLint parser declares support through the 5.x line. |
| Database tooling   | Prisma CLI, client and PostgreSQL adapter 7.10.0 | Stable Prisma 7 line and its documented `prisma.config.ts` + driver-adapter approach. Prisma 8 is not selected while it is a release candidate.                     |
| Local database     | PostgreSQL 17 Alpine image, host port 5433       | Supported PostgreSQL major with a local persistent volume and health check; the container still uses port 5432.                                                     |
| Lint and format    | ESLint 10.12.0 flat config, Prettier 3.9.9       | Shared lint rules with React Refresh and Next-specific plugins.                                                                                                     |
| Local ports        | API 4000; storefront 3000; dashboards 5173–5175  | Allows all app shells to run together.                                                                                                                              |

All npm dependencies are declared with exact versions and the lockfile pins transitive versions. Framework major versions share their adapter/plugin major where required. Node 24 is chosen for new work even though the inspected machine currently has Node 20.19.0; upgrade Node before installing because Node 20 reached end of life in 2026.

## Database schema boundary

The initial Prisma schema contained only `FoundationMarker`, which remains an infrastructure-only table. The approved first Super Admin slice adds `Merchant`, `OwnerAccount`, and `AuthSession` plus an additive migration. `Merchant` is the tenant boundary for this slice. No catalog, order, or full recurring-subscription schema has been added.

Prisma 7 requires a PostgreSQL driver adapter at runtime and stores CLI datasource configuration in `prisma.config.ts`. The API creates one `PrismaService` instance through Nest dependency injection. It does not connect eagerly at startup: the health request performs the query, so API liveness remains available if PostgreSQL is down. Nest shutdown hooks call `$disconnect()`.

The first slice uses an environment-configured Super Admin username and scrypt password hash, backend sessions represented by opaque tokens stored only as hashes, and HTTP-only cookies. This is a reversible implementation choice, not approval of a final platform authentication strategy. Owner passwords are hashed with scrypt; the admin-created plaintext password is shown only immediately after creation for manual delivery. The owner cannot sign in before first-month activation. Renewal and expiry enforcement are not yet implemented.

## Decisions still open

The authorized monthly-plan slice (PS-D04) adds platform-owned `MonthlyPlan` definitions, an additive migration, shared decimal-string contracts, guarded create/list/update API routes, and a Super Admin Plans view. Prices use `DECIMAL(10,2)`; initial currencies are explicitly selected from EGP/USD/EUR. UUID creation requests protect identical initial retries, and revision checks protect concurrent edits. No price is seeded, and merchant assignment, agreed-price snapshots, recurring coverage, and general audit history remain separate work. See the [Monthly Plan specification](../features/super-admin/plans-subscriptions/MONTHLY_PLAN.md).

- Whether POS is independently deployed or part of the merchant dashboard.
- Final authentication/session strategy, administrator roles, and tenant-isolation enforcement for future operational modules.
- API hosting, application deployment topology, and production environment management.
- Additional business modules, the full ERD, and further API contracts.
- Checkout, branch routing, subscription lifecycle, restaurant kitchen handoff, and the other open questions in `MVP_SCOPE.md`.
- Realtime transport, queues, and any infrastructure beyond PostgreSQL.
