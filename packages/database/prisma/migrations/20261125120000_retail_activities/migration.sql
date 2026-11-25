ALTER TABLE "merchants" DROP CONSTRAINT "merchants_activity_check";
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_activity_check" CHECK ("activity" IN ('restaurant', 'clothing', 'supermarket', 'home_goods', 'electrical', 'other'));

ALTER TABLE "merchant_applications" DROP CONSTRAINT "merchant_applications_activity_check";
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_activity_check" CHECK ("activity" IN ('restaurant', 'clothing', 'supermarket', 'home_goods', 'electrical', 'other'));

ALTER TABLE "business_activities" DROP CONSTRAINT "business_activities_key_check";
ALTER TABLE "business_activities" ADD CONSTRAINT "business_activities_key_check" CHECK ("key" IN ('restaurant', 'clothing', 'supermarket', 'home_goods', 'electrical', 'other'));

