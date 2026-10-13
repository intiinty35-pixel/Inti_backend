import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD en .env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await argon2.hash(password),
        firstName: 'Administrador',
        role: Role.ADMIN,
      },
    });
    console.log(`Administrador listo: ${email}`);

    const defaultPlans = [
      {
        slug: '1-propiedad-15-dias',
        name: '1 propiedad',
        price: 80,
        currency: 'PEN' as const,
        durationDays: 15,
        propertyLimit: 1,
        projectLimit: 0,
        features: ['1 propiedad activa', '15 días de publicación', 'Perfil profesional'],
        isFree: false,
        isDefault: false,
        highlight: false,
        isActive: true,
      },
      {
        slug: '1-propiedad-30-dias',
        name: '1 propiedad',
        price: 150,
        currency: 'PEN' as const,
        durationDays: 30,
        propertyLimit: 1,
        projectLimit: 0,
        features: ['1 propiedad activa', '30 días de publicación', 'Perfil profesional'],
        isFree: false,
        isDefault: true,
        highlight: false,
        isActive: true,
      },
      {
        slug: '2-propiedades-15-dias',
        name: '2 propiedades',
        price: 120,
        currency: 'PEN' as const,
        durationDays: 15,
        propertyLimit: 2,
        projectLimit: 0,
        features: ['2 propiedades activas', '15 días de publicación', 'Gestión de leads', 'Contacto directo'],
        isFree: false,
        isDefault: false,
        highlight: false,
        isActive: true,
      },
      {
        slug: '2-propiedades-30-dias',
        name: '2 propiedades',
        price: 225,
        currency: 'PEN' as const,
        durationDays: 30,
        propertyLimit: 2,
        projectLimit: 1,
        features: ['2 propiedades activas', '30 días de publicación', '1 proyecto activo para inmobiliarias', 'Gestión de leads'],
        isFree: false,
        isDefault: false,
        highlight: false,
        isActive: true,
      },
      {
        slug: '5-propiedades-15-dias',
        name: '+5 propiedades',
        price: 200,
        currency: 'PEN' as const,
        durationDays: 15,
        propertyLimit: 5,
        projectLimit: 1,
        features: ['+5 propiedades activas', '15 días de publicación', '2 proyectos activos para inmobiliarias', 'Mayor visibilidad', 'Estadísticas completas'],
        isFree: false,
        isDefault: false,
        highlight: false,
        isActive: true,
      },
      {
        slug: '5-propiedades-30-dias',
        name: '+5 propiedades',
        price: 350,
        currency: 'PEN' as const,
        durationDays: 30,
        propertyLimit: 5,
        projectLimit: 2,
        features: ['+5 propiedades activas', '30 días de publicación', '2 proyectos activos para inmobiliarias', 'Mayor visibilidad', 'Estadísticas completas'],
        isFree: false,
        isDefault: false,
        highlight: true,
        isActive: true,
      },
    ];

    await prisma.planSubscription.deleteMany({
      where: {
        plan: {
          slug: { notIn: defaultPlans.map((plan) => plan.slug) },
        },
      },
    });
    await prisma.plan.deleteMany({
      where: { slug: { notIn: defaultPlans.map((plan) => plan.slug) } },
    });

    for (const plan of defaultPlans) {
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        update: plan,
        create: plan,
      });
    }
    console.log(`Planes por defecto listos (${defaultPlans.length})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
