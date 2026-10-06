-- Add the session family column as nullable first.
ALTER TABLE "RefreshToken"
ADD COLUMN "familyId" TEXT;

-- Give every existing refresh token its own session family.
-- Existing sessions remain valid; they simply become
-- independent families.
UPDATE "RefreshToken"
SET "familyId" = "id"
WHERE "familyId" IS NULL;

-- Make familyId required for all future refresh tokens.
ALTER TABLE "RefreshToken"
ALTER COLUMN "familyId" SET NOT NULL;

-- Index the family for fast token-family revocation.
CREATE INDEX "RefreshToken_familyId_idx"
ON "RefreshToken"("familyId");

-- Index user + family lookups.
CREATE INDEX "RefreshToken_userId_familyId_idx"
ON "RefreshToken"("userId", "familyId");