CREATE TABLE "investment_opportunities" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "areaLabel" TEXT NOT NULL,
  "initialInvestment" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'PEN',
  "roiPercent" DECIMAL(5,2) NOT NULL,
  "investmentGoal" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "coverImageUrl" TEXT NOT NULL,
  "coverImagePublicId" TEXT,
  "galleryImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "highlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investment_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investment_opportunities_slug_key"
  ON "investment_opportunities"("slug");
CREATE INDEX "investment_opportunities_isPublished_updatedAt_idx"
  ON "investment_opportunities"("isPublished", "updatedAt");
