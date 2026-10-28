ALTER TABLE "merchants"
  ADD COLUMN "profileRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "profileUpdatedAt" TIMESTAMPTZ(6),
  ADD COLUMN "profileUpdatedBy" VARCHAR(80);
