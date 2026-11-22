/**
 * Aplicación Express (API REST).
 * - En local la arranca server/index.js (y además sirve el frontend).
 * - En Vercel la exporta api/index.js como función serverless.
 */
const express = require('express');
const compression = require('compression');
const config = require('./config');
const { authenticate, authorize } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.IS_VERCEL ? true : 'loopback');
app.use(compression());
// Vercel limita el cuerpo de la petición a ~4.5 MB; en local se permite más (restauración de backups)
app.use(express.json({ limit: config.IS_VERCEL ? '4.5mb' : '25mb' }));

// Cabeceras de seguridad básicas
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const api = express.Router();

// ---------- Rutas públicas ----------
api.get('/health', async (_req, res) => {
  const { db } = require('./db');
  await db.get('SELECT 1');
  res.json({ ok: true, db: 'ok', time: new Date().toISOString() });
});
api.use('/auth', require('./routes/auth'));
api.use('/settings', require('./routes/settings')); // /public y /logo son públicos, el resto exige sesión
api.get('/products/:id/image', require('./routes/products').imageHandler);

// ---------- Rutas protegidas ----------
api.use(authenticate);
api.use('/dashboard', require('./routes/dashboard'));
api.use('/products', require('./routes/products'));
api.use('/categories', require('./routes/categories'));
api.use('/stock', authorize('almacenero', 'cajero'), require('./routes/stock'));
api.use('/sales', require('./routes/sales'));
api.use('/suppliers', authorize('almacenero'), require('./routes/suppliers'));
api.use('/reports', authorize(), require('./routes/reports'));
api.use('/users', authorize(), require('./routes/users'));
api.use(notFound);

app.use('/api', api);
app.use('/api', errorHandler);

module.exports = app;
