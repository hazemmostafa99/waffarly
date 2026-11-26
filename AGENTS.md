## Branch workflow — 2026-11-19

- Perform implementation work on `main` only. Check the active branch and working
  tree before editing; do not start implementation on `production-demo`.
- `production-demo` is reserved for explicitly requested deployment work. Do not
  switch to it, merge deployment changes, push, or deploy without authorization
  for that operation. Do not create a feature branch unless the user requests one.
- Preserve unrelated local changes when switching branches. If they prevent a
  safe switch to `main`, explain the conflict before taking further action.

## Restaurant ordering authorization — 2026-11-13

The user explicitly authorized real API-backed ordering for all persisted
Marketplace restaurants, including the twelve imported reference restaurants.
Reference/local-mock metadata describes data provenance; it must not switch
API-backed restaurant checkout to local simulation. Preserve subscription,
operating-hour, fulfillment, pricing, stock and idempotency enforcement.
Do not fabricate payment or collection. Local non-restaurant demonstrations
remain separate. The existing manual-QA/no-automated-checks preference remains.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Marketplace: UI-first, local data only

The user explicitly requires completing the entire Marketplace UI and user flows
with the existing local data before any backend integration. For Marketplace work:

- Use `apps/storefront/src/features/marketplace/data/reference.json` and clearly
  identified local mock scenarios. Do not connect to existing or new backend APIs,
  require API/database services, or change API/database/shared transport contracts.
- Build the full navigation, browse/details, cart, checkout, confirmation, tracking
  and account flows locally. Missing backend endpoints are not blockers for UI work.
- Checkout, authentication, payments, order statuses and notifications must be
  clearly local demonstrations, never represented as real server-side actions.
  Do not collect real payment credentials or persist customer PII/passwords.
- Keep presentation, local behavior and mock data separable so integration can
  replace the data source later. Do not invent production contracts or create a
  local HTTP/Next route-handler backend just to simulate a server.
- Backend integration is a separate phase only after UI-flow completion and an
  explicit user instruction to begin it. Do not start it automatically.
- This policy applies to the Marketplace; preserve existing tenant-storefront,
  business application, admin and POS behavior. Existing external reference image
  URLs are allowed; they do not authorize backend data requests.

See [the Marketplace roadmap](docs/features/marketplace/marketplace-roadmap.md) for phase order and
completion criteria.

## API feature work (when separately authorized)

Before planning or implementing a feature that changes the API, database, or shared
API contracts, read [apps/api/AGENTS.md](apps/api/AGENTS.md). It defines feature
ownership, dependency boundaries, tenant safety, and the implementation checklist.

## Business activities delivery workflow — 2026-11-24

For work that makes merchant dashboard, POS, catalog, or inventory behavior depend
on business activity, start with
[the business activities plan](docs/features/business-activities/README.md),
[small tasks](docs/features/business-activities/TASKS.md), and
[handoff](docs/features/business-activities/HANDOFF.md).

- Complete one small, reviewable task at a time. Avoid broad rewrites and large
  changes that mix unrelated behavior. Keep restaurant behavior working while
  adding each new activity.
- Prefer existing patterns and plain, named functions over speculative layers,
  generic frameworks, or duplicated screens. Make the activity decision easy to
  find and trace from Super Admin to the affected app behavior.
- Give a new function a clear name. Add a short purpose comment when its goal or
  reason for existing is not clear from the name and code. Explain non-obvious
  conversions and rules. Do not add comments that only restate the code.
- Use regular expressions only when they make the rule clearer than ordinary
  string operations. For each non-obvious expression, explain what it matches,
  what it produces, and show a simple input-to-output example.
- Review the affected restaurant flow and the new activity flow for each task.
  Record what was actually checked and update the handoff before stopping.
