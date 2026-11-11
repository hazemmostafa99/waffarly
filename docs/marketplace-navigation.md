# Local navigation and URL search slice

Mode: UI-only; existing `reference.json` data; no backend/API/database requests or new server routes. This is a local extension of the inspected homepage, not a claim about additional source-site behavior.

## Delivered

- Header menu opens a native modal containing the same navigation definitions as the desktop navigation. Choosing a destination closes the menu.
- Primary navigation goes to actual homepage sections or applies a catalog category. Seller entry shows a pending-page notice; it does not open the backend-connected `/join` flow.
- Mobile Home resets the filter and scrolls to the homepage, Categories scrolls to the category collection, Search focuses the input, Cart opens the existing drawer, and Account shows an honest pending-page notice.
- Header Account/Orders also show pending-page notices instead of unrelated store/deal anchors.
- Modal Escape, backdrop dismissal, focus containment/return and scroll locking use the native dialog plus a shared wrapper. Browser verification of those behaviors remains pending.
- Search uses the URL as its committed source of truth; no backend requests are made when updating local filters.

## URL contract

`/marketplace?category=mobiles&q=<encoded Arabic text>#deals`

| Part                               | Meaning                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `q`                                | Trimmed submitted search text; matches the existing case-sensitive reference `searchName` substring              |
| `category`                         | `all`, `mobiles`, `electronics`, `fashion`, `home`, `food`, `grocery`, `beauty`; unknown values fall back to all |
| absent/all category or blank query | Defaults to the full catalog; redundant owned query parameters omitted when writing URLs                         |
| fragment                           | Actual destination section: marketplace-main, categories, deals, stores or restaurants                           |

Mobiles and electronics have different UI identifiers and active cards, but both map to the reference fixture's electronics product category. Empty food/grocery collections remain honest empty results; no extra products are invented. Unrelated query parameters are preserved.

Draft input/select values remain local and apply on form submit. Committed URL changes remount the search form with the URL values, so direct links, reloads and history navigation use the same filter model. Category clicks retain the last submitted search text; unlike the source's draft-text behavior, unsubmitted typing does not affect category navigation. Home clears both filters. Selecting a category is immediate; changing the search select alone waits for submit.

The hook uses Next.js's documented native `history.pushState` integration with `useSearchParams`; it adds a history entry without reloading or requesting backend data. Identical full URLs are not pushed repeatedly. Actual browser Back/Forward and focus/scroll behavior still require interactive QA.

## Responsibility map

| File/group                                               | Responsibility                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `features/marketplace/search/search-state.ts`            | Pure parsing, local category identity/mapping, safe URLSearchParams serialization |
| `search/use-marketplace-search.ts`                       | URL state and in-browser history/section updates                                  |
| `search/marketplace-search-form.tsx`                     | Draft form UI and submit event                                                    |
| `components/navigation/navigation-items.ts`              | Shared typed destinations                                                         |
| `components/navigation/marketplace-navigation-links.tsx` | Reusable desktop/menu link rendering                                              |
| `components/navigation/use-marketplace-navigation.ts`    | Local menu/pending state and navigation orchestration                             |
| `components/navigation/marketplace-menu.tsx`             | Menu composition                                                                  |
| `components/navigation/marketplace-pending-feature.tsx`  | Honest unavailable-page feedback                                                  |
| `components/marketplace/marketplace-dialog.tsx`          | Shared native dialog lifecycle and dismissal                                      |

Cart/favorites remain in the existing provider-scoped Zustand store; menu, drafts and modal state stay local. React Query remains provisioned but unused for this in-process search.

## Verification

- TypeScript passed.
- 6 focused tests passed: URL defaults/invalid values/Arabic whitespace; encoding and unrelated-param preservation/reset; filter derivation from a sequence of history URLs; original local search/cart/favorites cases.
- Production build passed after the installed Next.js security advisory pause/retry; the advisory remains unresolved.
- Production HTTP checks passed: full catalog 5 products, mobiles plus Arabic phone query 1 product, food 0 products, unknown category 5 products. Every response returned 200 and included the menu markup.
- Browser initialization still fails with missing sandboxPolicy. No screenshot, click, keyboard, console, responsive or actual history-navigation result is claimed from these checks.

## Remaining in this milestone

Browser-test menu dismissal, focus return, mobile search focus, scroll, modified link clicks, direct URLs and actual Back/Forward at 375/390/768/1024/1440 widths. Sorting, pagination, footer links, store detail links, section-heading links, seller-banner CTA and full account/order/checkout screens are not completed by this slice. They stay on the local-data roadmap; backend absence is not a blocker for building them.
