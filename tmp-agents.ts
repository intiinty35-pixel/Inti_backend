import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;
const parsed = new URL(connectionString);
const ssl = parsed.searchParams.get("sslmode") === "verify-full"
  ? { ca: readFileSync(resolve(process.cwd(), parsed.searchParams.get("sslrootcert")!), "utf8"), rejectUnauthorized: true }
  : undefined;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, ssl, application_name: "ariz-seed-script" }) });

async function main() {
  const profiles = await prisma.professionalProfile.findMany({
    where: { status: "APPROVED" },
    include: { user: true, subscriptions: { where: { status: "ACTIVE" } } },
  });
  for (const p of profiles) {
    const sub = p.subscriptions[0];
    const plan = sub ? await prisma.plan.findUnique({ where: { id: sub.planId } }) : null;
    const published = await prisma.project.count({ where: { agentProfileId: p.id, status: "PUBLISHED" } });
    console.log(JSON.stringify({
      agentProfileId: p.id,
      user: p.user.email,
      businessName: p.businessName,
      type: p.type,
      sub: sub ? { endsAt: sub.endsAt, plan: plan?.name, projectLimit: plan?.projectLimit } : null,
      publishedProjects: published,
    }));
  }
  await prisma.$disconnect();
}
main();
