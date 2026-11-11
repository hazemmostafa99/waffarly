# Marketplace visual comparison

Latest navigation additions: original homepage styling is retained, with new
token-based menu/dialog styles and functional header/mobile actions. No new visual
comparison or screenshot is available because browser initialization still fails.
See [navigation verification](marketplace-navigation.md) for nonvisual checks and
the outstanding keyboard/history/responsive checklist.

## Current evidence

The public HTML/CSS/JS was fetched successfully on 2026-11-11 (Africa/Cairo), after an elevated read-only request bypassed a blocked sandbox proxy. The original logo was downloaded. Full source snapshot: `reference/marketplace/source.html`; asset URLs: [assets manifest](assets-manifest.md).

The page now uses extracted source values, all 8 categories, 12 restaurants, 5 products and 6 stores. Source CSS declarations, responsive rules and asset URLs were retained, with selectors scoped to avoid affecting other applications. Local normalization compensates for Tailwind preflight and shared global heading styles; its rendered result still needs verification.

## Not measured

Nonvisual validation passed: TypeScript, 3 focused logic tests, production build, and HTTP 200 with expected SSR product/restaurant counts. These results do not establish visual fidelity.

No screenshots, rendered computed-style measurements, image diff score, hover screenshots or browser interaction results are available. The browser tool still fails during initialization with a missing sandboxPolicy field. Source parity is not proof of pixel parity. No 100% match claim is made.

## Next validation

At widths 1440, 1024, 768, 390 and 375, capture reference/local screenshots at equal heights, locale, scroll position, loaded-image state and countdown. Compare initial viewport and full page, category selection, submitted search, empty search, favorite, duplicate cart lines, cart removal/total, drawer focus and mobile horizontal scrolling. Record actual image diff thresholds/results and fix measured differences. Confirm no console errors. External image failures and system-font differences must be noted separately.
