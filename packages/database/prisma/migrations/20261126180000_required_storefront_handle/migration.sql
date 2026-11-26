-- Every merchant now needs a subdomain: cashiers sign in to POS as "<subdomain>.<username>".
-- Existing merchants without one get a temporary subdomain that Super Admin can change later.
--
-- The temporary value is the merchant name reduced to lowercase Latin letters and digits,
-- joined by single hyphens and cut to 50 characters, e.g. "Cafe Ahmed 2" -> "cafe-ahmed-2".
-- Names with no usable Latin characters (e.g. Arabic-only names), names shorter than three
-- characters and reserved names fall back to "store-" plus the first six merchant ID
-- characters, e.g. "store-066a08". Taken values get "-2", "-3", ... appended.
DO $$
DECLARE
  merchant_row RECORD;
  base_handle TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR merchant_row IN
    SELECT "id", "name" FROM "merchants" WHERE "storefrontHandle" IS NULL ORDER BY "createdAt", "id"
  LOOP
    -- "[^a-z0-9]+" matches each run of characters that are not lowercase Latin letters or
    -- digits, so "my  café!" becomes "my-caf-" before the edge hyphens are trimmed.
    base_handle := btrim(regexp_replace(lower(merchant_row."name"), '[^a-z0-9]+', '-', 'g'), '-');
    base_handle := btrim(left(base_handle, 50), '-');
    IF length(base_handle) < 3 OR base_handle IN (
      'admin', 'pos', 'api', 'www', 'dashboard', 'merchant', 'marketplace', 'business',
      'auth', 'login', 'support', 'mail', 'assets', 'static', 'cdn'
    ) THEN
      base_handle := 'store-' || left(replace(merchant_row."id"::TEXT, '-', ''), 6);
    END IF;

    candidate := base_handle;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "merchants" WHERE "storefrontHandle" = candidate) LOOP
      suffix := suffix + 1;
      candidate := base_handle || '-' || suffix;
    END LOOP;

    UPDATE "merchants"
    SET "storefrontHandle" = candidate,
        "storefrontHandleAssignedAt" = CURRENT_TIMESTAMP,
        "storefrontHandleAssignedBy" = 'migration'
    WHERE "id" = merchant_row."id";
  END LOOP;
END $$;

ALTER TABLE "merchants" ALTER COLUMN "storefrontHandle" SET NOT NULL;

-- The subdomain an applicant asks for; Super Admin confirms or changes it on approval.
ALTER TABLE "merchant_applications" ADD COLUMN "storefrontHandle" VARCHAR(63);
