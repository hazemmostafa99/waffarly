# Business activities: small tasks

Work in order. Take one task through implementation and review before starting
the next. Split a task again if its diff becomes hard to understand. Record the
actual files changed and checks run in [HANDOFF.md](HANDOFF.md).

| ID | Task | Done when | Main area |
| --- | --- | --- | --- |
| 01 | Record the current restaurant journeys | User accepted the running restaurant flow on 2026-11-24; agent source checks are recorded and individual live checks remain unrun | Existing behavior |
| 02 | Define simple activity settings | Defined in shared contracts on 2026-11-24; restaurant initially selects `RECIPE` but can also use `DIRECT`; other current keys initially select `DIRECT` | Shared activity definition |
| 03 | Deliver the chosen activity to merchant apps | API POS session now includes activity; owner and POS outlet contexts resolve settings; missing or unknown activity uses `other` settings | Merchant account and apps |
| 04 | Make dashboard navigation fit the activity | Tables sidebar link and `/pos-tables` route are available only when `hasDiningTables` is true; other shared pages remain available | Merchant dashboard |
| 05 | Finish a clothing product flow | Live create/save/reopen of a size/color product with SKU and barcode checked on 2026-11-25. Some restaurant wording remains (see handoff) | Catalog |
| 06 | Finish clothing stock flow | Live 2026-11-25: choice linked to a direct stock item; sale and returns changed stock correctly. Uncommitted | Inventory |
| 07 | Finish clothing POS sale | Live 2026-11-25: barcode scan, in-store sale, completion on payment, stock 6 → 4. Uncommitted | POS and sales |
| 08 | Finish clothing return flow | Live 2026-11-25: sellable return restocked 1, damaged return did not. Uncommitted | POS and returns |
| 09 | Make clothing dashboard useful | Live 2026-11-25: retail labels, actions and return conditions shown after review fixes. Some restaurant wording remains | Dashboard and reports |
| 10 | Review clothing end to end | Create merchant through Super Admin, set up a product, stock it, sell it, and return it; recheck restaurant flow | Manual review |
| 11 | Decide and add supermarket differences | Confirm exact units, barcode, and POS needs before a small implementation slice | Supermarket |
| 12 | Decide and add home goods/electrical differences | User decided on 2026-11-25: two separate activities (`home_goods`, `electrical`), keys and model-style product guidance kept. Still confirm which model or warranty details matter | Later retail activities |

For each task, write a short scope before changing code: behavior, expected
files, checks, and risk to restaurant flows. Get the required plan approval, then
implement that scope. A new architecture, dependency, destructive action, or
material scope change needs a new decision. Do not mark a task done from a plan
alone. If a task touches API, database, or contracts, follow
[apps/api/AGENTS.md](../../../apps/api/AGENTS.md).
