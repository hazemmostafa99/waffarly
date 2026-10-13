CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contactPhone" VARCHAR(32) NOT NULL,
    "ownerName" VARCHAR(160) NOT NULL,
    "ownerMobile" VARCHAR(32) NOT NULL,
    "firstMonthActivatedAt" TIMESTAMPTZ(6),
    "firstMonthActivatedBy" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_accounts" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "owner_accounts_merchantId_key" ON "owner_accounts"("merchantId");
CREATE UNIQUE INDEX "owner_accounts_username_key" ON "owner_accounts"("username");
ALTER TABLE "owner_accounts" ADD CONSTRAINT "owner_accounts_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "auth_sessions" (
    "tokenHash" VARCHAR(64) NOT NULL,
    "subjectKind" VARCHAR(10) NOT NULL,
    "subjectId" VARCHAR(80) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "auth_sessions_subjectKind_subjectId_idx" ON "auth_sessions"("subjectKind", "subjectId");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
