const REQUIRED = ['DATABASE_URL', 'CLOUDINARY_URL', 'FIREBASE_PROJECT_ID', 'JWT_SECRET', 'FRONTEND_URL'] as const;

/**
 * Valores de ejemplo que aparecen en .env.example. Si alguno llega al arranque
 * significa que nadie configuro el entorno real: abortamos antes de firmar
 * tokens o exponer datos con credenciales conocidas publicamente.
 */
const PLACEHOLDER_PATTERNS = [
  /cambia/i,
  /reemplaza/i,
  /^your_/i,
  /_aqui$/i,
  /^changeme$/i,
  /^secret$/i,
  /^password$/i,
] as const;

function isPlaceholder(value: string) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * `no-verify` desactiva la validacion del certificado TLS del servidor y deja
 * la conexion a la base de datos expuesta a un ataque man-in-the-middle.
 * Solo se admite en entornos locales explicitamente marcados como tales.
 */
function assertSecureDatabaseUrls(config: Record<string, unknown>, isProduction: boolean) {
  const keys = ['DATABASE_URL', 'DIRECT_URL'] as const;
  for (const key of keys) {
    const value = config[key];
    if (typeof value !== 'string' || value.length === 0) continue;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${key} no es una URL de conexion valida`);
    }

    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error(`${key} debe usar el esquema postgresql://`);
    }

    const sslmode = parsed.searchParams.get('sslmode');
    if (sslmode === 'disable' || sslmode === 'no-verify') {
      throw new Error(
        `${key} usa sslmode=${sslmode}, que desactiva la verificacion del certificado TLS. ` +
          'Usa sslmode=verify-full con sslrootcert apuntando a la CA de Supabase.',
      );
    }

    if (isProduction && sslmode !== 'verify-full') {
      throw new Error(
        `${key} debe usar sslmode=verify-full en produccion (valor actual: ${sslmode ?? 'no definido'}).`,
      );
    }

    // verify-full solo verifica si ademas se le entrega la CA raiz de Supabase.
    // Sin sslrootcert el driver cae a la cadena del sistema y la conexion
    // falla con "self-signed certificate in certificate chain".
    if (sslmode === 'verify-full' && !parsed.searchParams.get('sslrootcert')) {
      throw new Error(
        `${key} usa sslmode=verify-full pero no define sslrootcert. ` +
          'Anade &sslrootcert=certs/prod-ca-2021.crt a la cadena de conexion.',
      );
    }
  }
}

function assertCloudinaryUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('CLOUDINARY_URL no es una URL valida');
  }

  if (parsed.protocol !== 'cloudinary:') {
    throw new Error('CLOUDINARY_URL debe usar el esquema cloudinary://apiKey:apiSecret@cloudName');
  }
  if (!parsed.username || !parsed.password || !parsed.hostname) {
    throw new Error('CLOUDINARY_URL debe incluir apiKey, apiSecret y cloudName');
  }
  if (isPlaceholder(parsed.username) || isPlaceholder(parsed.password)) {
    throw new Error('CLOUDINARY_URL sigue usando las credenciales de ejemplo');
  }
}

function assertFrontendUrl(value: string, isProduction: boolean) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('FRONTEND_URL no es una URL valida');
  }

  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error('FRONTEND_URL debe usar https en produccion: es el origen de CORS y de las cookies de sesion');
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  const isProduction = String(config.NODE_ENV) === 'production';

  const jwtSecret = String(config.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  if (isPlaceholder(jwtSecret)) {
    throw new Error(
      'JWT_SECRET sigue siendo un valor de ejemplo. Genera uno con: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64url\'))"',
    );
  }

  assertSecureDatabaseUrls(config, isProduction);
  assertCloudinaryUrl(String(config.CLOUDINARY_URL));
  assertFrontendUrl(String(config.FRONTEND_URL), isProduction);

  // Solo el seed del administrador consume estas variables, pero validarlas aqui
  // evita crear una cuenta admin con una clave trivial.
  if (config.ADMIN_PASSWORD !== undefined) {
    const adminPassword = String(config.ADMIN_PASSWORD);
    if (adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
    }
    if (isPlaceholder(adminPassword)) {
      throw new Error('ADMIN_PASSWORD sigue siendo un valor de ejemplo');
    }
  }

  return config;
}

