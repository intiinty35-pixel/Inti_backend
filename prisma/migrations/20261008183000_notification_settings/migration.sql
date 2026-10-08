CREATE TABLE IF NOT EXISTS "notification_settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailLeads" BOOLEAN NOT NULL DEFAULT true,
  "whatsappLeads" BOOLEAN NOT NULL DEFAULT false,
  "membershipReminders" BOOLEAN NOT NULL DEFAULT true,
  "weeklyStats" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_userId_key" ON "notification_settings"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'notification_settings_userId_fkey'
      AND table_name = 'notification_settings'
  ) THEN
    ALTER TABLE "notification_settings"
      ADD CONSTRAINT "notification_settings_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
