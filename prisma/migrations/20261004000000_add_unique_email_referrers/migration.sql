-- Delete duplicate referrers (keep the one with most referrals)
DELETE FROM "referrers"
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id
  FROM "referrers"
  ORDER BY email, (SELECT COUNT(*) FROM "referrals" WHERE "referrerId" = "referrers".id) DESC
);

-- DropIndex
DROP INDEX IF EXISTS "referrers_email_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "referrers_email_key" ON "referrers"("email");
