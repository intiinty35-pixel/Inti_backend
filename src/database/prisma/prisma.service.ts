import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../../generated/prisma/client';



/**
 * pg resuelve sslrootcert contra process.cwd(), no contra la raiz del proyecto.
 * Aqui convertimos la ruta relativa del .env en absoluta y leemos el PEM, para
 * que `sslmode=verify-full` siga verificando el servidor aunque el proceso se
 * lance desde otro directorio (pm2, contenedores, tareas programadas).
 */
function buildSslConfig(connectionString: string) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return undefined;
  }

  if (parsed.searchParams.get('sslmode') !== 'verify-full') return undefined;

  const rootCert = parsed.searchParams.get('sslrootcert');
  if (!rootCert) {
    throw new Error(
      'DATABASE_URL usa sslmode=verify-full pero no define sslrootcert. ' +
        'Anade &sslrootcert=certs/prod-ca-2021.crt a la cadena de conexion.',
    );
  }

  const certPath = resolve(process.cwd(), rootCert);
  try {
    return { ca: readFileSync(certPath, 'utf8'), rejectUnauthorized: true };
  } catch {
    throw new Error(`No se pudo leer el certificado sslrootcert en ${certPath}`);
  }
}

/**
 * Construye las opciones del PrismaClient. Al ser una funcion de modulo puede
 * evaluarse como argumento de super() (en la clase derivada no se permite
 * acceder a `this` ni asignar locales antes de llamar a super()).
 */
function buildPrismaOptions(config: ConfigService) {
  const connectionString = config.getOrThrow<string>('DATABASE_URL');
  return {
    adapter: new PrismaPg({
      connectionString,
      ssl: buildSslConfig(connectionString),
      max: Number(config.get<string>('DATABASE_POOL_MAX', '10')),
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      application_name: 'ariz-backend',
    }),
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    // Ojo: en una clase derivada no se puede evaluar nada antes de super().
    // Por eso el adapter se construye con helpers de modulo, no con `this`.
    super(buildPrismaOptions(config));
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
