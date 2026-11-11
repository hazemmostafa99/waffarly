# Local favorites flow

Route: `/favorites`.

The page lists the existing reference products selected with the shared heart
control. Toggling a heart removes that product from the list immediately; toggling
it again from any product card adds it back. Product cards retain their details link
and add-to-cart action. Adding a product opens the shared cart drawer.

`favorites/model/favorites.ts` resolves saved product IDs against the local catalog.
`favorites/state/favorites-slice.ts` owns the IDs and toggle action, while
`favorites/hooks/use-favorites-store.ts` scopes UI access to that feature. No new
product data or backend request was introduced.

Favorites live in the provider-scoped Zustand store only. They survive client-side
navigation and disappear when the Marketplace page is refreshed. The page and its
empty state explain this limitation.

Manual review: open Favorites from the header and menu, save a product, remove it
from the page, restore it from a product detail/card, add it to the cart, then
remove the final favorite and use the empty-state link. Refresh to confirm the
session-only behavior. Check the page on mobile and confirm prices use Western
digits. No automated checks were run for this slice, per user instruction.
