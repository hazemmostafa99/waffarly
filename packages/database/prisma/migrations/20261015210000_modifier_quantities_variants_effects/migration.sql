-- AlterTable
ALTER TABLE "product_modifier_group_assignment_options" ADD COLUMN     "maxQuantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "storefront_order_line_selections" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "product_modifier_group_variants" (
    "assignmentId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_modifier_group_variants_pkey" PRIMARY KEY ("assignmentId","variantId")
);

-- CreateTable
CREATE TABLE "product_modifier_option_variants" (
    "assignmentId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "priceAdjustment" DECIMAL(12,2),
    "effectsOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_modifier_option_variants_pkey" PRIMARY KEY ("assignmentId","optionId","variantId")
);

-- CreateTable
CREATE TABLE "product_modifier_effects" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "variantId" UUID,
    "stockItemId" UUID NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "unitCode" VARCHAR(32) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "baseQuantity" DECIMAL(18,6) NOT NULL,
    "baseUnit" VARCHAR(16) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_modifier_effects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_modifier_group_variants_variantId_productId_merchan_idx" ON "product_modifier_group_variants"("variantId", "productId", "merchantId");

-- CreateIndex
CREATE INDEX "product_modifier_option_variants_variantId_productId_mercha_idx" ON "product_modifier_option_variants"("variantId", "productId", "merchantId");

-- CreateIndex
CREATE INDEX "product_modifier_effects_assignmentId_optionId_merchantId_idx" ON "product_modifier_effects"("assignmentId", "optionId", "merchantId");

-- CreateIndex
CREATE INDEX "product_modifier_effects_stockItemId_merchantId_idx" ON "product_modifier_effects"("stockItemId", "merchantId");

-- CreateIndex
CREATE INDEX "product_modifier_effects_variantId_productId_merchantId_idx" ON "product_modifier_effects"("variantId", "productId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_modifier_group_assignments_id_productId_merchantId_key" ON "product_modifier_group_assignments"("id", "productId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_modifier_group_assignment_options_assignmentId_opti_key" ON "product_modifier_group_assignment_options"("assignmentId", "optionId", "merchantId");

-- AddForeignKey
ALTER TABLE "product_modifier_group_variants" ADD CONSTRAINT "product_modifier_group_variants_assignmentId_productId_mer_fkey" FOREIGN KEY ("assignmentId", "productId", "merchantId") REFERENCES "product_modifier_group_assignments"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_group_variants" ADD CONSTRAINT "product_modifier_group_variants_variantId_productId_mercha_fkey" FOREIGN KEY ("variantId", "productId", "merchantId") REFERENCES "product_variants"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_option_variants" ADD CONSTRAINT "product_modifier_option_variants_assignmentId_optionId_mer_fkey" FOREIGN KEY ("assignmentId", "optionId", "merchantId") REFERENCES "product_modifier_group_assignment_options"("assignmentId", "optionId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_option_variants" ADD CONSTRAINT "product_modifier_option_variants_variantId_productId_merch_fkey" FOREIGN KEY ("variantId", "productId", "merchantId") REFERENCES "product_variants"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_option_variants" ADD CONSTRAINT "product_modifier_option_variants_assignmentId_productId_me_fkey" FOREIGN KEY ("assignmentId", "productId", "merchantId") REFERENCES "product_modifier_group_assignments"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_effects" ADD CONSTRAINT "product_modifier_effects_assignmentId_optionId_merchantId_fkey" FOREIGN KEY ("assignmentId", "optionId", "merchantId") REFERENCES "product_modifier_group_assignment_options"("assignmentId", "optionId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_effects" ADD CONSTRAINT "product_modifier_effects_variantId_productId_merchantId_fkey" FOREIGN KEY ("variantId", "productId", "merchantId") REFERENCES "product_variants"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_effects" ADD CONSTRAINT "product_modifier_effects_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_effects" ADD CONSTRAINT "product_modifier_effects_assignmentId_productId_merchantId_fkey" FOREIGN KEY ("assignmentId", "productId", "merchantId") REFERENCES "product_modifier_group_assignments"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep transport bounds and exact effect magnitudes valid for non-HTTP writes.
ALTER TABLE "product_modifier_group_assignment_options" ADD CONSTRAINT "modifier_option_quantity_cap" CHECK ("maxQuantity" BETWEEN 1 AND 99);
ALTER TABLE "storefront_order_line_selections" ADD CONSTRAINT "order_modifier_quantity" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "product_modifier_option_variants" ADD CONSTRAINT "modifier_variant_price" CHECK ("priceAdjustment" IS NULL OR "priceAdjustment" >= 0);
ALTER TABLE "product_modifier_effects" ADD CONSTRAINT "modifier_effect_magnitude" CHECK ("quantity" > 0 AND "baseQuantity" > 0 AND "direction" IN ('ADD', 'REMOVE'));
CREATE UNIQUE INDEX "modifier_default_effect_item" ON "product_modifier_effects" ("assignmentId", "optionId", "stockItemId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "modifier_variant_effect_item" ON "product_modifier_effects" ("assignmentId", "optionId", "variantId", "stockItemId") WHERE "variantId" IS NOT NULL;
