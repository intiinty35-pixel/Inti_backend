import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const plans = await prisma.plan.findMany({
    select: { id: true, slug: true, name: true, durationDays: true, price: true, propertyLimit: true, isActive: true },
    orderBy: [{ propertyLimit: 'asc' }, { durationDays: 'asc' }],
  });

  console.log('\n📋 Planes en la base de datos:');
  plans.forEach((p) => {
    console.log(`  - ${p.name.padEnd(20)} | ${p.durationDays} días | S/ ${p.price.toString().padEnd(6)} | ${p.isActive ? '✅' : '❌'} | slug: ${p.slug}`);
  });

  console.log(`\n✅ Total: ${plans.length} planes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
