ALTER TABLE "products"
ADD COLUMN "inventoryConfigurationRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "product_inventory_configurations" (
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_inventory_configurations_pkey" PRIMARY KEY ("productId", "merchantId"),
  CONSTRAINT "product_inventory_configurations_mode_check" CHECK ("mode" IN ('DIRECT', 'RECIPE')),
  CONSTRAINT "product_inventory_configurations_productId_merchantId_fkey"
    FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "product_inventory_targets" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "variantId" UUID,
  CONSTRAINT "product_inventory_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_inventory_targets_id_productId_merchantId_key" UNIQUE ("id", "productId", "merchantId"),
  CONSTRAINT "product_inventory_targets_configuration_fkey"
    FOREIGN KEY ("productId", "merchantId") REFERENCES "product_inventory_configurations"("productId", "merchantId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_inventory_targets_variant_fkey"
    FOREIGN KEY ("variantId", "productId", "merchantId") REFERENCES "product_variants"("id", "productId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "product_inventory_targets_base_key"
ON "product_inventory_targets"("productId", "merchantId") WHERE "variantId" IS NULL;

CREATE UNIQUE INDEX "product_inventory_targets_variant_key"
ON "product_inventory_targets"("productId", "merchantId", "variantId") WHERE "variantId" IS NOT NULL;

CREATE INDEX "product_inventory_targets_merchantId_productId_idx"
ON "product_inventory_targets"("merchantId", "productId");

CREATE TABLE "product_inventory_components" (
  "id" UUID NOT NULL,
  "targetId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "unitCode" VARCHAR(32) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "baseQuantity" DECIMAL(18,6) NOT NULL,
  "baseUnit" VARCHAR(16) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_inventory_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_inventory_components_targetId_position_key" UNIQUE ("targetId", "position"),
  CONSTRAINT "product_inventory_components_target_fkey"
    FOREIGN KEY ("targetId", "productId", "merchantId") REFERENCES "product_inventory_targets"("id", "productId", "merchantId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_inventory_components_stockItem_fkey"
    FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_inventory_components_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "product_inventory_components_baseQuantity_check" CHECK ("baseQuantity" > 0),
  CONSTRAINT "product_inventory_components_baseUnit_check" CHECK ("baseUnit" IN ('piece', 'g', 'kg', 'ml', 'l')),
  CONSTRAINT "product_inventory_components_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "product_inventory_components_merchantId_stockItemId_idx"
ON "product_inventory_components"("merchantId", "stockItemId");
