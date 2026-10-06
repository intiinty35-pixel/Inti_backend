CREATE TYPE "ReferralInterest" AS ENUM ('VENTA', 'COMPRA', 'ALQUILER', 'COMPRA_LOTE', 'INVERSION', 'CORRETAJE');

ALTER TABLE "referrals" ADD COLUMN "interest" "ReferralInterest" NOT NULL DEFAULT 'VENTA';
ALTER TABLE "referrals" ADD COLUMN "availability" TEXT NOT NULL DEFAULT 'Inmediata';

ALTER TABLE "referrals" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "referrals" DROP CONSTRAINT "referrals_projectId_fkey";
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
