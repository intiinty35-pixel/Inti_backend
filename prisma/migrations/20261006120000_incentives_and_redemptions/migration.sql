-- CreateTable
CREATE TABLE "incentives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "promotion" TEXT,
    "imageUrl" TEXT,
    "publicId" TEXT,
    "pointsRequired" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "incentiveId" TEXT NOT NULL,
    "incentiveName" TEXT NOT NULL,
    "incentiveImageUrl" TEXT,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_movements" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incentives_status_isDeleted_idx" ON "incentives"("status", "isDeleted");

-- CreateIndex
CREATE INDEX "redemptions_referrerId_createdAt_idx" ON "redemptions"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "redemptions_status_createdAt_idx" ON "redemptions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "point_movements_referrerId_createdAt_idx" ON "point_movements"("referrerId", "createdAt");

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_incentiveId_fkey" FOREIGN KEY ("incentiveId") REFERENCES "incentives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_movements" ADD CONSTRAINT "point_movements_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
