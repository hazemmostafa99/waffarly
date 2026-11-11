# Marketplace interactions

Evidence level: behavior inferred directly from the downloaded inline JavaScript. It has not been exercised in a browser yet. No original backend is contacted.

| Source behavior                                                                            | Local implementation                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Search on form submit, selected category AND trimmed case-sensitive substring of data-name | Local React filter over extracted searchName/category; typing alone does not filter |
| Category click activates that card, filters using current input text and scrolls to deals  | URL category ID + submitted query; keyboard Enter/Space added                       |
| Each add click appends one cart line, including duplicates                                 | Zustand product ID array; no grouping or quantity controls invented                 |
| Cart count equals line count; total sums item prices                                       | Derived from extracted prices, formatted through Intl ar-EG                         |
| Remove deletes clicked line                                                                | Zustand index removal                                                               |
| Favorite toggles outline/filled heart                                                      | Zustand favorites IDs and aria-pressed                                              |
| Cart link/mobile cart opens left drawer; close/overlay closes                              | Zustand cartOpen; original transitions retained                                     |
| Add displays toast for 1800ms                                                              | React timer with cleanup; role=status                                               |
| Countdown begins at 05:42:18 and ticks once per second to zero                             | Local interval, resets on remount, no claim of server deadline                      |
| Hero buttons scroll to deals/stores                                                        | scrollIntoView with smooth behavior                                                 |

Accessibility additions: category keyboard activation, named favorite/remove controls, cart dialog semantics, focus trap, Escape close and focus return. Closed drawer hidden from focus. These are local improvements, not claims about original behavior.

The source menu, checkout, seller signup, most mobile-nav controls, app badges and href=# links had no handlers. Local navigation now deliberately extends that behavior: the header menu works; mobile home/categories/search/cart have actions; header account/orders, mobile account and menu seller entry show pending-page notices. Other checkout/footer/store/banner placeholders remain for later local-only slices. No real authentication, payment or order flow is implied. There is no cart persistence across reloads yet; QueryClient remains provisioned without fake network requests.

## Cleanup boundary

The earlier component/provider cleanup preserved source behavior. The newer [navigation slice](marketplace-navigation.md) explicitly extends it: query/category are URL-owned, category navigation uses the committed search query rather than unsubmitted draft text, and mobile/header controls have deliberate outcomes. Menu/modal state stays local. Native dialog provides keyboard containment, Escape/backdrop dismissal and focus return by implementation; browser confirmation is still pending. Full account/order/checkout flows remain on the local-data roadmap, not backend prerequisites.
