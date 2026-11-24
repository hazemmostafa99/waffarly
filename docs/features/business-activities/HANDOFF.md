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
- `RESTAURANT_BASELINE.md`: Task 01 checklist; all live steps remain not run.

## Checks and limits

The original documentation links and `git diff --check` passed. Task 01 source
review confirmed restaurant recipe defaults and settings routing. Live
restaurant/POS journeys have not run: local app and PostgreSQL ports are closed,
Corepack cannot reach the registry for pinned pnpm, and Docker engine access was
denied in this session. See `RESTAURANT_BASELINE.md` for exact results. Example
behavior for future activities is proposed, not implemented or verified. The
exact scope of supermarket and home goods/electrical activities still needs a
decision before their tasks.

## Next action

Continue Task 01 by running the focused manual baseline in
`RESTAURANT_BASELINE.md` once local services and disposable demo data are
available. Record actual results and close the task only after those checks.
Before any code edit, verify current branch and working tree, read relevant
feature instructions, and present a complete task plan for approval. This
handoff does not approve later implementation.
