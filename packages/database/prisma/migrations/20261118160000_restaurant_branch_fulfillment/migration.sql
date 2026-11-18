ALTER TABLE "restaurant_profiles"
ADD COLUMN "branch_fulfillment" JSONB NOT NULL DEFAULT '[]';
