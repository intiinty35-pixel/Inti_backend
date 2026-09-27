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
        slug: 'gratuito',
        name: 'Plan Gratuito',
        price: 0,
        durationDays: 365,
        propertyLimit: 2,
        projectLimit: 0,
        features: ['Publicación básica', 'Perfil profesional', 'Contacto directo'],
        isFree: true,
        isDefault: true,
        highlight: false,
      },
      {
        slug: 'prueba-30-dias',
        name: 'Prueba 30 días',
        price: 0,
        durationDays: 30,
        propertyLimit: 5,
        projectLimit: 1,
        features: ['Funciones profesionales', 'Estadísticas', 'Soporte por correo'],
        isFree: true,
        isDefault: false,
        highlight: false,
      },
      {
        slug: 'pro-agente',
        name: 'Pro Agente',
        price: 149,
        durationDays: 30,
        propertyLimit: 10,
        projectLimit: 2,
        features: ['Mayor visibilidad', 'Estadísticas completas', 'Gestión de leads'],
        isFree: false,
        isDefault: false,
        highlight: true,
      },
      {
        slug: 'premium-inmobiliaria',
        name: 'Premium Inmobiliaria',
        price: 399,
        durationDays: 30,
        propertyLimit: 50,
        projectLimit: 10,
        features: ['Capacidad empresarial', 'Proyectos y lotizaciones', 'Reportes avanzados', 'Atención prioritaria'],
        isFree: false,
        isDefault: false,
        highlight: false,
      },
    ];

    for (const plan of defaultPlans) {
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        update: {},
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
