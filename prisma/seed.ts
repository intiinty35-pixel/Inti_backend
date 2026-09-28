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
        slug: 'paquete-2-propiedades',
        name: 'Paquete 2 propiedades',
        price: 30,
        currency: 'PEN' as const,
        durationDays: 30,
        propertyLimit: 2,
        projectLimit: 0,
        features: ['2 publicaciones activas', 'Perfil profesional', 'Contacto directo'],
        isFree: false,
        isDefault: true,
        highlight: false,
        isActive: true,
      },
      {
        slug: 'paquete-4-propiedades',
        name: 'Paquete 4 propiedades',
        price: 50,
        currency: 'PEN' as const,
        durationDays: 30,
        propertyLimit: 4,
        projectLimit: 0,
        features: ['4 publicaciones activas', 'Gestion de leads', 'Soporte por correo'],
        isFree: false,
        isDefault: false,
        highlight: false,
        isActive: true,
      },
      {
        slug: 'paquete-8-propiedades',
        name: 'Paquete 8 propiedades',
        price: 80,
        currency: 'PEN' as const,
        durationDays: 45,
        propertyLimit: 8,
        projectLimit: 0,
        features: ['8 publicaciones activas', 'Mayor visibilidad', 'Estadisticas completas', 'Gestion de leads'],
        isFree: false,
        isDefault: false,
        highlight: true,
        isActive: true,
      },
      {
        slug: 'paquete-10-propiedades',
        name: 'Paquete 10 propiedades',
        price: 100,
        currency: 'PEN' as const,
        durationDays: 45,
        propertyLimit: 10,
        projectLimit: 0,
        features: ['10 publicaciones activas', 'Maxima presencia', 'Reportes avanzados', 'Atencion prioritaria'],
        isFree: false,
        isDefault: false,
        highlight: true,
        isActive: true,
      },
    ];

    await prisma.plan.updateMany({
      where: { slug: { notIn: defaultPlans.map((plan) => plan.slug) } },
      data: { isActive: false, isDefault: false },
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
