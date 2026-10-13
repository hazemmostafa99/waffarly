INSERT INTO "storefront_templates" (
    "id", "key", "name", "description", "activity", "layout",
    "accentColor", "status", "revision", "updatedBy", "createdAt", "updatedAt"
) VALUES
    (
        '0fbdb3f5-222b-47fb-a793-827898d63b81', 'garden-table', 'The Garden Table',
        'A calm, menu-first design for neighborhood restaurants and relaxed cafés.',
        'restaurant', 'menu', '#315B43', 'available', 1, 'Waffarly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        '7a8504d8-8b11-4d9d-a1fb-c2833cb52094', 'golden-hour', 'Golden Hour',
        'A warm, story-first design for restaurants with a dish worth remembering.',
        'restaurant', 'hero', '#A25A3C', 'available', 1, 'Waffarly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE "merchant_storefronts" (
    "merchantId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "accentColor" VARCHAR(7) NOT NULL DEFAULT '#315B43',
    "logoData" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_storefronts_pkey" PRIMARY KEY ("merchantId"),
    CONSTRAINT "merchant_storefronts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "merchant_storefronts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "storefront_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "merchant_storefronts_color_check" CHECK ("accentColor" ~ '^#[0-9a-fA-F]{6}$'),
    CONSTRAINT "merchant_storefronts_revision_check" CHECK ("revision" > 0)
);

CREATE INDEX "merchant_storefronts_templateId_idx" ON "merchant_storefronts"("templateId");
