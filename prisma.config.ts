import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Las migraciones requieren session mode (puerto 5432): el transaction mode
    // del pooler (5432/6543) no soporta los advisory locks que usa Prisma.
    url: env('DIRECT_URL') || env('DATABASE_URL'),
  },
});
