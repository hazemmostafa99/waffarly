CREATE TABLE "business_activities" (
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "moduleKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" VARCHAR(80) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "business_activities_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "business_activities_key_check" CHECK ("key" = 'restaurant'),
    CONSTRAINT "business_activities_name_check" CHECK (length(trim("name")) > 0),
    CONSTRAINT "business_activities_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "business_activities_modules_check" CHECK (
        "moduleKeys" <@ ARRAY['merchant-profile', 'storefront-design']::TEXT[]
        AND array_position("moduleKeys", NULL) IS NULL
    )
);

CREATE TABLE "platform_modules" (
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" VARCHAR(80) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "platform_modules_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "platform_modules_key_check" CHECK ("key" IN ('merchant-profile', 'storefront-design')),
    CONSTRAINT "platform_modules_name_check" CHECK (length(trim("name")) > 0),
    CONSTRAINT "platform_modules_revision_check" CHECK ("revision" > 0)
);
