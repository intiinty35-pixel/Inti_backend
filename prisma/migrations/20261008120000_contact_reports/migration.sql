CREATE TABLE "contact_reports" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "topic" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contact_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_reports_createdAt_idx" ON "contact_reports"("createdAt");
CREATE INDEX "contact_reports_status_createdAt_idx" ON "contact_reports"("status", "createdAt");
