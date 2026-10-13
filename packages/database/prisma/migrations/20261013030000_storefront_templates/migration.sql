CREATE TABLE "storefront_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "activity" VARCHAR(32) NOT NULL,
    "layout" VARCHAR(32) NOT NULL,
    "accentColor" VARCHAR(7) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "storefront_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "storefront_templates_activity_check" CHECK ("activity" = 'restaurant'),
    CONSTRAINT "storefront_templates_layout_check" CHECK ("layout" IN ('menu', 'hero')),
    CONSTRAINT "storefront_templates_status_check" CHECK ("status" IN ('draft', 'available')),
    CONSTRAINT "storefront_templates_color_check" CHECK ("accentColor" ~ '^#[0-9a-fA-F]{6}$'),
    CONSTRAINT "storefront_templates_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "storefront_templates_key_key" ON "storefront_templates"("key");
CREATE INDEX "storefront_templates_activity_status_idx" ON "storefront_templates"("activity", "status");
