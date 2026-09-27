CREATE TYPE "OperationType" AS ENUM ('SALE', 'RENT', 'TEMPORARY_RENT', 'TRANSFER');
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'OFFICE', 'COMMERCIAL', 'WAREHOUSE', 'ROOM');
CREATE TYPE "Currency" AS ENUM ('PEN', 'USD');
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD', 'RENTED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "ConservationStatus" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'REMODELED', 'TO_REMODEL', 'UNDER_CONSTRUCTION');
CREATE TYPE "AmenityCategory" AS ENUM ('INTERIOR', 'SERVICES', 'EXTERIOR', 'BUILDING');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'TOUR', 'FLOOR_PLAN');
CREATE TYPE "LeadSource" AS ENUM ('PROPERTY_FORM', 'WHATSAPP', 'QUICK_QUESTION', 'PHONE');

CREATE TABLE "properties" (
  "id" TEXT NOT NULL,
  "agentProfileId" TEXT NOT NULL,
  "operationType" "OperationType" NOT NULL,
  "propertyType" "PropertyType" NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL,
  "negotiable" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceFee" DECIMAL(12,2),
  "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "contactWhatsapp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_locations" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'PE',
  "department" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "number" TEXT,
  "sector" TEXT,
  "reference" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "approximateLocation" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "property_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_details" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "totalArea" DECIMAL(10,2),
  "constructedArea" DECIMAL(10,2),
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "halfBathrooms" INTEGER,
  "parkingSpaces" INTEGER,
  "floor" INTEGER,
  "floors" INTEGER,
  "constructionYear" INTEGER,
  "conservationStatus" "ConservationStatus",
  "specificDetails" JSONB,
  CONSTRAINT "property_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amenities" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "AmenityCategory" NOT NULL,
  CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_amenities" (
  "propertyId" TEXT NOT NULL,
  "amenityId" TEXT NOT NULL,
  CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("propertyId","amenityId")
);

CREATE TABLE "property_media" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "agentProfileId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "message" TEXT NOT NULL,
  "source" "LeadSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");
CREATE INDEX "properties_status_featured_publishedAt_idx" ON "properties"("status", "featured", "publishedAt");
CREATE INDEX "properties_operationType_propertyType_status_idx" ON "properties"("operationType", "propertyType", "status");
CREATE UNIQUE INDEX "property_locations_propertyId_key" ON "property_locations"("propertyId");
CREATE INDEX "property_locations_department_province_district_idx" ON "property_locations"("department", "province", "district");
CREATE UNIQUE INDEX "property_details_propertyId_key" ON "property_details"("propertyId");
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");
CREATE INDEX "property_media_propertyId_position_idx" ON "property_media"("propertyId", "position");
CREATE INDEX "leads_propertyId_createdAt_idx" ON "leads"("propertyId", "createdAt");
CREATE INDEX "leads_agentProfileId_createdAt_idx" ON "leads"("agentProfileId", "createdAt");

ALTER TABLE "properties" ADD CONSTRAINT "properties_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_details" ADD CONSTRAINT "property_details_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "professional_profiles" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "professional_profiles_slug_key" ON "professional_profiles"("slug");

CREATE TABLE IF NOT EXISTS "favorites" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "search_alerts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "search_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "price_alerts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "targetPrice" DECIMAL(14,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_userId_propertyId_key" ON "favorites"("userId", "propertyId");
CREATE INDEX IF NOT EXISTS "favorites_userId_createdAt_idx" ON "favorites"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "search_alerts_userId_isActive_idx" ON "search_alerts"("userId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "price_alerts_userId_propertyId_key" ON "price_alerts"("userId", "propertyId");
CREATE INDEX IF NOT EXISTS "price_alerts_userId_isActive_idx" ON "price_alerts"("userId", "isActive");

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
