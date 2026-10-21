CREATE TABLE "project_site_plans" (
  "projectId" TEXT NOT NULL PRIMARY KEY,
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_site_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
