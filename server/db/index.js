/**
 * Conexión a MySQL con un pool (mysql2/promise).
 *
 * API mínima usada por todas las rutas:
 *   db.all(sql, params)   -> filas
 *   db.get(sql, params)   -> primera fila o undefined
 *   db.run(sql, params)   -> { insertId, affectedRows }
 *   db.tx(async (t) => {...})  -> transacción; `t` tiene all/get/run
 *
 * Los parámetros pueden ser posicionales (?) o con nombre (:nombre).
 */
const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

function getPool() {
  if (pool) return pool;
  const c = config.db;
  const base = {
    waitForConnections: true,
    // En serverless cada instancia abre pocas conexiones para no agotar el límite del proveedor
    connectionLimit: config.IS_VERCEL ? 3 : 10,
    namedPlaceholders: true,
    dateStrings: true,     // fechas como 'YYYY-MM-DD HH:MM:SS' (sin conversiones de zona)
    decimalNumbers: true,  // DECIMAL como número JS
    timezone: config.TZ_OFFSET,
    charset: 'utf8mb4',
  };
  const ssl = c.ssl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {};

  pool = c.url
    ? mysql.createPool({ uri: c.url, ...base, ...ssl })
    : mysql.createPool({ host: c.host, port: c.port, user: c.user, password: c.password, database: c.database, ...base, ...ssl });

  // Cada conexión trabaja en la hora local del negocio: NOW(), CURDATE() y los DEFAULT usan esa zona
  pool.pool.on('connection', (conn) => {
    conn.query(`SET time_zone = '${config.TZ_OFFSET.replace(/[^0-9:+-]/g, '')}'`);
  });
  return pool;
}

function executor(target) {
  return {
    async all(sql, params = {}) {
      const [rows] = await target().query(sql, params);
      return rows;
    },
    async get(sql, params = {}) {
      const [rows] = await target().query(sql, params);
      return rows[0];
    },
    async run(sql, params = {}) {
      const [result] = await target().query(sql, params);
      return result;
    },
  };
}

const db = {
  ...executor(getPool),

  /** Ejecuta `fn` dentro de una transacción; hace rollback si algo falla. */
  async tx(fn) {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(executor(() => conn));
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  },

  async close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};

/** Lee toda la configuración del negocio como objeto { clave: valor }. */
async function getSettings(t = db) {
  const rows = await t.all('SELECT name, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}

const DEFAULT_SETTINGS = {
  business_name: 'Mi Bodega',
  business_ruc: '',
  business_address: '',
  business_phone: '',
  business_logo: '',
  currency_symbol: 'S/',
  currency_code: 'PEN',
  tax_name: 'IGV',
  tax_rate: '18',
  tax_included: '1',
  ticket_series: 'B001',
  ticket_next_number: '1',
  ticket_footer: '¡Gracias por su compra! Vuelva pronto.',
  expiry_alert_days: '30',
  allow_negative_stock: '0',
};

module.exports = { db, getSettings, DEFAULT_SETTINGS };
