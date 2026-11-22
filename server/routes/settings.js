/**
 * Configuración del negocio, logo y copias de seguridad (exportar / restaurar en JSON).
 *
 * El backup es un JSON con todas las tablas. Se usa JSON (y no un archivo .sql o .db)
 * porque en Vercel no hay disco persistente ni acceso a mysqldump.
 */
const express = require('express');
const { db, getSettings } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { HttpError, validate } = require('../utils/http');

const router = express.Router();

const RULES = {
  business_name: { type: 'string', required: true, max: 100, label: 'El nombre del negocio' },
  business_ruc: { type: 'string', pattern: /^\d{8,11}$/, patternMessage: 'El RUC debe tener 11 dígitos', label: 'El RUC' },
  business_address: { type: 'string', max: 200, label: 'La dirección' },
  business_phone: { type: 'string', max: 30, label: 'El teléfono' },
  currency_symbol: { type: 'string', required: true, max: 5, label: 'El símbolo de moneda' },
  currency_code: { type: 'string', required: true, max: 3, label: 'El código de moneda' },
  tax_name: { type: 'string', required: true, max: 10, label: 'El nombre del impuesto' },
  tax_rate: { type: 'number', required: true, min: 0, max: 100, label: 'La tasa de impuesto' },
  tax_included: { type: 'boolean', default: false },
  ticket_series: { type: 'string', required: true, max: 6, pattern: /^[A-Za-z0-9]+$/, patternMessage: 'La serie solo admite letras y números', label: 'La serie' },
  ticket_footer: { type: 'string', max: 200, label: 'El pie del ticket' },
  expiry_alert_days: { type: 'integer', required: true, min: 1, max: 365, label: 'Los días de alerta' },
  allow_negative_stock: { type: 'boolean', default: false },
};

// Orden de tablas respetando llaves foráneas (padres primero)
const TABLES = ['settings', 'users', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'stock_movements'];

/** La configuración sin el logo (data URL pesada); el logo se sirve por /logo. */
async function publicSettings() {
  const s = await getSettings();
  s.has_logo = Boolean(s.business_logo);
  delete s.business_logo;
  return s;
}

// ---------- Rutas públicas (pantalla de login) ----------
router.get('/public', async (_req, res) => {
  const s = await getSettings();
  res.json({ business_name: s.business_name, has_logo: Boolean(s.business_logo) });
});

router.get('/logo', async (_req, res) => {
  const { business_logo: logo } = await getSettings();
  const m = logo && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(logo);
  if (!m) throw new HttpError(404, 'Sin logo');
  res.set('Cache-Control', 'public, max-age=300');
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
});

router.use(authenticate);

router.get('/', async (_req, res) => {
  res.json(await publicSettings());
});

router.put('/', authorize(), async (req, res) => {
  const data = validate(req.body, RULES);
  await db.tx(async (t) => {
    for (const [name, value] of Object.entries(data)) {
      const v = typeof value === 'boolean' ? (value ? '1' : '0') : value ?? '';
      await t.run('INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, String(v)]);
    }
  });
  res.json(await publicSettings());
});

router.put('/logo', authorize(), async (req, res) => {
  const image = String(req.body.image || '');
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new HttpError(400, 'Formato de imagen no válido');
  if (image.length > 900 * 1024) throw new HttpError(413, 'El logo es demasiado grande');
  await db.run("INSERT INTO settings (name, value) VALUES ('business_logo', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [image]);
  res.json(await publicSettings());
});

router.delete('/logo', authorize(), async (_req, res) => {
  await db.run("UPDATE settings SET value = '' WHERE name = 'business_logo'");
  res.json(await publicSettings());
});

// ---------- Backup: descarga JSON con todas las tablas ----------
router.get('/backup', authorize(), async (_req, res) => {
  const data = {};
  for (const table of TABLES) data[table] = await db.all(`SELECT * FROM ${table}`);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.set('Content-Disposition', `attachment; filename="backup-inventario-${stamp}.json"`);
  res.json({ app: 'inventario-pos', version: 1, created_at: new Date().toISOString(), tables: data });
});

// ---------- Restaurar: reemplaza TODOS los datos por los del backup ----------
router.post('/restore', authorize(), async (req, res) => {
  const backup = req.body;
  if (!backup || backup.app !== 'inventario-pos' || typeof backup.tables !== 'object') {
    throw new HttpError(400, 'El archivo no es un backup válido de este sistema');
  }
  for (const table of TABLES) {
    if (!Array.isArray(backup.tables[table])) throw new HttpError(400, `El backup no contiene la tabla "${table}"`);
  }
  if (!backup.tables.users.some((u) => u.role === 'admin' && u.active)) {
    throw new HttpError(400, 'El backup no tiene ningún administrador activo');
  }

  await db.tx(async (t) => {
    await t.run('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of [...TABLES].reverse()) await t.run(`DELETE FROM ${table}`);
      for (const table of TABLES) {
        const rows = backup.tables[table];
        if (!rows.length) continue;
        // Solo columnas que existen en la tabla actual (evita inyección por nombres de columna)
        const existing = (await t.all(`SHOW COLUMNS FROM ${table}`)).map((c) => c.Field);
        const cols = Object.keys(rows[0]).filter((c) => existing.includes(c));
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500).map((r) => cols.map((c) => r[c] ?? null));
          await t.run(`INSERT INTO ${table} (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES ?`, [chunk]);
        }
      }
    } finally {
      await t.run('SET FOREIGN_KEY_CHECKS = 1');
    }
  });

  res.json({ message: 'Datos restaurados correctamente. Vuelve a iniciar sesión.' });
});

module.exports = router;
