# Merchant Storefront Branding

Restaurant identity and independent storefront styling have separate owners.

- Merchant name and RestaurantProfile description, logoImage, and coverImage
  define the restaurant identity. The same logo is projected into account and
  storefront responses. The public tenant storefront uses the restaurant cover
  in its hero; Waffarly restaurant listings continue to use the same profile
  image fields.
- MerchantStorefront owns the independent storefront template, primary and
  accent colors, page and card backgrounds, logo display size, and revision.
  These values affect the merchant storefront at /s/[slug] and its assigned host.
- Media uploads use the existing owner-scoped catalog media endpoint, which
  accepts JPEG, PNG, and WebP images up to 10 MB. New non-restaurant storefront
  logos are saved as uploaded media URLs. Existing inline logo data remains
  readable; for restaurants, it is only a fallback when no identity logo exists.
- The storefront contract exposes the identity logo and cover alongside the
  tenant-specific palette. Public colors are validated as six-digit HEX values;
  logo display size is restricted to small, medium, or large. Published catalog
  changes refresh on the storefront within 60 seconds.

The 20261118150000_storefront_brand_controls migration renames each saved
storefront accent value to the primary color, preserving existing merchant
choices. It adds the other palette fields and logo size with defaults and
database checks. The migration is additive to existing merchant identity data.

Manual acceptance should cover logo and cover upload at the 10 MB limit, shared
identity in Waffarly and the independent storefront, palette and logo-size save
after reload, mobile and desktop previews, and the settings navigation warning
for unsaved edits.
