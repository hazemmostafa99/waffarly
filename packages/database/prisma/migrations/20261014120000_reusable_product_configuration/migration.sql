-- Preserve the product-local group identifiers as assignment IDs. Shared group
-- definitions receive new IDs so existing storefront selections remain valid.
CREATE TEMP TABLE "_modifier_group_migration_map" (
  "assignmentId" UUID PRIMARY KEY,
  "modifierGroupId" UUID NOT NULL UNIQUE
);

INSERT INTO "_modifier_group_migration_map" ("assignmentId", "modifierGroupId")
SELECT "id", gen_random_uuid()
FROM "product_modifier_groups";

CREATE TABLE "modifier_groups" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "modifier_groups_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "modifier_groups_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "modifier_groups_name_check" CHECK (length(btrim("name")) > 0)
);

CREATE INDEX "modifier_groups_merchantId_name_idx"
ON "modifier_groups"("merchantId", "name");

CREATE TABLE "modifier_options" (
  "id" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "modifier_options_id_groupId_merchantId_key" UNIQUE ("id", "groupId", "merchantId"),
  CONSTRAINT "modifier_options_groupId_merchantId_fkey"
    FOREIGN KEY ("groupId", "merchantId") REFERENCES "modifier_groups"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "modifier_options_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "modifier_options_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "modifier_options_groupId_position_idx"
ON "modifier_options"("groupId", "position");

CREATE TABLE "product_modifier_group_assignments" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "modifierGroupId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "selectionMode" VARCHAR(16) NOT NULL,
  "minSelections" INTEGER NOT NULL,
  "maxSelections" INTEGER NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_modifier_group_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_modifier_group_assignments_id_group_merchant_key"
    UNIQUE ("id", "modifierGroupId", "merchantId"),
  CONSTRAINT "product_modifier_group_assignments_product_group_key"
    UNIQUE ("productId", "modifierGroupId"),
  CONSTRAINT "product_modifier_group_assignments_product_merchant_fkey"
    FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_modifier_group_assignments_group_merchant_fkey"
    FOREIGN KEY ("modifierGroupId", "merchantId") REFERENCES "modifier_groups"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_modifier_group_assignments_selectionMode_check"
    CHECK ("selectionMode" IN ('single', 'multiple')),
  CONSTRAINT "product_modifier_group_assignments_selection_bounds_check"
    CHECK ("minSelections" >= 0 AND "maxSelections" > 0 AND "minSelections" <= "maxSelections"),
  CONSTRAINT "product_modifier_group_assignments_single_max_check"
    CHECK ("selectionMode" <> 'single' OR "maxSelections" = 1),
  CONSTRAINT "product_modifier_group_assignments_position_check"
    CHECK ("position" >= 0)
);

CREATE INDEX "product_modifier_group_assignments_merchantId_productId_idx"
ON "product_modifier_group_assignments"("merchantId", "productId");

CREATE INDEX "product_modifier_group_assignments_productId_position_idx"
ON "product_modifier_group_assignments"("productId", "position");

CREATE TABLE "product_modifier_group_assignment_options" (
  "assignmentId" UUID NOT NULL,
  "modifierGroupId" UUID NOT NULL,
  "optionId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "defaultSelected" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "product_modifier_group_assignment_options_pkey" PRIMARY KEY ("assignmentId", "optionId"),
  CONSTRAINT "product_modifier_group_assignment_options_assignment_fkey"
    FOREIGN KEY ("assignmentId", "modifierGroupId", "merchantId")
    REFERENCES "product_modifier_group_assignments"("id", "modifierGroupId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_modifier_group_assignment_options_option_fkey"
    FOREIGN KEY ("optionId", "modifierGroupId", "merchantId")
    REFERENCES "modifier_options"("id", "groupId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_modifier_group_assignment_options_price_check"
    CHECK ("priceAdjustment" >= 0)
);

CREATE INDEX "product_modifier_group_assignment_options_optionId_idx"
ON "product_modifier_group_assignment_options"("optionId");

-- One shared definition is created for every previous product-local group.
INSERT INTO "modifier_groups" ("id", "merchantId", "name", "description")
SELECT migration."modifierGroupId", old_group."merchantId", old_group."name", old_group."description"
FROM "product_modifier_groups" AS old_group
JOIN "_modifier_group_migration_map" AS migration ON migration."assignmentId" = old_group."id";

INSERT INTO "modifier_options" ("id", "groupId", "merchantId", "name", "position")
SELECT old_option."id", migration."modifierGroupId", old_option."merchantId", old_option."name", old_option."position"
FROM "product_modifier_options" AS old_option
JOIN "_modifier_group_migration_map" AS migration ON migration."assignmentId" = old_option."groupId";

INSERT INTO "product_modifier_group_assignments" (
  "id", "productId", "modifierGroupId", "merchantId", "selectionMode", "minSelections", "maxSelections", "position"
)
SELECT old_group."id", old_group."productId", migration."modifierGroupId", old_group."merchantId",
       old_group."selectionMode", old_group."minSelections", old_group."maxSelections", old_group."position"
FROM "product_modifier_groups" AS old_group
JOIN "_modifier_group_migration_map" AS migration ON migration."assignmentId" = old_group."id";

INSERT INTO "product_modifier_group_assignment_options" (
  "assignmentId", "modifierGroupId", "optionId", "merchantId", "priceAdjustment", "defaultSelected"
)
SELECT old_option."groupId", migration."modifierGroupId", old_option."id", old_option."merchantId",
       old_option."priceAdjustment", old_option."defaultSelected"
FROM "product_modifier_options" AS old_option
JOIN "_modifier_group_migration_map" AS migration ON migration."assignmentId" = old_option."groupId";

DO $$
DECLARE
  old_group_count BIGINT;
  new_group_count BIGINT;
  new_assignment_count BIGINT;
  old_option_count BIGINT;
  new_option_count BIGINT;
  old_assignment_count BIGINT;
BEGIN
  SELECT count(*) INTO old_group_count FROM "product_modifier_groups";
  SELECT count(*) INTO new_group_count FROM "modifier_groups";
  SELECT count(*) INTO new_assignment_count FROM "product_modifier_group_assignments";
  SELECT count(*) INTO old_option_count FROM "product_modifier_options";
  SELECT count(*) INTO new_option_count FROM "product_modifier_group_assignment_options";
  SELECT count(*) INTO old_assignment_count FROM "product_modifier_groups";

  IF new_group_count <> old_group_count OR new_assignment_count <> old_assignment_count OR new_option_count <> old_option_count THEN
    RAISE EXCEPTION 'Modifier migration count check failed: old groups %, new groups %, old assignments %, new assignments %, old options %, assignment-options %',
      old_group_count, new_group_count, old_assignment_count, new_assignment_count, old_option_count, new_option_count;
  END IF;
END $$;

DROP TABLE "product_modifier_options";
DROP TABLE "product_modifier_groups";
DROP TABLE "_modifier_group_migration_map";

CREATE TABLE "product_variant_attributes" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_variant_attributes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variant_attributes_id_product_merchant_key" UNIQUE ("id", "productId", "merchantId"),
  CONSTRAINT "product_variant_attributes_product_merchant_fkey"
    FOREIGN KEY ("productId", "merchantId") REFERENCES "products"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_variant_attributes_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "product_variant_attributes_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "product_variant_attributes_productId_position_idx"
ON "product_variant_attributes"("productId", "position");

CREATE TABLE "product_variant_attribute_values" (
  "id" UUID NOT NULL,
  "attributeId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "value" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_variant_attribute_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variant_attribute_values_id_attribute_product_merchant_key"
    UNIQUE ("id", "attributeId", "productId", "merchantId"),
  CONSTRAINT "product_variant_attribute_values_attribute_product_merchant_fkey"
    FOREIGN KEY ("attributeId", "productId", "merchantId")
    REFERENCES "product_variant_attributes"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_variant_attribute_values_value_check" CHECK (length(btrim("value")) > 0),
  CONSTRAINT "product_variant_attribute_values_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "product_variant_attribute_values_attributeId_position_idx"
ON "product_variant_attribute_values"("attributeId", "position");

CREATE UNIQUE INDEX "product_variants_id_productId_merchantId_key"
ON "product_variants"("id", "productId", "merchantId");

CREATE TABLE "product_variant_attribute_selections" (
  "variantId" UUID NOT NULL,
  "attributeId" UUID NOT NULL,
  "valueId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  CONSTRAINT "product_variant_attribute_selections_pkey" PRIMARY KEY ("variantId", "attributeId"),
  CONSTRAINT "product_variant_attribute_selections_variant_value_key" UNIQUE ("variantId", "valueId"),
  CONSTRAINT "product_variant_attribute_selections_variant_product_merchant_fkey"
    FOREIGN KEY ("variantId", "productId", "merchantId")
    REFERENCES "product_variants"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_variant_attribute_selections_attribute_product_merchant_fkey"
    FOREIGN KEY ("attributeId", "productId", "merchantId")
    REFERENCES "product_variant_attributes"("id", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_variant_attribute_selections_value_attribute_product_merchant_fkey"
    FOREIGN KEY ("valueId", "attributeId", "productId", "merchantId")
    REFERENCES "product_variant_attribute_values"("id", "attributeId", "productId", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_variant_attribute_selections_merchant_attribute_value_idx"
ON "product_variant_attribute_selections"("merchantId", "attributeId", "valueId");

ALTER TABLE "storefront_order_lines"
ADD COLUMN "basePrice" DECIMAL(12,2),
ADD COLUMN "modifierTotal" DECIMAL(12,2),
ADD CONSTRAINT "storefront_order_lines_basePrice_check" CHECK ("basePrice" IS NULL OR "basePrice" >= 0),
ADD CONSTRAINT "storefront_order_lines_modifierTotal_check" CHECK ("modifierTotal" IS NULL OR "modifierTotal" >= 0);

ALTER TABLE "storefront_order_line_selections"
ADD COLUMN "modifierGroupId" UUID,
ADD COLUMN "modifierOptionId" UUID;

CREATE INDEX "storefront_order_line_selections_modifierOptionId_idx"
ON "storefront_order_line_selections"("modifierOptionId");

CREATE TABLE "storefront_order_line_variant_attributes" (
  "id" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "attributeId" UUID,
  "valueId" UUID,
  "attributeName" VARCHAR(120) NOT NULL,
  "attributeValue" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "storefront_order_line_variant_attributes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_order_line_variant_attributes_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "storefront_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_variant_attributes_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "storefront_order_line_variant_attributes_line_position_idx"
ON "storefront_order_line_variant_attributes"("orderLineId", "position");

CREATE INDEX "storefront_order_line_variant_attributes_attribute_value_idx"
ON "storefront_order_line_variant_attributes"("attributeId", "valueId");
