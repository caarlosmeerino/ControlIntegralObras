// Configuración por variables de entorno (Railway las inyecta en el servicio)
const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) {
  console.error('[config] Falta JWT_SECRET en producción. Defínela en las variables del servicio.');
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(env.PORT || 3000),
  databaseUrl: env.DATABASE_URL || 'postgres://cio:cio@localhost:5432/cio',
  dbSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || 'desarrollo-no-usar-en-produccion',
  sessionHours: Number(env.SESSION_HOURS || 12),
  admin: {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || 'admin1234',
    nombre: env.ADMIN_NOMBRE || 'Administrador',
  },
  storage: {
    driver: env.STORAGE_DRIVER || (env.S3_BUCKET || env.BUCKET ? 's3' : 'local'),
    localDir: env.UPLOAD_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || './uploads',
    bucket: env.S3_BUCKET || env.BUCKET,
    region: env.S3_REGION || env.REGION || 'auto',
    endpoint: env.S3_ENDPOINT || env.ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID || env.ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.SECRET_ACCESS_KEY,
    maxFileMb: Number(env.MAX_FILE_MB || 25),
  },
  backups: {
    enabled: env.BACKUP_ENABLED !== 'false',
    cron: env.BACKUP_CRON || '30 2 * * *',  // todos los días a las 02:30
    keep: Number(env.BACKUP_KEEP || 14),
  },
  reportsCron: env.REPORTS_CRON || '0 6 * * *',
  timezone: env.TZ || 'Europe/Madrid',
  publicUrl: env.PUBLIC_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : ''),
};
