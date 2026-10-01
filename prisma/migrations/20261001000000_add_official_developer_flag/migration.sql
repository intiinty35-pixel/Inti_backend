-- AlterTable
ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "isOfficialDeveloper" BOOLEAN NOT NULL DEFAULT false;
