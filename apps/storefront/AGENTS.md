## Restaurant ordering authorization — 2026-11-13

The user explicitly authorized real API-backed ordering for all persisted
Marketplace restaurants, including the twelve imported reference restaurants.
Reference/local-mock metadata describes data provenance; it must not switch
API-backed restaurant checkout to local simulation. Preserve subscription,
operating-hour, fulfillment, pricing, stock and idempotency enforcement.
Do not fabricate payment or collection. Local non-restaurant demonstrations
remain separate. The existing manual-QA/no-automated-checks preference remains.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Marketplace implementation mode

### Component and styling conventions

- Group related work under `features/marketplace/<feature>/components`, `hooks`,
  and `model` as needed; do not put hooks in component folders or create empty layers.
- Keep Zustand state/actions with their owning feature in `features/marketplace/<feature>/state`.
  Compose feature slices and shared store types in `features/marketplace/state`; keep the
  provider in `features/marketplace/providers`. Cross-feature workflows belong to the
  coordinating feature (for example, checkout atomically updates cart and orders).
  Shared money formatting belongs in `features/marketplace/shared/lib`. Keep data separate.
- Style Marketplace components with Tailwind utilities in TSX. The only Marketplace
  stylesheet is `styles/marketplace-tokens.css`, for scoped colors/shadcn token
  aliases and base rules. Do not reintroduce component selectors or an @apply-based
  duplicate stylesheet. Keep exact arbitrary values when needed for the reference.
- Reuse the project primitives from `@waffarly/ui` through thin Marketplace wrappers
  for Button, Input, Textarea, Card and Dialog. Do not duplicate their DOM/focus logic.
  Native select/radio controls may remain when no shared equivalent exists.
- Existing semantic classes are retained as state/DOM hooks; their styling is in
  Tailwind classes, not a stylesheet. Do not change interactions during style refactors.
- The user currently wants manual QA. Do not run tests, browser suites, typechecks
  or builds unless asked; report that this work remains manually unverified.

Display all Marketplace prices using Western digits `0-9`, including product prices,
line totals and cart totals. Use the shared `money` formatter; keep Arabic currency
labels and RTL layout. Do not use Arabic-Indic digits for prices.

Complete all Marketplace UI and user journeys with existing local reference data
and clearly labeled local mock scenarios first. No backend/API/database dependency
or integration is allowed in this phase, including existing storefront APIs or a
new Next.js route-handler/mock server. Keep code organized by related feature and
separate data/local behavior from presentation. Mock checkout, account, payment,
confirmation and tracking screens must be visibly identifiable as demonstrations;
do not imply real orders, sessions or charges. Do not persist sensitive form data.

Backend integration starts only after the UI flows are complete and the user
explicitly asks to start that phase. Preserve other existing app surfaces. Follow
the root Marketplace policy and [roadmap](../../docs/marketplace-roadmap.md).
