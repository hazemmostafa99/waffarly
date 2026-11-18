ALTER TABLE "merchant_storefronts"
    RENAME COLUMN "accentColor" TO "primaryColor";

ALTER TABLE "merchant_storefronts"
    RENAME CONSTRAINT "merchant_storefronts_color_check"
    TO "merchant_storefronts_primary_color_check";

ALTER TABLE "merchant_storefronts"
    ADD COLUMN "accentColor" VARCHAR(7) NOT NULL DEFAULT '#F5B544',
    ADD COLUMN "backgroundColor" VARCHAR(7) NOT NULL DEFAULT '#FAF8F4',
    ADD COLUMN "surfaceColor" VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    ADD COLUMN "logoScale" VARCHAR(10) NOT NULL DEFAULT 'medium';

ALTER TABLE "merchant_storefronts"
    ADD CONSTRAINT "merchant_storefronts_accent_color_check"
        CHECK ("accentColor" ~ '^#[0-9a-fA-F]{6}$'),
    ADD CONSTRAINT "merchant_storefronts_background_color_check"
        CHECK ("backgroundColor" ~ '^#[0-9a-fA-F]{6}$'),
    ADD CONSTRAINT "merchant_storefronts_surface_color_check"
        CHECK ("surfaceColor" ~ '^#[0-9a-fA-F]{6}$'),
    ADD CONSTRAINT "merchant_storefronts_logo_scale_check"
        CHECK ("logoScale" IN ('small', 'medium', 'large'));
