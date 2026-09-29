-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'RENDER';

CREATE TYPE "ProjectCategory" AS ENUM ('LOTIZACION');
CREATE TYPE "ProjectStage" AS ENUM ('PRE_SALE', 'UNDER_CONSTRUCTION', 'DELIVERED');
CREATE TYPE "LotMode" AS ENUM ('INDIVIDUAL', 'GROUP');
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED');
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD', 'REJECTED', 'ARCHIVED');

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "agentProfileId" TEXT NOT NULL,
  "category" "ProjectCategory" NOT NULL DEFAULT 'LOTIZACION',
  "stage" "ProjectStage" NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "currency" "Currency" NOT NULL,
  "priceFrom" DECIMAL(14,2) NOT NULL,
  "priceTo" DECIMAL(14,2) NOT NULL,
  "ruc" TEXT,
  "businessName" TEXT,
  "downPayment" DECIMAL(14,2),
  "monthlyPayment" DECIMAL(14,2),
  "financing" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "totalBlocks" INTEGER,
  "totalLots" INTEGER,
  "social" JSONB,
  "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "urbanizationName" TEXT,
  "registryEntry" TEXT,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lotMode" "LotMode" NOT NULL,
  "constructionStart" TIMESTAMP(3),
  "estimatedDelivery" TIMESTAMP(3) NOT NULL,
  "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "tourUrl" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "contactWhatsapp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_locations" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'PE',
  "department" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "zone" TEXT,
  "street" TEXT NOT NULL,
  "streetNumber" TEXT NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  CONSTRAINT "project_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_lots" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "block" TEXT,
  "areaM2" DECIMAL(10,2) NOT NULL,
  "frontM" DECIMAL(10,2),
  "price" DECIMAL(14,2) NOT NULL,
  "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "planLocation" TEXT,
  "lotCount" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_lots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_milestones" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_media" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
CREATE INDEX "projects_status_featured_publishedAt_idx" ON "projects"("status", "featured", "publishedAt");
CREATE INDEX "projects_category_stage_status_idx" ON "projects"("category", "stage", "status");
CREATE UNIQUE INDEX "project_locations_projectId_key" ON "project_locations"("projectId");
CREATE INDEX "project_locations_department_province_district_idx" ON "project_locations"("department", "province", "district");
CREATE INDEX "project_lots_projectId_position_idx" ON "project_lots"("projectId", "position");
CREATE INDEX "project_milestones_projectId_position_idx" ON "project_milestones"("projectId", "position");
CREATE INDEX "project_media_projectId_position_idx" ON "project_media"("projectId", "position");

ALTER TABLE "projects" ADD CONSTRAINT "projects_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_locations" ADD CONSTRAINT "project_locations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_lots" ADD CONSTRAINT "project_lots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
