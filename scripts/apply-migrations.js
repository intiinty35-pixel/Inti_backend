/**
 * Aplica las migraciones de prisma/migrations manualmente usando `pg`.
 *
 * Se usa como alternativa a `prisma migrate deploy` cuando el motor de
 * migraciones del CLI se cuelga contra el pooler de Supabase (Supavisor).
 * Replica el comportamiento de `migrate deploy`: crea la tabla
 * `_prisma_migrations`, ejecuta cada migración pendiente en una transaccion
 * y registra su nombre y checksum.
 *
 * Uso: node scripts/apply-migrations.js
 * Requiere DIRECT_URL (o DATABASE_URL) en el entorno / .env
 */
require('dotenv/config');
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.');
  process.exit(1);
}

function checksumOf(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pendingMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

async function main() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  console.log('Conectado.');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"              VARCHAR(64) NOT NULL,
      "finished_at"           TIMESTAMPTZ,
      "migration_name"        VARCHAR(255) NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        TIMESTAMPTZ,
      "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    );
  `);

  const { rows } = await client.query(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  const applied = new Set(rows.map((r) => r.migration_name));

  let count = 0;
  for (const name of pendingMigrations()) {
    if (applied.has(name)) {
      console.log(`- ${name} (ya aplicada)`);
      continue;
    }
    const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
    const sql = fs.readFileSync(file, 'utf8');
    const checksum = checksumOf(file);
    const id = crypto.randomUUID();

    console.log(`Aplicando ${name}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES ($1, $2, now(), $3, 1)`,
        [id, checksum, name],
      );
      await client.query('COMMIT');
      console.log(`  OK ${name}`);
      count += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FALLO ${name}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  );
  console.log(`\nMigraciones aplicadas en esta corrida: ${count}`);
  console.log(`Tablas en public: ${tables.rows.map((r) => r.tablename).join(', ')}`);

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
