# Local storefront subdomains: review and implementation plan

Status: first local routing/navigation slice implemented, 2026-11-11; runtime acceptance pending. Remaining slices below are proposed. No deployment changes.
Scope: frontend development preparation; Marketplace remains local-data-only.

Implementation notes: [local setup and pending acceptance](local-storefront-subdomains.md).
Aliases are explicitly configured through `LOCAL_STOREFRONT_ALIASES`, rather than
inventing merchant records or assuming fixture slugs exist in the database. Two
configuration examples are documented; they must be mapped to actual existing
merchant codes before runtime acceptance. Dashboard and Super Admin previews
remain subsequent slices.

## Findings from the repository

- `apps/storefront` is Next.js 16.4.0 on port 3000. There is no current host-routing Proxy. The installed Next docs describe `src/proxy.ts` and internal rewrites. Their `allowedDevOrigins` docs say localhost and its subdomains are already allowed; do not add permissive origin settings unnecessarily.
- Merchant routes live under `/s/[slug]`. The layout and catalog loader resolve the existing slug through the existing API. This existing tenant storefront is distinct from Marketplace's local fixtures.
- Marketplace lives under `/marketplace`; `/` currently renders a business landing page. Moving Marketplace to `/` also requires preserving a deliberate destination for that landing page.
- Storefront header, footer, product, cart and checkout navigation embed `/s/...` (24 matching source lines at review). Host routing alone would leave these links exposing the old path.
- Super Admin runs on 5173, Merchant Dashboard on 5174, POS on 5175; Vite configs currently only register plugins. Keep these ports initially; a hostname alone does not select an application port.
- Super Admin creation and application approval do not accept a public URL handle. Creation posts the existing `CreateMerchantRequest`; the result exposes `businessCode`.
- `merchant.service.ts` generates `storefrontSlug` from up to 80 name characters plus a full UUID. Arabic-only names fall back to `store-<uuid>`. Some generated values exceed the 63-character limit for a DNS label and cannot be used directly as a subdomain.
- That slug is also returned as `businessCode` and used by POS employee login. Do not rename it to shorten public links.
- Merchant Dashboard's `StorefrontSettings.tsx` and `features/account/AccountPage.tsx` generate path-based public links using `VITE_STOREFRONT_BASE_URL`.
- The tenant cart is persisted with a slug-specific key. Different subdomains also have different browser storage origins; do not promise automatic migration of an old localhost basket.
- Existing API CORS and unsafe-request origin checks use an explicit origin list. Existing tenant-storefront browser operations on new origins need a separate compatibility review; a Next dev-origin setting does not change API authorization or CORS.
- The working tree already contains Marketplace account, checkout, order/tracking and documentation changes. Preserve them.

## Proposed decisions

1. Keep the technical slug / POS business code stable. Introduce a conceptual public handle, such as `abo-ali`, separately. This plan does not add a production contract or database field.
2. Start with a development alias fixture mapping public handles to existing technical slugs. Fixtures contain identifiers only, never customer or login data. Existing tenant rendering can use its established data source; Marketplace must not consume it.
3. In local-only demonstrations, validate lower-case ASCII letters, digits and internal hyphens, with a proposed length of 3–63 characters. Reserve application names, including `admin`, `pos`, `api`, `www`, `dashboard`, `merchant`, `marketplace` and `business`. Final production rules remain for the later persistence phase.
4. Keep domain, scheme and ports configurable. Do not hardcode either afrad.com or waffarly.com; confirm the production base domain at deployment.
5. Treat local routing and actual durable handle reservation as different deliverables. A frontend availability check is advisory, not a global uniqueness guarantee.

## Delivery order

### 1. Shared address rules and local fixtures

- Add a small frontend-safe module for host classification, reserved names and URL construction, shared only where needed. Use existing package boundaries; do not put frontend configuration into API transport contracts.
- Parse hostname separately from port, require the configured domain suffix, normalize case, and reject nested or invalid tenant labels.
- Create an explicit development alias fixture for two merchants. For a completely API-free demonstration, use separately labeled local storefront scenarios; do not silently replace missing API data with mock data.
- Do not use cross-origin localStorage to share aliases between Super Admin and storefront; it cannot provide that behavior. Both apps read the same source fixture. Changes to that fixture require reload/restart as appropriate.

### 2. Storefront host routing

- Add a minimal Next Proxy using the installed package docs. Resolve only local configuration/aliases here; do not fetch merchant catalogs or manage sessions in Proxy.
- Rewrite `abo-ali.localhost:3000/…` internally to `/s/<existing-slug>/…`, retaining query parameters and the visible public URL.
- Skip Next internals, public assets and framework navigation requests as appropriate. Prevent rewrite loops, merchant-host access to another `/s/<slug>` and accidental Marketplace exposure on merchant hosts.
- Reject reserved application hosts arriving at storefront's port; do not interpret `admin` or `pos` as merchants or silently redirect to a different app.
- Unknown handles receive a clear unavailable/not-found outcome.
- Initially preserve `/s/[slug]` and `/marketplace` for compatibility. Use `marketplace.localhost:3000` as an optional local Marketplace entry while retaining the current business homepage at `localhost:3000`. Route its pages within `/marketplace`; keep navigation consistent with this transitional arrangement.
- Moving the bare root to Marketplace is a later explicit slice: move the business landing to `/business`, review shared `/join` and layouts, update Marketplace links and retain legacy entry links.

### 3. Public navigation and Merchant Dashboard links

- Replace embedded tenant path construction with one consistent URL/path builder and explicit route context.
- On a merchant host, links use `/menu`, `/products/...`, `/cart`, `/checkout`, account and order paths. On legacy path entry, retain working `/s/<slug>/...` links.
- Update Dashboard account/settings links. Use the development alias where known; retain the legacy URL where no public handle exists instead of inventing a mapping.
- Keep carts, favorites, query caches, metadata and any local demo state tenant-scoped. Marketplace state remains separate.
- Do not copy baskets or session tokens between origins. Explain the existing-storage limitation in development notes.

### 4. Super Admin frontend preparation

- Design an explicitly labeled local address preview beside creation, after creation, and on merchant details. Include handle syntax/reserved-name feedback, full URL preview, copy and open actions.
- Keep current merchant creation/approval payloads unchanged. Do not make an address draft look saved by a successful real merchant creation response.
- A source-fixture alias can be opened for demo merchants. An arbitrary draft is only a preview and must not claim its store is provisioned or that its name is globally available.
- Show POS business code separately from public store address. Existing merchants without an alias show the legacy link plus an honest unassigned state.
- Cover both manual creation and merchant-application approval in the UI design, without extending their existing API contracts in this phase.

### 5. Development applications and compatibility

- Start with current app ports: storefront 3000, admin 5173, merchant dashboard 5174, POS 5175. Optional host aliases are `admin.localhost:5173`, `dashboard.localhost:5174`, `pos.localhost:5175`; verify tool support before changing their documented entry URLs.
- Prefer ordinary localhost ports for existing authenticated apps initially, to avoid unnecessary session-origin changes. No local reverse proxy is required for the first slice.
- Document Chrome/Edge entry URLs and explicit Windows hosts entries as a fallback if local name resolution fails. Hosts files do not support wildcard entries.
- Review HMR/assets and framework dev-origin behavior against installed Next/Vite docs. Preserve login origins; do not widen API CORS or share cookies across subdomains as a shortcut.
- Full existing tenant API behavior on new merchant origins is not proven by rendering the homepage. Record browser-read/write restrictions as a separate compatibility item; do not bypass origin protections or add a mock HTTP backend.

### 6. Manual acceptance

- Open two alias merchants; verify identity, direct links, refresh, Back/Forward, query parameters and invalid names.
- Navigate product -> cart -> checkout and account/order views; verify visible URLs stay on the intended host and tenant state does not mix.
- Verify unknown/reserved hosts and cross-merchant legacy paths cannot expose another tenant.
- Verify Marketplace stays on its fixtures, makes no backend requests and retains its explicitly simulated checkout/account flows.
- Verify existing admin, dashboard, POS and legacy storefront entry routes still work.
- Verify preview/copy/open actions, and that unsaved address drafts are never presented as saved reservations.
- Current repository preference is manual QA. Do not run browser suites, tests, typechecks or builds without a separate request. Record actual manual evidence and limitations; do not claim acceptance from this planning review.

## Explicitly deferred

- Durable public-handle storage, globally unique reservation, concurrent duplicate handling, rename/history rules, ownership and API contracts. These need a separately authorized backend slice under API ownership rules. Frontend-only work cannot deliver real create-and-open provisioning for arbitrary new merchants.
- Marketplace backend integration, commission attribution, real order/payment changes and authentication redesign.
- Cloudflare wildcard records, VPS reverse proxy configuration, trusted forwarded-host handling, origin certificates, HTTPS and production domain migration. No changes to existing DNS or deployed applications in this development plan.

## First implementation slice

Implement address rules + two explicit development aliases + merchant host rewrite + navigation updates. Demonstrate both merchants locally before adding Super Admin address preview UI. This makes the proposed address behavior reviewable without changing technical merchant identifiers, API contracts or deployment.
