-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "merchant_storefronts" ALTER COLUMN "accentColor" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "categories" RENAME CONSTRAINT "categories_imageAsset_merchant_fkey" TO "categories_imageAssetId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "categories" RENAME CONSTRAINT "categories_parent_merchant_fkey" TO "categories_parentId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "product_categories" RENAME CONSTRAINT "product_categories_category_merchant_fkey" TO "product_categories_categoryId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "product_categories" RENAME CONSTRAINT "product_categories_product_merchant_fkey" TO "product_categories_productId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "product_images" RENAME CONSTRAINT "product_images_media_merchant_fkey" TO "product_images_mediaAssetId_merchantId_fkey";

-- RenameForeignKey
ALTER TABLE "product_images" RENAME CONSTRAINT "product_images_product_merchant_fkey" TO "product_images_productId_merchantId_fkey";
