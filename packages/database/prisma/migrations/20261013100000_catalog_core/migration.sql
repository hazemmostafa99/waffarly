CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_assets_id_merchantId_key" UNIQUE ("id", "merchantId"),
    CONSTRAINT "media_assets_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "media_assets_sizeBytes_check" CHECK ("sizeBytes" > 0)
);

CREATE UNIQUE INDEX "media_assets_merchantId_storageKey_key" ON "media_assets"("merchantId", "storageKey");
CREATE INDEX "media_assets_merchantId_createdAt_idx" ON "media_assets"("merchantId", "createdAt");

CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "imageAssetId" UUID NOT NULL,
    "parentId" UUID,
    "availability" VARCHAR(16) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(80) NOT NULL,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_id_merchantId_key" UNIQUE ("id", "merchantId"),
    CONSTRAINT "categories_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "categories_imageAsset_merchant_fkey" FOREIGN KEY ("imageAssetId", "merchantId") REFERENCES "media_assets"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "categories_parent_merchant_fkey" FOREIGN KEY ("parentId", "merchantId") REFERENCES "categories"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "categories_availability_check" CHECK ("availability" IN ('available', 'unavailable')),
    CONSTRAINT "categories_revision_check" CHECK ("revision" > 0)
);

CREATE INDEX "categories_merchantId_availability_archivedAt_idx" ON "categories"("merchantId", "availability", "archivedAt");
CREATE INDEX "categories_merchantId_parentId_idx" ON "categories"("merchantId", "parentId");

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "basePrice" DECIMAL(12,2) NOT NULL,
    "availability" VARCHAR(16) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(80) NOT NULL,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_id_merchantId_key" UNIQUE ("id", "merchantId"),
    CONSTRAINT "products_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_basePrice_check" CHECK ("basePrice" > 0),
    CONSTRAINT "products_availability_check" CHECK ("availability" IN ('available', 'unavailable')),
    CONSTRAINT "products_revision_check" CHECK ("revision" > 0)
);

CREATE INDEX "products_merchantId_availability_archivedAt_idx" ON "products"("merchantId", "availability", "archivedAt");

CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_images_product_merchant_fkey" FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_images_media_merchant_fkey" FOREIGN KEY ("mediaAssetId", "merchantId") REFERENCES "media_assets"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_images_position_check" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "product_images_productId_mediaAssetId_key" ON "product_images"("productId", "mediaAssetId");
CREATE UNIQUE INDEX "product_images_one_primary_idx" ON "product_images"("productId") WHERE "isPrimary" = true;
CREATE INDEX "product_images_productId_position_idx" ON "product_images"("productId", "position");
CREATE INDEX "product_images_merchantId_productId_idx" ON "product_images"("merchantId", "productId");

CREATE TABLE "product_categories" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("productId", "categoryId"),
    CONSTRAINT "product_categories_product_merchant_fkey" FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_categories_category_merchant_fkey" FOREIGN KEY ("categoryId", "merchantId") REFERENCES "categories"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "product_categories_categoryId_productId_idx" ON "product_categories"("categoryId", "productId");
CREATE INDEX "product_categories_merchantId_productId_idx" ON "product_categories"("merchantId", "productId");
