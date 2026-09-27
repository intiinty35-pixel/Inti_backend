const REQUIRED = ['DATABASE_URL', 'CLOUDINARY_URL', 'FIREBASE_PROJECT_ID', 'JWT_SECRET', 'FRONTEND_URL'] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  return config;
}
