ALTER TABLE "merchant_storefronts"
    ADD COLUMN "heroTitle" VARCHAR(80),
    ADD COLUMN "heroEmphasis" VARCHAR(80),
    ADD COLUMN "heroShade" VARCHAR(10) NOT NULL DEFAULT 'medium',
    ADD CONSTRAINT "merchant_storefronts_hero_shade_check"
        CHECK ("heroShade" IN ('light', 'medium', 'strong'));
