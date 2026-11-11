# Marketplace Tailwind and feature-structure refactor

## Actual changes

The component stylesheet `marketplace.css` was removed. Its layout, spacing,
typography, effects, responsive and state rules now live in Tailwind class names
in the corresponding TSX components. Exact values use arbitrary utilities where
the design does not match a standard utility; pseudo-elements and descendants use
Tailwind variants. There is no replacement component-CSS map and no @apply copy.

`apps/storefront/src/styles/marketplace-tokens.css` contains scoped palette values,
standard shadcn token aliases and base normalization/focus/font rules only. The
existing shared Tailwind entry already scans `apps/storefront/src`, so components
use its standard color utilities with Marketplace-scoped token values. Other app
themes and tenant storefront styles are not changed.

## Shared UI use

Thin wrappers in `src/components/marketplace` now use the existing project
`@waffarly/ui` Button, Input, Textarea, Card and Dialog implementations. They adapt
the visual defaults to the Marketplace palette; they do not copy their underlying
DOM or native dialog lifecycle. `cn` from the same library merges utility overrides.
Buttons, text fields, address textareas, applicable card sections and the menu/
pending dialogs use these wrappers. Native radio/select controls remain native
where there is no shared equivalent.

This uses the repository's existing shadcn-style primitives. It does not claim an
official shadcn CLI installation or a new Radix Dialog dependency. No package or
dependency version was added/changed. Browser focus handling now delegates to the
shared Dialog; the wrapper adds Marketplace backdrop dismissal and scroll locking.

## Feature ownership

```text
features/marketplace/
  home/components/
  navigation/
    components/
    hooks/
    model/
  search/
    components/
    hooks/
    model/
  catalog/
    components/
    model/
  product-detail/
    components/
    model/
  cart/
    components/
    model/
  checkout/
    components/
    hooks/
    model/
  state/marketplace-store.ts
  shared/lib/format-money.ts
  providers/marketplace-providers.tsx
  data/reference.json
  tests/marketplace.test.ts
```

Pure catalog lookup/filtering/types belong to catalog; cart quantity validation,
derived counts/subtotals and cart-line types belong to cart. The money formatter
is shared across both. Product navigation/recommendation helpers belong beside
product detail. Checkout draft validation belongs beside checkout, and its local
state-machine hook is in checkout/hooks. Import paths and the focused test script's
entry path were updated for the moves; tests were retained but not executed.

## Preserved scope and verification limit

Routes, local fixture content, prices using Western digits, cart/favorites,
navigation and demo checkout behavior are intended to stay the same. No backend,
API/database work, persistence, new product data or real order/payment was added.
Historical raw reference HTML remains available outside the runtime.

Only source editing and formatting were performed. Per the user's instruction,
no tests, browser automation, typecheck or build were run. Visual equivalence,
responsive rendering and runtime behavior after this broad refactor need manual
review. Earlier passing results in other reports do not verify this revision.
