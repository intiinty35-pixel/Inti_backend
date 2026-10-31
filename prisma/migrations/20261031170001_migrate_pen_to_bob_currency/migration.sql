-- INTI opera en Bolivia. Conserva los importes y cambia los datos existentes de PEN a BOB.
UPDATE "properties" SET "currency" = 'BOB'::"Currency" WHERE "currency" = 'PEN'::"Currency";
UPDATE "projects" SET "currency" = 'BOB'::"Currency" WHERE "currency" = 'PEN'::"Currency";
UPDATE "plans" SET "currency" = 'BOB'::"Currency" WHERE "currency" = 'PEN'::"Currency";
UPDATE "investment_opportunities" SET "currency" = 'BOB'::"Currency" WHERE "currency" = 'PEN'::"Currency";
UPDATE "property_locations" SET "country" = 'BO' WHERE "country" = 'PE';

ALTER TABLE "plans" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "investment_opportunities" ALTER COLUMN "currency" DROP DEFAULT;

ALTER TABLE "plans" ALTER COLUMN "currency" SET DEFAULT 'BOB';
ALTER TABLE "investment_opportunities" ALTER COLUMN "currency" SET DEFAULT 'BOB';
ALTER TABLE "property_locations" ALTER COLUMN "country" SET DEFAULT 'BO';
