ALTER TABLE "products"
ADD COLUMN "sellingUnit" VARCHAR(16) NOT NULL DEFAULT 'piece';

ALTER TABLE "products"
ADD CONSTRAINT "products_sellingUnit_check" CHECK ("sellingUnit" = 'piece');

CREATE TABLE "product_modifier_groups" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "selectionMode" VARCHAR(16) NOT NULL,
    "minSelections" INTEGER NOT NULL,
    "maxSelections" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_modifier_groups_id_productId_merchantId_key" UNIQUE ("id", "productId", "merchantId"),
    CONSTRAINT "product_modifier_groups_productId_merchantId_fkey"
      FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_modifier_groups_selectionMode_check" CHECK ("selectionMode" IN ('single', 'multiple')),
    CONSTRAINT "product_modifier_groups_selection_bounds_check" CHECK (
      "minSelections" >= 0 AND "maxSelections" > 0 AND "minSelections" <= "maxSelections"
    ),
    CONSTRAINT "product_modifier_groups_position_check" CHECK ("position" >= 0),
    CONSTRAINT "product_modifier_groups_single_max_check" CHECK ("selectionMode" <> 'single' OR "maxSelections" = 1)
);

CREATE INDEX "product_modifier_groups_merchantId_productId_idx"
ON "product_modifier_groups"("merchantId", "productId");
CREATE INDEX "product_modifier_groups_productId_position_idx"
ON "product_modifier_groups"("productId", "position");

CREATE TABLE "product_modifier_options" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultSelected" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_modifier_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_modifier_options_id_groupId_key" UNIQUE ("id", "groupId"),
    CONSTRAINT "product_modifier_options_groupId_productId_merchantId_fkey"
      FOREIGN KEY ("groupId", "productId", "merchantId")
      REFERENCES "product_modifier_groups"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_modifier_options_priceAdjustment_check" CHECK ("priceAdjustment" >= 0),
    CONSTRAINT "product_modifier_options_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "product_modifier_options_groupId_position_idx"
ON "product_modifier_options"("groupId", "position");
