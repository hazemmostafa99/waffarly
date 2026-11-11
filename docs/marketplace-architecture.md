# Marketplace architecture and component design

Current structure after the Tailwind/shared-UI refactor. See [refactor details](marketplace-tailwind-refactor.md), [UI roadmap](marketplace-roadmap.md), and [implementation guide](marketplace-implementation-plan.md).

## Product boundaries

Marketplace lives under `/marketplace`; the business pages `/` and `/join` and tenant storefronts `/s/[slug]` remain separate. Root layout owns global providers/document markup. Business routes use `(business)/layout.tsx`; Marketplace layout owns its scoped theme, provider and single shared cart drawer. No pathname-based SiteChrome remains.

All current Marketplace work is UI-first with local reference data. No backend/API/database integration, real customer session, order or payment is authorized. Contact data stays transient. Integration starts only after UI-flow completion and explicit user instruction.

## Folders

```text
apps/storefront/src/
  app/marketplace/                 # Thin route entries and layout
    products/[productId]/
    cart/
    checkout/
    orders/[orderId]/
  components/marketplace/          # Shared Marketplace primitives/adapters
    marketplace-button.tsx        # Uses @waffarly/ui Button
    marketplace-form-controls.tsx # Uses Input and Textarea
    marketplace-card.tsx          # Uses Card
    marketplace-dialog.tsx        # Uses Dialog; no duplicate modal implementation
    marketplace-container.tsx
    section-heading.tsx
    quantity-selector.tsx
  features/marketplace/
    home/components/
    navigation/{components,hooks,model}/
    search/{components,hooks,model}/
    catalog/{components,model}/
    favorites/{components,hooks,state}/
    product-detail/{components,model}/
    cart/{components,hooks,model,state}/
    checkout/{components,hooks,model,state}/
      state/checkout-actions.ts
    orders/{components,hooks,model,state}/
    state/{marketplace-state,create-marketplace-store}.ts
    shared/lib/format-money.ts
    providers/marketplace-providers.tsx
    data/reference.json
    tests/marketplace.test.ts
  styles/marketplace-tokens.css    # Palette, shadcn aliases and base rules only
```

Only folders with actual code exist. Feature presentation stays in components, React coordination in hooks, and pure types/validation/calculation in model. Each feature owns its Zustand slice beside its state and actions. The central state folder contains only the combined state type and the factory that composes slices; the provider creates one store instance per mounted Marketplace layout. Checkout owns the cross-feature action that verifies the cart snapshot, adds an order and clears the cart in one store update. Reusable primitives stay outside feature-specific folders. Generic cross-application primitives remain in packages/ui.

## Composition and state

Pages compose features. MarketplaceSiteHeader composes the shared header, search, primary/mobile navigation, menu and pending feedback on listing/detail/cart/checkout routes. Home composes hero, category/restaurant/product/store collections. ProductDetailPage composes breadcrumbs, image, info, seller, purchase and recommendations. CartReviewPage composes editable items, totals and empty state. CheckoutPage composes local details, review and explicit demo confirmation.

| State                                         | Owner                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Initial product/catalog content               | Read-only data/reference.json                                           |
| Submitted search/category                     | URL; search hooks and pure parser/model                                 |
| Draft input, menus, toasts and local checkout | Component state/hooks                                                   |
| Product ID/quantity lines and drawer          | Cart Zustand slice                                                      |
| Favorite product IDs                          | Favorites Zustand slice                                                 |
| Session-only demo order records               | Orders Zustand slice                                                    |
| Checkout completion across cart/orders        | Checkout action, composed into the same store for one atomic update     |
| Basket counts/subtotals                       | Pure derived functions in cart/model                                    |
| Western-digit money formatting                | shared/lib/format-money.ts                                              |
| Interactive server cache                      | React Query provisioned, unused until separately authorized integration |

The composed store and QueryClient are created once per mounted provider, not mutable module-level singletons. Local state survives client navigation under Marketplace layout but is not persisted on reload. Checkout clears contact fields on success and keeps a product-only demo summary. Basket snapshot comparison prevents clearing changed selections during demo confirmation.

## Styling and UI primitives

Tailwind styles live in components, including responsive/hover/active variants. Shared UI adapters use the existing shadcn-style library, with scoped standard tokens for purple/gold/Tahoma identity. Existing semantic class names may remain as DOM/state hooks; they no longer refer to a component stylesheet. CSS is limited to tokens and base normalization/focus rules. Do not rebuild a giant CSS file or move styles into an opaque class-map module.

Use a reusable component when multiple consumers share its behavior/structure, as with quantity, price, rating and favorites. Product, restaurant and store cards remain distinct. Do not create a large generic component with many behavior flags to force reuse. Native select/radio controls are acceptable until a real shared primitive is needed.

## Verification policy

The user currently performs manual QA. No tests, typecheck, build or browser suite ran for this refactor; source formatting is not runtime validation. Earlier test evidence applies to earlier revisions. Review listing/detail navigation, menus, cart quantities and checkout manually after this change. No visual equality is claimed without measurement.
