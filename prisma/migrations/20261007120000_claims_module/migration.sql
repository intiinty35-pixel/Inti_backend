-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "dniOrCe" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "parentGuardian" TEXT,
    "assetType" TEXT NOT NULL,
    "claimedAmount" DECIMAL(10,2) NOT NULL,
    "assetDescription" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "claimDetails" TEXT NOT NULL,
    "consumerRequest" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimCode_key" ON "claims"("claimCode");
CREATE INDEX "claims_status_createdAt_idx" ON "claims"("status", "createdAt");
CREATE INDEX "claims_isDeleted_idx" ON "claims"("isDeleted");
