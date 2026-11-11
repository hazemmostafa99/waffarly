# Marketplace limitations

## Reference access

- Public source HTML/CSS/JS and the original logo are now accessible through elevated read-only HTTP requests. Earlier network-tool failures did not mean the site was unavailable.
- Browser automation initialization remains blocked by a missing sandboxPolicy field. No rendered inspection, screenshots or browser interaction testing has been completed.
- The four user-mentioned extraction files are still absent. Downloaded reference source is the evidence for current implementation.
- Source behavior is code-reviewed, not browser-verified. Only one page and its exposed fragment links are known.

## Implementation

- Marketplace lives at /marketplace; existing business landing and tenant stores are preserved.
- Original CSS values, content and asset URLs are used. Scoped CSS includes local preflight compensation whose pixel accuracy is unmeasured.
- Product/restaurant/category/store images still use their original external Unsplash URLs. Availability and rendering may depend on network/CDN. The original logo is local; no substitute images were introduced. No ownership or licensing claim is made for third-party images.
- Original placeholder links and unhandled buttons remain unimplemented. Checkout, auth, quantity changes and server persistence are not exposed by inspected source and were not invented.
- React Query is ready but not used for static extracted data. No API/database/shared contract was changed.
- Cart focus/keyboard support and category keyboard access are local accessibility additions, pending browser checks.
- Font is the original system Tahoma stack; platform font availability and emoji rendering can affect matching.

## Validation

Current reconstruction validation (2026-11-11):

- TypeScript `--noEmit`: passed.
- Focused tests: 3 passed (Arabic search/category intersection and empty results; duplicate cart lines, total, removal and store isolation; favorite toggling).
- Production build: passed after retrying a Next.js security-advisory pause. The installed Next.js version emits a known-vulnerability warning; review and upgrade it before deployment. No dependency versions were changed here.
- Production HTTP smoke check: `/marketplace` returned 200; server-rendered HTML included 5 products, 12 restaurants, categories, deals, cart drawer and local logo.
- Browser interaction, console and image-diff checks: not run, due to the browser initialization failure above.
- Environment Node is 20.19.0; repository requires >=24.11.0 <25. Use the repository-supported version for development and CI.

## Cleanup/refactor verification

Marketplace components are now grouped into home, navigation, catalog and cart; the store/provider are feature-owned. Unused menu state and redundant root router declarations were removed. Existing dashboard router dependencies remain. See [cleanup audit](marketplace-cleanup.md) and [architecture](marketplace-architecture.md).

After cleanup, storefront, both dashboard apps and shared UI typechecks passed; the 3 marketplace behavior tests and production build passed. A production HTTP check returned 200 with 8 categories, 12 restaurants, 5 products, 6 stores, cart and mobile navigation. This does not replace browser visual or interaction validation.

The offline lockfile update succeeded. The attempt to synchronize installed packages aborted before node_modules replacement because pnpm required a TTY. Existing modules were preserved; synchronize them with `pnpm install --frozen-lockfile` using the supported Node version. No dependency versions were upgraded and the existing Next.js security advisory still requires remediation before deployment.
