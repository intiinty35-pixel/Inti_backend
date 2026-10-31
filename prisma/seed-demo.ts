import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  ApprovalStatus,
  Currency,
  LeadSource,
  OperationType,
  ProfessionalType,
  PropertyStatus,
  PropertyType,
  Role,
  SubscriptionStatus,
} from '../src/generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function slugify(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

const IMG = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;

async function ensureUser(
  email: string,
  firstName: string,
  lastName: string | null,
  role: Role,
) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await argon2.hash('Demo1234!'),
      firstName,
      lastName,
      phone: '9' + Math.floor(10000000 + Math.random() * 89999999),
      role,
    },
  });
}

async function ensureAgentProfile(
  userId: string,
  opts: {
    type: ProfessionalType;
    businessName?: string;
    status: ApprovalStatus;
    city: string;
    whatsapp: string;
    slugBase: string;
  },
) {
  const existing = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.professionalProfile.create({
    data: {
      userId,
      type: opts.type,
      status: opts.status,
      businessName: opts.businessName,
      city: opts.city,
      whatsapp: opts.whatsapp,
      slug: slugify(opts.slugBase),
    },
  });
}

const PROPERTY_SEEDS: {
  title: string;
  operationType: OperationType;
  propertyType: PropertyType;
  price: number;
  status: PropertyStatus;
  district: string;
  bedrooms?: number;
  bathrooms?: number;
  totalArea: number;
  daysAgo: number;
}[] = [
  { title: 'Casa moderna en Urbanización Kataleya', operationType: OperationType.SALE, propertyType: PropertyType.HOUSE, price: 145000, status: PropertyStatus.PUBLISHED, district: 'Tumbes', bedrooms: 3, bathrooms: 2, totalArea: 120, daysAgo: 20 },
  { title: 'Departamento con vista al mar', operationType: OperationType.SALE, propertyType: PropertyType.APARTMENT, price: 189000, status: PropertyStatus.PUBLISHED, district: 'Zorritos', bedrooms: 2, bathrooms: 2, totalArea: 85, daysAgo: 15 },
  { title: 'Terreno habilitado Puerto Pizarro', operationType: OperationType.SALE, propertyType: PropertyType.LAND, price: 45000, status: PropertyStatus.PUBLISHED, district: 'Puerto Pizarro', totalArea: 300, daysAgo: 10 },
  { title: 'Local comercial en avenida principal', operationType: OperationType.RENT, propertyType: PropertyType.COMMERCIAL, price: 2200, status: PropertyStatus.PUBLISHED, district: 'Tumbes', totalArea: 60, daysAgo: 8 },
  { title: 'Casa de campo Villa Paraíso', operationType: OperationType.SALE, propertyType: PropertyType.HOUSE, price: 210000, status: PropertyStatus.PUBLISHED, district: 'Corrales', bedrooms: 4, bathrooms: 3, totalArea: 180, daysAgo: 5 },
  { title: 'Oficina corporativa Piura', operationType: OperationType.RENT, propertyType: PropertyType.OFFICE, price: 1800, status: PropertyStatus.PAUSED, district: 'Piura', totalArea: 45, daysAgo: 30 },
  { title: 'Departamento en construcción Los Robles', operationType: OperationType.SALE, propertyType: PropertyType.APARTMENT, price: 98000, status: PropertyStatus.DRAFT, district: 'Tumbes', bedrooms: 2, bathrooms: 1, totalArea: 65, daysAgo: 2 },
  { title: 'Almacén industrial Zarumilla', operationType: OperationType.RENT, propertyType: PropertyType.WAREHOUSE, price: 3500, status: PropertyStatus.PUBLISHED, district: 'Zarumilla', totalArea: 400, daysAgo: 12 },
];

const LEAD_SEEDS: { name: string; email: string; phone: string; message: string; source: LeadSource; daysAgo: number }[] = [
  { name: 'Carlos Mendoza', email: 'carlos.mendoza@example.com', phone: '969111222', message: '¿Todavía está disponible? Me interesa agendar una visita este fin de semana.', source: LeadSource.PROPERTY_FORM, daysAgo: 1 },
  { name: 'Ana Torres', email: 'ana.torres@example.com', phone: '969222333', message: 'Quisiera saber si acepta financiamiento bancario.', source: LeadSource.WHATSAPP, daysAgo: 2 },
  { name: 'Jose Ramirez', email: 'jose.ramirez@example.com', phone: '969333444', message: '¿Cuál es el precio final con todos los gastos incluidos?', source: LeadSource.QUICK_QUESTION, daysAgo: 4 },
  { name: 'Lucia Fernandez', email: 'lucia.fernandez@example.com', phone: '969444555', message: 'Me gustaría una llamada para más detalles.', source: LeadSource.PHONE, daysAgo: 6 },
  { name: 'Miguel Castillo', email: 'miguel.castillo@example.com', phone: '969555666', message: '¿Aceptan una oferta menor al precio publicado?', source: LeadSource.PROPERTY_FORM, daysAgo: 9 },
  { name: 'Rosa Herrera', email: 'rosa.herrera@example.com', phone: '969666777', message: 'Interesada, ¿podemos coordinar visita esta semana?', source: LeadSource.WHATSAPP, daysAgo: 14 },
];

async function main() {
  console.log('Creando agente demo aprobado con plan activo...');
  const demoUser = await ensureUser('demo.inmobiliaria@ariz.local', 'Inmobiliaria', 'Demo Tumbes', Role.REAL_ESTATE);
  const demoAgent = await ensureAgentProfile(demoUser.id, {
    type: ProfessionalType.REAL_ESTATE_AGENCY,
    businessName: 'Inmobiliaria Demo Tumbes',
    status: ApprovalStatus.APPROVED,
    city: 'Tumbes',
    whatsapp: '969000111',
    slugBase: 'inmobiliaria-demo-tumbes',
  });

  const proPlan = await prisma.plan.findFirst({ where: { slug: 'pro-agente' } });
  if (proPlan) {
    const hasActive = await prisma.planSubscription.findFirst({
      where: { agentProfileId: demoAgent.id, status: SubscriptionStatus.ACTIVE },
    });
    if (!hasActive) {
      const now = new Date();
      await prisma.planSubscription.create({
        data: {
          agentProfileId: demoAgent.id,
          planId: proPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startedAt: now,
          expiresAt: new Date(now.getTime() + proPlan.durationDays * 86_400_000),
        },
      });
    }
  }

  console.log('Creando propiedades de prueba...');
  const createdProperties: { id: string }[] = [];
  for (const seed of PROPERTY_SEEDS) {
    const existing = await prisma.property.findFirst({
      where: { title: seed.title, agentProfileId: demoAgent.id },
      select: { id: true },
    });
    if (existing) {
      createdProperties.push(existing);
      continue;
    }

    const publishedAt =
      seed.status === PropertyStatus.PUBLISHED || seed.status === PropertyStatus.PAUSED
        ? new Date(Date.now() - seed.daysAgo * 86_400_000)
        : null;

    const property = await prisma.property.create({
      data: {
        agentProfileId: demoAgent.id,
        operationType: seed.operationType,
        propertyType: seed.propertyType,
        slug: slugify(seed.title),
        title: seed.title,
        description: `${seed.title}. Propiedad de prueba generada para revisar el panel del profesional. Ubicada en ${seed.district}, cuenta con ${seed.totalArea} m² y excelente acceso.`,
        price: seed.price,
        currency: Currency.BOB,
        status: seed.status,
        publishedAt,
        createdAt: new Date(Date.now() - (seed.daysAgo + 1) * 86_400_000),
        location: {
          create: {
            department: 'Tumbes',
            province: 'Tumbes',
            district: seed.district,
            address: 'Av. Principal s/n',
            approximateLocation: true,
          },
        },
        details: {
          create: {
            totalArea: seed.totalArea,
            constructedArea: seed.totalArea,
            bedrooms: seed.bedrooms,
            bathrooms: seed.bathrooms,
            parkingSpaces: seed.bedrooms ? 1 : undefined,
          },
        },
        media: {
          create: [
            { url: IMG(slugify(seed.title)), position: 0, isCover: true },
            { url: IMG(slugify(seed.title) + '-2'), position: 1 },
          ],
        },
      },
    });
    createdProperties.push(property);
  }

  console.log('Creando leads de prueba...');
  for (let i = 0; i < LEAD_SEEDS.length; i += 1) {
    const seed = LEAD_SEEDS[i];
    const property = createdProperties[i % createdProperties.length];
    const exists = await prisma.lead.findFirst({
      where: { email: seed.email, propertyId: property.id },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.lead.create({
      data: {
        propertyId: property.id,
        agentProfileId: demoAgent.id,
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        message: seed.message,
        source: seed.source,
        createdAt: new Date(Date.now() - seed.daysAgo * 86_400_000),
      },
    });
  }

  console.log('Creando segundo agente con perfil pendiente de aprobación...');
  const pendingUser = await ensureUser('demo.agente@ariz.local', 'Roberto', 'Chunga', Role.REAL_ESTATE);
  await ensureAgentProfile(pendingUser.id, {
    type: ProfessionalType.INDEPENDENT_AGENT,
    status: ApprovalStatus.PENDING,
    city: 'Piura',
    whatsapp: '969777888',
    slugBase: 'roberto-chunga',
  });

  console.log('Creando una solicitud de plan de pago pendiente para el admin...');
  const premiumPlan = await prisma.plan.findFirst({ where: { slug: 'premium-inmobiliaria' } });
  if (premiumPlan) {
    const existingRequest = await prisma.planSubscription.findFirst({
      where: { agentProfileId: demoAgent.id, planId: premiumPlan.id, status: SubscriptionStatus.PENDING_PAYMENT },
    });
    if (!existingRequest) {
      await prisma.planSubscription.create({
        data: {
          agentProfileId: demoAgent.id,
          planId: premiumPlan.id,
          status: SubscriptionStatus.PENDING_PAYMENT,
          receiptUrl: IMG('comprobante-demo'),
        },
      });
    }
  }

  console.log('\nListo. Cuenta demo para iniciar sesión:');
  console.log('  Correo: demo.inmobiliaria@ariz.local');
  console.log('  Clave:  Demo1234!');
  console.log(`  ${createdProperties.length} propiedades, ${LEAD_SEEDS.length} leads, 1 plan activo, 1 solicitud pendiente.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
