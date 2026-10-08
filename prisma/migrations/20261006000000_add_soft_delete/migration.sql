-- AlterTable: baja logica de usuarios (reutiliza isActive + agrega deletedAt)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable: baja logica de perfiles profesionales (agentes/inmobiliarias)
ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "professional_profiles_isDeleted_idx" ON "professional_profiles"("isDeleted");

-- AlterTable: baja logica de propiedades
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "properties_isDeleted_idx" ON "properties"("isDeleted");

-- AlterTable: baja logica de proyectos
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "projects_isDeleted_idx" ON "projects"("isDeleted");
