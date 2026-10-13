import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('🧹 Limpiando planes...');

  // IDs de los 6 planes que DEBEN existir
  const validSlugs = [
    '1-propiedad-15-dias',
    '1-propiedad-30-dias',
    '2-propiedades-15-dias',
    '2-propiedades-30-dias',
    '5-propiedades-15-dias',
    '5-propiedades-30-dias',
  ];

  // 1. Eliminar suscripciones de planes inválidos
  const deletedSubscriptions = await prisma.planSubscription.deleteMany({
    where: {
      plan: {
        slug: { notIn: validSlugs },
      },
    },
  });
  console.log(`✅ ${deletedSubscriptions.count} suscripciones eliminadas`);

  // 2. Eliminar planes inválidos
  const deletedPlans = await prisma.plan.deleteMany({
    where: {
      slug: { notIn: validSlugs },
    },
  });
  console.log(`✅ ${deletedPlans.count} planes eliminados`);

  // 3. Verificar que existan los 6 planes
  const remainingPlans = await prisma.plan.findMany({
    select: { slug: true, name: true, durationDays: true, price: true },
    orderBy: [{ propertyLimit: 'asc' }, { durationDays: 'asc' }],
  });

  console.log('\n📋 Planes en la base de datos:');
  remainingPlans.forEach((p) => {
    console.log(`  - ${p.name} | ${p.durationDays} días | S/ ${p.price} | slug: ${p.slug}`);
  });

  console.log(`\n✅ Total: ${remainingPlans.length} planes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
