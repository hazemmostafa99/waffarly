# Business activities handoff

Updated: 2026-11-24

## Goal and acceptance

Make a merchant's chosen activity shape dashboard, POS, products, and stock while
preserving the working restaurant flow. Deliver clothing first, then agree and
add the remaining retail differences in small tasks. See [the plan](README.md)
and [task list](TASKS.md).

## Current state

- Workspace: `F:\Projects\waffarly`; current branch: `business-activities`.
  It was created from `main` at the user's request and renamed from the
  initial `codex/business-activities` name at their request.
- Approved scope in this chat: create the English plan, small task list,
  project workflow rules, documentation index link, and this handoff. No feature
  code implementation was approved or started.
- Today, the activity keys are `restaurant`, `clothing`, `supermarket`, and
  `other`. Super Admin stores the choice; the runtime changes only a few paths.
  The restaurant flow is the baseline to keep working.
- The project has a manual-QA/no-automated-checks preference. Report checks that
  actually run; do not label untested behavior as verified.

## Documentation delivered

- `README.md`: goal, current state, flow, examples, guardrails, and risks.
- `TASKS.md`: ordered, small delivery tasks and their completion conditions.
- Root `AGENTS.md`: feature coding and handoff rules.
- `docs/README.md`: entry link for future work.
- `RESTAURANT_BASELINE.md`: Task 01 checklist and user-accepted restaurant
  baseline; individual steps were not independently run by the agent.

## Task 02 implementation

User approved the limited shared-settings task. `packages/contracts/src/activities.ts`
now defines `BUSINESS_ACTIVITY_SETTINGS` for every current key. Restaurants
initially select recipe stock and have kitchen and tables; the other keys
initially select direct stock and have no kitchen or tables.
`packages/contracts/src/index.ts` exports it. These are
target settings only; no dashboard, POS, API, or database behavior reads them
yet. `TASKS.md` records the completed definition.
`defaultInventoryMode` is only the new-product starting choice. The user
clarified that restaurant products may use either `RECIPE` or `DIRECT`, and the
current product builder offers both; the shared settings must not restrict it.
The local TypeScript compiler completed `packages/contracts/tsconfig.json`
with `--noEmit` successfully; `git diff --check` passed. No app flow or
automated test suite was run for this constants-only task.

## Task 03 implementation

User approved passing the chosen activity to both merchant apps. The owner
profile already contained `activity`; API POS sessions now include the merchant
activity. `resolveBusinessActivitySettings` returns the selected settings and
uses the `other` settings for a missing or unknown key. Dashboard and POS
layouts place the resolved settings in their outlet contexts for later tasks.
No navigation, sale, stock, or restaurant product-mode behavior changed.

Contracts build, API/dashboard/POS typechecks, and direct resolver assertions
for restaurant, clothing, unknown, and missing keys passed. No live app journey
or API/database suite was run for this wiring task.

## Checks and limits

The original documentation links and `git diff --check` passed. Task 01 source
review confirmed restaurant recipe defaults and settings routing. The user's
running restaurant flow was accepted by the user as working. The agent's port
checks were from a separate command session and do not establish the state of
the user's running apps. Browser inspection was unavailable because Computer
Use could not determine the current URL safely. Corepack could not reach the
registry for pinned pnpm, and Docker engine access was denied in the command
session. See `RESTAURANT_BASELINE.md` for exact results. Example
behavior for future activities is proposed, not implemented or verified. The
exact scope of supermarket and home goods/electrical activities still needs a
decision before their tasks.

## Next action

Tasks 01–03 are recorded above. Next, plan Task 04: make dashboard navigation
fit the activity, including direct-route behavior. Verify the branch and working
tree and get approval for that task's full scope before editing. Task 03
approval does not approve Task 04.
