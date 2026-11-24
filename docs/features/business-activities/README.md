# Business activities: simple delivery plan

## Goal

When Super Admin creates a merchant and chooses a business activity, that choice
should shape the merchant's dashboard, product setup, POS, and stock work. A
clothing shop should work like a clothing shop; a restaurant should keep working
like a restaurant.

We will deliver this in small steps. Clothing is the first complete new example.
Supermarkets and home goods or electrical shops follow once we learn which parts
they can share. The exact names and differences for those later activities need
to be agreed before their tasks start.

## What exists today

- Super Admin can assign `restaurant`, `clothing`, `supermarket`, or `other` when
  creating a merchant. Activity names and descriptions can be edited for display.
- Activity is mainly a classification today. It is not a complete switch for
  dashboard, POS, and stock behavior.
- Some restaurant behavior is already separate: restaurant settings and recipe
  stock usage. Other activities default to direct stock usage. The merchant menu
  still contains restaurant items such as tables for everyone.
- Existing restaurant flows are the reference behavior to preserve.

The [current activity catalog](../super-admin/activities-modules/OVERVIEW.md)
describes today's behavior. This document describes the proposed delivery work;
it does not claim the new behavior is implemented.

## How the choice should work

1. Super Admin chooses an activity when creating a merchant.
2. The merchant account keeps that activity. The merchant apps read the resulting
   activity settings when the merchant signs in.
3. Dashboard and POS show the relevant pages, words, and actions.
4. Product and stock actions use rules that fit the activity. The API also checks
   these rules; hiding a button alone does not protect an operation.

Keep one easy-to-find definition of what each activity supports. Reuse shared
sales, product, and stock behavior where it fits. Add a separate behavior only
when the actual business flow is different. The activity does not replace plan
access or staff permissions.

| Area | Restaurant | Clothing | Supermarket | Home goods / electrical |
| --- | --- | --- | --- | --- |
| Products | Menu items, choices, recipes | Items with size and color | Barcodes and selling units | Models and useful details |
| Stock | Ingredients consumed by recipe | Quantity for each sellable choice | Direct quantity and packs | Direct quantity by item or model |
| POS | Orders, kitchen, and tables where used | Direct sale and item returns | Fast direct sale | Direct sale; warranty only if required |
| Dashboard | Order and preparation work | Sales, stock, and returns | Sales and low stock | Sales and stock |

These are starting examples, not promises that every listed detail already exists.
Each activity's exact flow gets a small task and a clear review before delivery.

## Protect the restaurant flow

- First record the important restaurant paths and check them before changing
  shared behavior: product setup, recipe stock use, POS sale, order handling,
  returns, and relevant settings.
- Introduce activity behavior in small places. At first, the restaurant choice
  must lead to the same result as today.
- Check both restaurant and clothing examples after every shared change. Fix a
  regression before starting the next task.
- Keep old order details stable if activity changes later. Decide the rules for
  changing an established merchant's activity before offering that action.

## Code that stays easy to work with

- Finish one small, usable task at a time. Prefer a focused change over a large
  refactor or hundreds of unrelated lines.
- Follow existing project patterns. Use plain names and short functions. Keep
  business rules separate from page layout and data fetching where that helps
  someone understand or replace them.
- Explain why a function exists when its purpose is not obvious. A comment should
  add context, not repeat the function name or every line.
- Avoid regular expressions for simple string work. If one is useful, explain
  its input, output, and one example, such as `"XL-Blue"` becoming `"XL Blue"`.
- Add meaningful checks for changed behavior. Use the project's current manual
  review preference, and report automated checks only when they are run.
- Update [the task list](TASKS.md) and [handoff](HANDOFF.md) after each task so the
  next person can see the real state without guessing.

## Boundaries and risks

This plan covers merchant creation, merchant dashboard, POS, catalog, and stock.
It does not start Marketplace backend integration or change its separate roadmap.
Do not introduce a new dependency or a general configuration engine just to add
one activity. Before API, database, or shared-contract work, read
[the API instructions](../../../apps/api/AGENTS.md). If the database shape changes,
make it reproducible for the team using the repository's schema-change process;
development status does not make an undocumented local edit safe to share.

The main risk is a shared change breaking restaurant behavior. Another risk is
showing a retail option whose stock or sale rules are incomplete. Small tasks,
clear activity rules, and review of both flows limit those risks.

## Where to continue

Use [TASKS.md](TASKS.md) for the next small piece of work and [HANDOFF.md](HANDOFF.md)
for current status. Implementation needs its own approved task scope; this plan
and its approval authorize documentation only.
