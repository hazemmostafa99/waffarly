# Business activities handoff

Updated: 2026-11-24

## Goal and acceptance

Make a merchant's chosen activity shape dashboard, POS, products, and stock while
preserving the working restaurant flow. Deliver clothing first, then agree and
add the remaining retail differences in small tasks. See [the plan](README.md)
and [task list](TASKS.md).

## Current state

- Workspace: `F:\Projects\waffarly`; branch checked before this documentation
  change: `main`; working tree was clean.
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

## Checks and limits

The new files and entry links were checked, and `git diff --check` passed. No code
tests, builds, or live restaurant/POS journeys have been run for this
documentation-only task. Example behavior for future activities is proposed,
not implemented or verified. The exact scope of supermarket and home
goods/electrical activities still needs a decision before their tasks.

## Next action

Start Task 01 by writing and running a focused manual baseline for existing
restaurant journeys. Before any code edit, verify current branch and working
tree, read relevant feature instructions, and present a complete task plan for
approval. This handoff records the documentation approval only; it does not
approve later implementation.
