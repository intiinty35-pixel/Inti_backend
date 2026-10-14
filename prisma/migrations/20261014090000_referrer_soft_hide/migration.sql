-- AlterTable: los miembros se ocultan (baja logica) en lugar de borrarse
ALTER TABLE "referrers"
  ADD COLUMN "deletedAt" TIMESTAMP(3);
