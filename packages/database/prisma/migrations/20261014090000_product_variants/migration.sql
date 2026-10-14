CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(80),
    "barcode" VARCHAR(80),
    "price" DECIMAL(12,2) NOT NULL,
    "stockQuantity" INTEGER,
    "availability" VARCHAR(16) NOT NULL DEFAULT 'available',
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_productId_merchantId_fkey"
      FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_variants_name_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "product_variants_price_check" CHECK ("price" > 0),
    CONSTRAINT "product_variants_stockQuantity_check" CHECK ("stockQuantity" IS NULL OR "stockQuantity" >= 0),
    CONSTRAINT "product_variants_availability_check" CHECK ("availability" IN ('available', 'unavailable')),
    CONSTRAINT "product_variants_position_check" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "product_variants_merchantId_sku_key"
ON "product_variants"("merchantId", "sku");

CREATE UNIQUE INDEX "product_variants_merchantId_barcode_key"
ON "product_variants"("merchantId", "barcode");

CREATE INDEX "product_variants_merchantId_productId_idx"
ON "product_variants"("merchantId", "productId");

CREATE INDEX "product_variants_productId_position_idx"
ON "product_variants"("productId", "position");
