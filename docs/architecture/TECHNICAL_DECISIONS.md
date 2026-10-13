# Technical decisions

## Product decisions preserved from the source documents

The approved product constraints remain in `PROJECT_OVERVIEW.md` and `MVP_SCOPE.md`. This scaffold follows the confirmed NestJS + TypeScript, PostgreSQL + Prisma, Next.js storefront, and React dashboard directions. It does not implement proposed or open product requirements.

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

The initial Prisma schema has no business entities. `FoundationMarker` maps to `_waffarly_foundation_marker`; it is an infrastructure-only table used to validate Prisma Client generation and migrations. It carries no merchant, user, catalog, or order data. Remove or replace it only when an approved business ERD is ready and its migration implications are reviewed.

Prisma 7 requires a PostgreSQL driver adapter at runtime and stores CLI datasource configuration in `prisma.config.ts`. The API creates one `PrismaService` instance through Nest dependency injection. It does not connect eagerly at startup: the health request performs the query, so API liveness remains available if PostgreSQL is down. Nest shutdown hooks call `$disconnect()`.

## Decisions still open

- Whether POS is independently deployed or part of the merchant dashboard.
- Authentication/session strategy and tenant-isolation enforcement mechanism.
- API hosting, application deployment topology, and production environment management.
- The first approved business modules, data model, and API contracts.
- Checkout, branch routing, subscription lifecycle, restaurant kitchen handoff, and the other open questions in `MVP_SCOPE.md`.
- Realtime transport, queues, and any infrastructure beyond PostgreSQL.
