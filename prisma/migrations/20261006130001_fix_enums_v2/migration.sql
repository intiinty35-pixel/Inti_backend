-- AlterTable: Drop defaults first, then alter column types
ALTER TABLE "incentives" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "incentives" ALTER COLUMN "status" TYPE "IncentiveStatus" USING "status"::"IncentiveStatus";
ALTER TABLE "incentives" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "redemptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "redemptions" ALTER COLUMN "status" TYPE "RedemptionStatus" USING "status"::"RedemptionStatus";
ALTER TABLE "redemptions" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "point_movements" ALTER COLUMN "type" TYPE "PointMovementType" USING "type"::"PointMovementType";
