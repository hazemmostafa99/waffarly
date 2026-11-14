# Marketplace header

The desktop header prioritizes delivery context, search, account, My Orders,
favorites and cart. My Orders always opens the order list; a small indicator and
tooltip announce an active order without choosing one on the customer's behalf.
Favorites uses an icon without a counter; its count appears in the account menu.
Cart quantity is announced and the badge appears only when nonempty.

The account dropdown shows initials, a first-name greeting and the full name,
followed by icon-labelled account, orders and favorites links. Signed-in customers
see a muted translucent mauve initials avatar with off-white lettering and a thin
light border in the header trigger instead of the generic account
icon and label; visitors see the account icon and sign-in label. Both open the
same dropdown.
Signed-in customers
can end their real session from the dropdown or account page. Both share a logout
hook that calls the existing logout endpoint and clears customer order caches
after success. Browser-local favorites remain intact and are explicitly described
as separate from the customer account. Failed logout leaves the session intact
and offers an inline error.

The signed-in account page opens directly on profile details. Its sidebar contains
profile, orders and favorites, without a separate overview tab.
Order lists put active orders first, newest first within each group. Active order
cards link directly to tracking; finished cards retain their detail links.

Primary navigation retains the original links and order: Home, Offers, Categories,
Stores, Electronics, Mobiles, Fashion, Home and Kitchen, Grocery, Restaurants and
Seller Signup. It remains a horizontally scrollable row on narrow screens, with
the original category navigation behavior.

The promotion strip is smaller and dismissible for the current mounted session.
On narrow screens search gets its own row, the category bar stays visible, and
bottom navigation uses consistent Lucide icons.

The active-order indicator uses the existing customer orders query. The list
refreshes on route changes and every 30 seconds while an active order exists and
the page is visible. Request failures hide the indicator; My Orders stays visible.

## Manual QA

- Review desktop, tablet and 320–390px mobile layouts, including a long name.
- Dismiss the promotion and confirm the header closes the gap.
- Open the account dropdown and expanded navigation with pointer and keyboard; verify Escape,
  outside clicks, focus leaving the account dropdown and destination links.
- Navigate to categories from home and product detail pages.
- Verify favorites has no adjacent text, retains its tooltip and opens favorites.
- Verify cart quantity, empty cart and mobile bottom navigation.
- Check that My Orders always opens the list, active orders appear first and each
  active card opens its own tracking page. Confirm the indicator clears after all
  loaded orders finish and the list refreshes.
- Verify name initials, guest sign-in/signup, local favorite counts, logout success
  and logout errors. After successful logout, confirm private account data is no
  longer displayed and local favorites remain available.
- Confirm the signed-in account opens directly on profile details and its sidebar
  retains orders and favorites without an overview tab.

Browser QA is left to the user. No automated checks are run under the repository
preference.
