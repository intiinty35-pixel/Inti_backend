ALTER TABLE "projects"
  ALTER COLUMN "agentProfileId" DROP NOT NULL;

CREATE TABLE "admin_projects" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdByAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_projects_projectId_key" ON "admin_projects"("projectId");
CREATE INDEX "admin_projects_createdByAdminId_createdAt_idx"
  ON "admin_projects"("createdByAdminId", "createdAt");

ALTER TABLE "admin_projects"
  ADD CONSTRAINT "admin_projects_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_projects_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leads"
  ALTER COLUMN "agentProfileId" DROP NOT NULL;
ALTER TABLE "leads"
  DROP CONSTRAINT "leads_agentProfileId_fkey",
  ADD CONSTRAINT "leads_agentProfileId_fkey"
  FOREIGN KEY ("agentProfileId") REFERENCES "professional_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
