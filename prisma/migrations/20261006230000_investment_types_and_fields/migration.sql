CREATE TABLE "investment_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investment_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investment_types_slug_key" ON "investment_types"("slug");
CREATE INDEX "investment_types_isActive_sortOrder_idx" ON "investment_types"("isActive", "sortOrder");

INSERT INTO "investment_types" ("id", "name", "slug", "description", "sortOrder", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'Inversion en terrenos', 'inversion-en-terrenos', 'Terrenos con potencial de valorizacion o desarrollo.', 1, CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222', 'Proyectos inmobiliarios', 'proyectos-inmobiliarios', 'Proyectos en desarrollo o comercializacion.', 2, CURRENT_TIMESTAMP),
  ('33333333-3333-4333-8333-333333333333', 'Departamentos para inversion', 'departamentos-para-inversion', 'Unidades orientadas a renta o plusvalia.', 3, CURRENT_TIMESTAMP),
  ('44444444-4444-4444-8444-444444444444', 'Participacion en proyectos', 'participacion-en-proyectos', 'Participacion en oportunidades estructuradas.', 4, CURRENT_TIMESTAMP),
  ('55555555-5555-4555-8555-555555555555', 'Oportunidades de preventa', 'oportunidades-de-preventa', 'Preventa con condiciones preferentes.', 5, CURRENT_TIMESTAMP);

ALTER TABLE "investment_opportunities"
  ADD COLUMN "investmentTypeId" TEXT,
  ADD COLUMN "investmentKind" TEXT NOT NULL DEFAULT 'Inversion inmobiliaria',
  ADD COLUMN "assetType" TEXT NOT NULL DEFAULT 'Proyecto',
  ADD COLUMN "estimatedReturnLabel" TEXT,
  ADD COLUMN "estimatedTermMonths" INTEGER,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "riskLevel" TEXT,
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ctaLabel" TEXT NOT NULL DEFAULT 'Solicitar informacion';

UPDATE "investment_opportunities"
SET "investmentTypeId" = '22222222-2222-4222-8222-222222222222'
WHERE "investmentTypeId" IS NULL;

CREATE INDEX "investment_opportunities_investmentTypeId_sortOrder_idx" ON "investment_opportunities"("investmentTypeId", "sortOrder");

ALTER TABLE "investment_opportunities"
  ADD CONSTRAINT "investment_opportunities_investmentTypeId_fkey"
  FOREIGN KEY ("investmentTypeId") REFERENCES "investment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
