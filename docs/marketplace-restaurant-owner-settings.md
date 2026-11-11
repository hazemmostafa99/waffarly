# Restaurant owner settings delivery

2026-11-11. No tests, HTTP checks, browser automation, lint, typecheck or build
were run, per user instruction. Manual review is pending. No migration is needed
for this slice; it uses the previously applied profile/order/menu columns.

## Merchant dashboard

Restaurant merchants now see two additional sections at `/settings`:

- Restaurant profile: actual name, description, cuisines, cover/logo URL or image
  upload through the existing media service, alt text, publication and display order.
- Operations: timezone, always-open mode, weekly multiple periods, dated closure
  or replacement periods, overnight interval guidance, manual order pause/reason.
- Fulfillment: delivery/pickup flags, fixed fee, minimum subtotal, ETA range and
  optional named delivery areas with individual fees and stable IDs.
- Menu: section ordering, product ordering, availability and primary menu section.
  Name/price/images/variants/modifiers continue to use existing Products/Builder
  and Categories pages, linked directly from this section.

Profile saves use `PUT /owner/restaurant`, retain the revision and handle 409
without silently overwriting the draft. Initial 404 permits creation with safe
unpublished/closed defaults. Other load failures block editing and allow retry.
Uploads lock submission while pending; save is explicit. No local persistence of
the form is introduced. Dirty indicators and browser-unload warnings are present;
in-app navigation is not blocked, so save before navigating to another screen.

Successful name changes update dashboard context. Backend name updates also
increment the merchant profile revision and record actor/time. The previous
restaurant-only mock description field in tenant design settings is hidden to
avoid two editors for different description sources. Tenant design settings
otherwise remain available and other business activities retain their view.

## Backend and ownership

Catalog exports MenuSettingsService; Storefront uses that public entry point for
`PUT /owner/restaurant/menu`. Bounded batches (100 categories and 100 products)
are tenant-scoped, restaurant-only and transactional. Each row requires its
revision; one mismatch rolls back the entire batch. Primary sections must already
be assigned to the product and not archived. Repeated IDs are rejected. The
dashboard sends only changed rows, and reloads revisions after saving.

Owner product/category projections now expose display order; products expose the
primary section ID. Marketplace menu reads sort by section order, product order
and stable ID. Existing products without a primary section can still appear through
their active category assignment; archived/hidden primary sections stay excluded.

No new module dependency was introduced (Storefront already imports Catalog).
Frontend contracts are additive. Settings changes affect subsequent API reads and
order eligibility; already created orders retain their frozen fulfillment facts.

## Manual review handoff

Sign in as an existing restaurant owner and open `/settings`. The reference-seed
tenants do not have owner credentials; no account/subscription was created here.
Save a cover/name/description change, then refresh its Marketplace page. Save
hours, an overnight period, a dated closure and pause state. Review delivery fee,
minimum, ETA and area selection in checkout. Change section/product order and
availability and refresh the menu. Open settings in two tabs to review stale-save
handling. These are suggested user steps, not executed checks.
