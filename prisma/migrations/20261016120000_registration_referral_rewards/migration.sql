-- CreateTable: vincula un nuevo miembro Ariz con el miembro que lo invitó mediante código de referido
CREATE TABLE "registration_referrals" (
    "id" TEXT NOT NULL,
    "newReferrerId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviterCode" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_referrals_newReferrerId_key" ON "registration_referrals"("newReferrerId");

-- CreateIndex
CREATE INDEX "registration_referrals_inviterId_createdAt_idx" ON "registration_referrals"("inviterId", "createdAt");

-- AddForeignKey
ALTER TABLE "registration_referrals" ADD CONSTRAINT "registration_referrals_newReferrerId_fkey" FOREIGN KEY ("newReferrerId") REFERENCES "referrers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_referrals" ADD CONSTRAINT "registration_referrals_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
