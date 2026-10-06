-- CreateEnum
CREATE TYPE "ReferralAvailability" AS ENUM ('INMEDIATA', 'AVERIGUAR', 'POR_CONFIRMAR');

-- AlterTable: migrar la columna de texto a enum conservando los datos existentes
ALTER TABLE "referrals" ALTER COLUMN "availability" DROP DEFAULT;
ALTER TABLE "referrals" ALTER COLUMN "availability" TYPE "ReferralAvailability" USING (
  CASE
    WHEN "availability" ILIKE 'inmediat%' THEN 'INMEDIATA'::"ReferralAvailability"
    WHEN "availability" ILIKE 'averigu%' THEN 'AVERIGUAR'::"ReferralAvailability"
    WHEN "availability" ILIKE '%confirm%' THEN 'POR_CONFIRMAR'::"ReferralAvailability"
    ELSE 'INMEDIATA'::"ReferralAvailability"
  END
);
ALTER TABLE "referrals" ALTER COLUMN "availability" SET DEFAULT 'INMEDIATA';
