# Marketplace favorites

Favorites are saved in the existing browser-local Marketplace store alongside the
cart. They survive reloads on the same browser and are not synchronized with a
customer account. Existing persisted carts remain compatible.

Product cards, restaurant menu cards and product detail pages share the same heart
button and favorite IDs. Restaurant favorites also retain display-only snapshots
so API-backed menu items can appear without being in the local reference catalog.
Snapshots exclude live restaurant settings, variants and modifiers. Restaurant
links retain the restaurant slug and open the existing product page to resolve
current prices, availability and choices before ordering. Saved prices and
availability are not live; the favorites page explains this. Removed remote items
use the product page's existing not-found behavior and can still be removed from
favorites. Unresolvable saved IDs have an explicit removal action.

No API, database or checkout contracts change.

## Manual QA

- Heart a restaurant menu item; confirm the card and detail page share its state.
- Open favorites; confirm the API-backed item's image, name and restaurant appear.
- Reload favorites; confirm both favorites and an existing cart survive.
- Open a saved restaurant item; confirm its restaurant context, current choices
  and prices load through the existing product page.
- Remove favorites from a menu, detail page and favorites page; confirm counters
  and hearts agree without adding to the cart or opening another page.
- Save an unavailable item and verify saving/removing it still works.
- Verify an empty list and an unresolvable saved ID can be handled and removed.
- Verify local demonstration products still save and remove independently.

These are manual review steps, not a record of executed browser QA. Automated
checks are intentionally not run under the repository's manual-QA preference.
