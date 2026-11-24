# Business activities: small tasks

Work in order. Take one task through implementation and review before starting
the next. Split a task again if its diff becomes hard to understand. Record the
actual files changed and checks run in [HANDOFF.md](HANDOFF.md).

| ID | Task | Done when | Main area |
| --- | --- | --- | --- |
| 01 | Record the current restaurant journeys | User accepted the running restaurant flow on 2026-11-24; agent source checks are recorded and individual live checks remain unrun | Existing behavior |
| 02 | Define simple activity settings | Defined in shared contracts on 2026-11-24; restaurant initially selects `RECIPE` but can also use `DIRECT`; other current keys initially select `DIRECT` | Shared activity definition |
| 03 | Deliver the chosen activity to merchant apps | The signed-in merchant receives the correct settings; missing or unknown values have a safe, explicit result | Merchant account and apps |
| 04 | Make dashboard navigation fit the activity | Clothing does not see restaurant-only pages; direct routes follow the same rule | Merchant dashboard |
| 05 | Finish a clothing product flow | A clothing item can be set up with its sellable size/color choices and reviewed | Catalog |
| 06 | Finish clothing stock flow | Each sellable choice uses the correct stock and stock changes can be reviewed | Inventory |
| 07 | Finish clothing POS sale | Cashier can find, sell, and review the correct choice with correct price and stock effect | POS and sales |
| 08 | Finish clothing return flow | A return records the selected choice and applies the right stock rule | POS and returns |
| 09 | Make clothing dashboard useful | Sales, stock, and returns are shown with relevant labels and no restaurant-only actions | Dashboard and reports |
| 10 | Review clothing end to end | Create merchant through Super Admin, set up a product, stock it, sell it, and return it; recheck restaurant flow | Manual review |
| 11 | Decide and add supermarket differences | Confirm exact units, barcode, and POS needs before a small implementation slice | Supermarket |
| 12 | Decide and add home goods/electrical differences | Confirm whether these are one or two activities and which model or warranty details matter | Later retail activities |

For each task, write a short scope before changing code: behavior, expected
files, checks, and risk to restaurant flows. Get the required plan approval, then
implement that scope. A new architecture, dependency, destructive action, or
material scope change needs a new decision. Do not mark a task done from a plan
alone. If a task touches API, database, or contracts, follow
[apps/api/AGENTS.md](../../../apps/api/AGENTS.md).
