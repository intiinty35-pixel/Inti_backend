-- First, reassign all referrals from duplicate referrers to the one we'll keep
-- For each email, keep the referrer with the most referrals
WITH referrers_to_keep AS (
  SELECT DISTINCT ON (email) id, email
  FROM "referrers"
  ORDER BY email, (SELECT COUNT(*) FROM "referrals" WHERE "referrerId" = "referrers".id) DESC, id
),
referrers_to_delete AS (
  SELECT r.id, r.email, rtk.id as keep_id
  FROM "referrers" r
  JOIN referrers_to_keep rtk ON r.email = rtk.email
  WHERE r.id != rtk.id
)
UPDATE "referrals"
SET "referrerId" = rtd.keep_id
FROM referrers_to_delete rtd
WHERE "referrals"."referrerId" = rtd.id;

-- Now delete the duplicate referrers
DELETE FROM "referrers"
WHERE id IN (
  SELECT r.id
  FROM "referrers" r
  WHERE EXISTS (
    SELECT 1 FROM "referrers" r2
    WHERE r2.email = r.email AND r2.id != r.id
    AND (SELECT COUNT(*) FROM "referrals" WHERE "referrerId" = r2.id) >= (SELECT COUNT(*) FROM "referrals" WHERE "referrerId" = r.id)
    AND r2.id < r.id
  )
);

-- DropIndex
DROP INDEX IF EXISTS "referrers_email_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "referrers_email_key" ON "referrers"("email");
