-- Existing accounts have no recorded reset; do not invent a reset time or administrator.
ALTER TABLE "owner_accounts"
  ADD COLUMN "passwordResetAt" TIMESTAMPTZ(6),
  ADD COLUMN "passwordResetBy" VARCHAR(80);
