CREATE TYPE "ReferralStatus" AS ENUM ('CONTACTED', 'VISIT', 'OPERATION_COMPLETED');

CREATE TABLE "referrers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referrers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_status_points" (
  "id" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referral_status_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referrals" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'CONTACTED',
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_status_history" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "fromStatus" "ReferralStatus",
  "toStatus" "ReferralStatus" NOT NULL,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrers_code_key" ON "referrers"("code");
CREATE UNIQUE INDEX "referral_status_points_status_key" ON "referral_status_points"("status");
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
CREATE UNIQUE INDEX "referral_status_history_referralId_toStatus_key" ON "referral_status_history"("referralId", "toStatus");
CREATE INDEX "referrers_email_idx" ON "referrers"("email");
CREATE INDEX "referrals_referrerId_createdAt_idx" ON "referrals"("referrerId", "createdAt");
CREATE INDEX "referrals_projectId_createdAt_idx" ON "referrals"("projectId", "createdAt");
CREATE INDEX "referrals_status_createdAt_idx" ON "referrals"("status", "createdAt");
CREATE INDEX "referral_status_history_referralId_createdAt_idx" ON "referral_status_history"("referralId", "createdAt");

ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "referral_status_points" ("id", "status", "points", "updatedAt") VALUES
  (gen_random_uuid(), 'CONTACTED', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'VISIT', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OPERATION_COMPLETED', 500, CURRENT_TIMESTAMP);
