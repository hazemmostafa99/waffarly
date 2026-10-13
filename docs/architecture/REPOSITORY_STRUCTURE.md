# Repository structure

The repository is a pnpm workspace coordinated by Turborepo. Each app owns its presentation and runtime configuration; the NestJS API owns future business behavior and is the only application that connects to PostgreSQL.

```text
apps/
  api/                 NestJS HTTP API and infrastructure health endpoints
  storefront/          Next.js App Router public shell
  super-admin/         React + Vite platform shell
  merchant-dashboard/  React + Vite merchant shell
  pos/                 Minimal React + Vite POS workspace shell
packages/
  database/            Prisma schema, generated client, migrations, adapter
  contracts/           Future API contracts; intentionally has no business DTOs
  ui/                  Small shared React component package
  eslint-config/       Shared flat ESLint rules
  typescript-config/   Shared strict TypeScript configurations
infrastructure/docker/ Local PostgreSQL Compose service
docs/                  Setup instructions and architectural decisions
scripts/               Reserved for cross-workspace automation when needed
```

## Boundaries

- Frontends call the API through HTTP clients; they do not import the database package.
- `packages/database` is used by the backend only. Prisma and its generated client do not belong in browser bundles.
- `packages/contracts` is runtime-independent and must not depend on NestJS, Prisma, or app implementations.
- App-specific modules should be added under `apps/api/src/modules/<approved-domain>/`. Put HTTP controllers, providers, and module wiring there; use `infrastructure/` only for technical adapters shared by modules.
- Add a workspace package only when there is a real shared responsibility. Register it under `packages/*`, declare dependencies explicitly, and add its scripts and build relationships to Turborepo as needed.
- `apps/pos` has no deployment assumption. Its independent deployment or inclusion in the merchant dashboard remains open.
