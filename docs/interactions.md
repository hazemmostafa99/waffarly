# Marketplace interactions

Evidence level: behavior inferred directly from the downloaded inline JavaScript. It has not been exercised in a browser yet. No original backend is contacted.

| Source behavior                                                                            | Local implementation                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Search on form submit, selected category AND trimmed case-sensitive substring of data-name | Local React filter over extracted searchName/category; typing alone does not filter |
| Category click activates that card, filters using current input text and scrolls to deals  | React category index + filter state; keyboard Enter/Space added                     |
| Each add click appends one cart line, including duplicates                                 | Zustand product ID array; no grouping or quantity controls invented                 |
| Cart count equals line count; total sums item prices                                       | Derived from extracted prices, formatted through Intl ar-EG                         |
| Remove deletes clicked line                                                                | Zustand index removal                                                               |
| Favorite toggles outline/filled heart                                                      | Zustand favorites IDs and aria-pressed                                              |
| Cart link/mobile cart opens left drawer; close/overlay closes                              | Zustand cartOpen; original transitions retained                                     |
| Add displays toast for 1800ms                                                              | React timer with cleanup; role=status                                               |
| Countdown begins at 05:42:18 and ticks once per second to zero                             | Local interval, resets on remount, no claim of server deadline                      |
| Hero buttons scroll to deals/stores                                                        | scrollIntoView with smooth behavior                                                 |

Accessibility additions: category keyboard activation, named favorite/remove controls, cart dialog semantics, focus trap, Escape close and focus return. Closed drawer hidden from focus. These are local improvements, not claims about original behavior.

Original menu button, checkout, seller signup, most mobile-nav buttons, app badges and href=# links have no functional handler in inspected source. They remain visually present with the same limitations; no authentication/payment/order flow is invented. Account action points to #stores and orders action to #deals, matching source. There is no persistence across reloads in the reference or this reconstruction. QueryClient is configured, but no fake catalog network calls are added.

## Cleanup boundary

The component/provider refactor preserves these source interactions. Unused speculative mobile-menu state was removed; the menu remains a known reference placeholder. Full navigation, quantity-based carts, checkout and account work are planned separately in [the functional roadmap](marketplace-roadmap.md), rather than silently added during cleanup.
