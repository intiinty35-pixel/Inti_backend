ALTER TABLE "referral_status_history" ALTER COLUMN "changedById" DROP NOT NULL;

ALTER TABLE "referral_status_history" DROP CONSTRAINT "referral_status_history_changedById_fkey";
ALTER TABLE "referral_status_history" ADD CONSTRAINT "referral_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
