DROP INDEX IF EXISTS "claims_status_createdAt_idx";
ALTER TABLE "claims" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "ClaimStatus";
