/**
 * Configuración central del servidor (leída desde variables de entorno).
 * En local se cargan desde el archivo .env; en Vercel desde
 * Project Settings → Environment Variables.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const ROOT = path.resolve(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);

if (!process.env.JWT_SECRET) {
  const msg = 'Falta la variable JWT_SECRET (ver .env.example)';
  if (IS_VERCEL || process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(`[AVISO] ${msg}. Se usa un secreto temporal solo para desarrollo.`);
}

module.exports = {
  ROOT,
  IS_VERCEL,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '12h',

  // Zona horaria del negocio (Perú = -05:00). Se usa en MySQL y en el cálculo de "hoy".
  TZ_OFFSET: process.env.TZ_OFFSET || '-05:00',

  db: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventario',
    ssl: process.env.DB_SSL === 'true',
  },
};
