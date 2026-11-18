# Storefront Design Library — Retired

**Status:** Removed on 2026-11-18 at the product owner's direction.

Super Admin no longer manages a shared storefront design library, and merchants
no longer select templates. Merchant appearance remains available through direct
settings for homepage layout, colors, logo display size, and storefront identity.

The `20261118170000_remove_design_library_modules` migration copies each
merchant's selected `menu` or `hero` layout to `merchant_storefronts.layout`
before dropping template relationships and the `storefront_templates` table.
Historical migrations remain unchanged so existing installations can migrate
forward safely.
