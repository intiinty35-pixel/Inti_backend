import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
const cs = process.env.DATABASE_URL!;
const p = new URL(cs);
const ssl = p.searchParams.get("sslmode") === "verify-full"
  ? { ca: readFileSync(resolve(process.cwd(), p.searchParams.get("sslrootcert")!), "utf8"), rejectUnauthorized: true } : undefined;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs, ssl, application_name: "ariz-seed-script" }) });
async function main() {
  const plans = await prisma.plan.findMany({ orderBy: { price: "asc" } });
  for (const pl of plans) console.log(JSON.stringify({ id: pl.id, slug: pl.slug, name: pl.name, price: pl.price, propertyLimit: pl.propertyLimit, projectLimit: pl.projectLimit, active: pl.isActive }));
  await prisma.$disconnect();
}
main();
