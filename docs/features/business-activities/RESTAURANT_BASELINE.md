# Restaurant baseline for Task 01

Status: **in progress**. This is a checklist for the current restaurant flow,
not a claim that the live flow has passed.

## What we can confirm from the code

- The merchant product builder defaults a restaurant product to `RECIPE` stock
  mode. The API uses the same restaurant default; other activities default to
  `DIRECT`.
- Restaurant merchants open the restaurant settings workspace.
- POS has separate catalog, kitchen, order, and dining routes. A cashier needs
  the appropriate permissions and an open register shift for a sale.

## Manual journey to run with local demo data

Use the isolated restaurant account and setup in
[the local demo guide](../inventory/LOCAL_DEMO_GUIDE_AR.md). Record the date,
merchant, result, and any issue for each step. Do not use a real merchant sale.

| Step | Expected result | Result |
| --- | --- | --- |
| 1. Sign in as the restaurant owner and open settings | Restaurant settings appear | Not run |
| 2. Open the seeded pizza product in the product builder | Sizes, prices, and recipe stock settings are visible | Not run |
| 3. Review its recipe and starting stock | Each size points to the intended ingredients and quantities | Not run |
| 4. Sign in as the test cashier and open a test shift | Catalog and test register are available | Not run |
| 5. Make a disposable POS sale of a chosen size | Correct choice, total, receipt, and stock effect appear | Not run |
| 6. Follow the resulting order in the relevant POS view | Status and order details remain consistent | Not run |
| 7. Return an item from that disposable POS sale | Return refers to the right item; stock and refund follow current rules | Not run |
| 8. Reopen owner stock and order views | Recorded movements and order state match the actions above | Not run |

## Check results on 2026-11-24

- `main` was used to create the requested `business-activities` branch. The
  previous documentation changes were preserved.
- Code review confirmed the restaurant defaults and routes listed above. This
  checks the intended wiring only, not a working sale or stock result.
- Local API, merchant dashboard, and POS listeners were closed. PostgreSQL was
  closed on the documented port `5433` and on `5432`.
- Node `v24.11.1` and local dependencies are present. `pnpm --version` could not
  complete: Corepack tried to download the pinned pnpm version, but the npm
  registry could not be reached. Docker is installed, but this session could
  not access its engine.
- No demo seed, login, sale, return, or stock change was attempted. Every live
  step above is still **Not run**. Task 01 remains open.
