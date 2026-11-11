# Marketplace design system

Current detail layout follow-up: content maximum 1240px; image uses contain with
340-480px desktop height, 380px at <=900px and 320px at <=700px. Breadcrumbs align
with the card. Seller and purchase cards use existing surface/purple/border tokens.
Shared full Marketplace header replaces the removed minimal detail header. These
local detail choices supersede the initial detail dimensions below.

User requirement: all displayed prices use Western digits `0-9` (for example,
`8,750 ج.م`). The shared `money` formatter uses explicit Latin numbering and is
shared by product prices, purchase subtotals and cart totals; Arabic currency text
and RTL remain. Original old-price strings already contain Western digits.

Product details extension: local two-column layout switches to one column at
700px, with the existing purple/gold/Tahoma system, 24px desktop/18px mobile card
radius, original single product image, 30px/24px heading and shared quantity controls.
These are local UI choices, not extracted product-detail measurements. Listing
cards retain their existing appearance; image/name are now links.

Local navigation extension: the new native menu/pending dialogs use existing
purple/gold/surface/shadow tokens, 18px radius and a maximum width of 430px with
16px viewport gutters. These dialog dimensions are local UI choices, not extracted
reference components. Original homepage rules and 700/1100px breakpoints remain.

Source: public HTML downloaded from https://wafarly-marketplace.rassameldeeb.chatgpt.site/ on 2026-11-11 (Africa/Cairo). Evidence: `reference/marketplace/source.html`. These are authored CSS values, not browser-measured computed styles. The original provisional green palette and Tajawal font have been replaced.

## Colors

| Variable                           | Value                                           |
| ---------------------------------- | ----------------------------------------------- |
| purple-950 / 900 / 800 / 700 / 600 | #1d0629 / #2a073b / #3a0d50 / #51166c / #6d218c |
| purple-100 / 50                    | #f2e9f7 / #faf7fc                               |
| gold / gold-2                      | #f5bd19 / #ffd966                               |
| ink / muted / line                 | #17131c / #6e6873 / #e8e2eb                     |
| bg / card                          | #f5f3f6 / #ffffff                               |
| green / red                        | #16845b / #d93a50                               |

All variables are scoped to `.marketplace-theme` in `apps/storefront/src/styles/marketplace.css`. Tailwind semantic utilities map directly to these variables through `@theme inline`. Source CSS is preserved and scoped rather than approximated through the nearest Tailwind defaults. Existing storefront themes remain independent.

## Typography and layout

- Font: Tahoma, "Segoe UI", Arial, sans-serif; browser/system provided, no font download in source.
- Hero heading: 44px, 1.25 line-height; 35px at <=1100px; 29px at <=700px. Hero paragraph: 17px/1.8, 14px on mobile.
- Section headings: 24px. Product heading: 13px/1.6, fixed 42px height. Price: 18px/900. Small metadata: 9-13px.
- Container: min(1480px, calc(100% - 32px)); <=700px: min(100% - 20px, 1480px).
- Header: min-height 78px; search 50px (45px on mobile).
- Hero: min-height 350px, columns 1.15fr/.85fr, radius 24px; one column and radius 18px on mobile.
- Categories: 8 columns desktop, 4 at <=1100px. Icon size 76px, 52px on mobile.
- Restaurants: 6 columns desktop, 4 at <=1100px; horizontal scrolling with min-width 225px at <=700px.
- Products: 5 columns desktop, 3 at <=1100px; horizontal scrolling with min-width 220px at <=700px. Image height 205px/180px.
- Cart: left drawer, min(390px, 92vw), fixed full height. Mobile navigation visible at <=700px.

## Effects

- Shared shadow: 0 8px 24px rgba(43,13,55,.09).
- Hero gradient: linear-gradient(115deg,#2c083e 0%,#4c1463 54%,#7c3394 100%).
- Promo gradient: linear-gradient(90deg,var(--gold),#ffe89c,var(--gold)).
- Category hover: translateY(-3px), .2s; product hover: translateY(-4px), .2s; restaurant hover .22s.
- Product image hover: scale(1.045), .3s; restaurant image: scale(1.06), .3s; category image: scale(1.08), .25s.
- Cart slide: translateX(-105%) to none in .28s; overlay/toast .25s. No custom easing is declared (CSS default ease).
- All remaining borders, shadows, gradients and media rules are preserved in the scoped stylesheet. Runtime rendering and diff validation are pending.
