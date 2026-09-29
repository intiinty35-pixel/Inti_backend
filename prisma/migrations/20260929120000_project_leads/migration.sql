ALTER TYPE "LeadSource" ADD VALUE 'PROJECT_FORM';

ALTER TABLE "leads"
  ALTER COLUMN "propertyId" DROP NOT NULL,
  ADD COLUMN "projectId" TEXT;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_exactly_one_publication_check"
    CHECK (("propertyId" IS NULL) <> ("projectId" IS NULL));

CREATE INDEX "leads_projectId_createdAt_idx" ON "leads"("projectId", "createdAt");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
