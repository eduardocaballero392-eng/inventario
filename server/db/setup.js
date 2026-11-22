/**
 * Instalación de la base de datos MySQL.
 *
 *   npm run db:setup         -> crea las tablas (si no existen) y carga datos de demostración si está vacía
 *   npm run db:setup:clean   -> crea las tablas y deja SOLO el usuario admin + categorías básicas
 *   npm run db:reset         -> BORRA todas las tablas y vuelve a cargar la demostración
 *
 * Se ejecuta desde tu PC apuntando a la base local o a la base en la nube (según .env).
 * Modo demo: catálogo de seed.sql + usuarios + ~45 días de ventas simuladas, con un
 * kardex coherente (el stock final coincide con el de seed.sql). Se inserta por lotes
 * para que sea rápido incluso contra una base remota.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { DEFAULT_SETTINGS } = require('./index');
const { businessNow } = require('../utils/http');

const USERS = [
  { username: 'admin', password: 'admin123', full_name: 'Administrador', role: 'admin' },
  { username: 'cajero', password: 'cajero123', full_name: 'Lucía Fernández', role: 'cajero' },
  { username: 'almacen', password: 'almacen123', full_name: 'Jorge Mendoza', role: 'almacenero' },
];
const TABLES = ['stock_movements', 'sale_items', 'sales', 'products', 'suppliers', 'categories', 'users', 'settings'];

// ---------- utilidades ----------
const pad = (n) => String(n).padStart(2, '0');
/** Date "local del negocio" (campos UTC) -> 'YYYY-MM-DD HH:MM:SS' */
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function weightedPick(items, weightFn) {
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

async function connect() {
  const c = config.db;
  const opts = { multipleStatements: true, dateStrings: true, decimalNumbers: true, charset: 'utf8mb4' };
  if (c.ssl) opts.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  if (c.url) return mysql.createConnection({ uri: c.url, ...opts });

  // En local se crea la base si no existe (WAMP/XAMPP/Docker)
  const server = await mysql.createConnection({ host: c.host, port: c.port, user: c.user, password: c.password, ...opts });
  await server.query(`CREATE DATABASE IF NOT EXISTS \`${c.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await server.changeUser({ database: c.database });
  return server;
}

/** Inserta filas en lotes: INSERT INTO t (cols) VALUES ? */
async function bulkInsert(conn, table, cols, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    await conn.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ?`, [rows.slice(i, i + 1000)]);
  }
}

// ---------- datos de demostración ----------
async function seedDemo(conn) {
  await conn.query(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
  const settings = {
    business_name: 'Bodega Don Pepe',
    business_ruc: '20612345678',
    business_address: 'Av. Los Héroes 345, San Juan de Miraflores',
    business_phone: '987 123 456',
  };
  for (const [k, v] of Object.entries(settings)) await conn.query('UPDATE settings SET value = ? WHERE name = ?', [v, k]);

  const [userRows] = await conn.query('SELECT id, role FROM users');
  const admin = userRows.find((u) => u.role === 'admin').id;
  const cashier = userRows.find((u) => u.role === 'cajero').id;
  const keeper = userRows.find((u) => u.role === 'almacenero').id;

  const [products] = await conn.query('SELECT * FROM products ORDER BY id');
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const target = Object.fromEntries(products.map((p) => [p.id, p.stock])); // stock final deseado

  const popularity = { 1: 5, 2: 6, 3: 3, 4: 2, 5: 1.5, 6: 2, 7: 1 };
  const DAYS = 45;
  const now = businessNow();
  const events = []; // { at: Date, kind, ... } se ordenan cronológicamente

  // 1) Ventas simuladas
  const sales = [];
  for (let d = DAYS - 1; d >= 0; d -= 1) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - d);
    const weekend = [0, 5, 6].includes(day.getUTCDay());
    const count = rand(weekend ? 22 : 12, weekend ? 38 : 24);
    for (let i = 0; i < count; i += 1) {
      const t = new Date(day);
      t.setUTCHours(rand(8, 22), rand(0, 59), rand(0, 59));
      if (t > now) continue;
      const lines = new Map();
      for (let l = 0, n = rand(1, 4); l < n; l += 1) {
        const p = weightedPick(products, (x) => popularity[x.category_id] || 1);
        lines.set(p.id, (lines.get(p.id) || 0) + (p.category_id === 2 ? rand(1, 6) : rand(1, 3)));
      }
      sales.push({ at: t, lines });
    }
  }
  sales.sort((a, b) => a.at - b.at);
  // Dos ventas anuladas de ejemplo (en la parte temprana del historial)
  const cancelIdx = new Set([Math.floor(sales.length * 0.25), Math.floor(sales.length * 0.4)]);

  // 2) Mermas de ejemplo
  const mermas = [
    { code: '7750243001015', qty: 3, reason: 'Botellas rotas al descargar', d: 30 },
    { code: '7750168001015', qty: 2, reason: 'Producto vencido', d: 18 },
    { code: '7750182001017', qty: 1, reason: 'Envase dañado', d: 6 },
  ]
    .map((m) => ({ ...m, product: products.find((p) => p.code === m.code) }))
    .filter((m) => m.product);

  // 3) Consumo neto por producto -> cantidad de la entrada inicial
  const consumed = {};
  sales.forEach((s, idx) => {
    if (cancelIdx.has(idx)) return;
    s.lines.forEach((q, id) => { consumed[id] = (consumed[id] || 0) + q; });
  });
  mermas.forEach((m) => { consumed[m.product.id] = (consumed[m.product.id] || 0) + m.qty; });

  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - DAYS);
  start.setUTCHours(7, 30, 0);
  for (const p of products) {
    const qty = target[p.id] + (consumed[p.id] || 0);
    if (qty > 0) events.push({ at: start, kind: 'mov', productId: p.id, type: 'entrada', qty, cost: p.purchase_price, reason: 'Inventario inicial', ref: 'INV-INICIAL', supplier: p.supplier_id, user: keeper });
  }
  for (const m of mermas) {
    const t = new Date(now);
    t.setUTCDate(now.getUTCDate() - m.d);
    t.setUTCHours(9, 15, 0);
    events.push({ at: t, kind: 'mov', productId: m.product.id, type: 'merma', qty: -m.qty, reason: m.reason, user: keeper });
  }

  // 4) Construir filas de ventas, detalle y movimientos
  const payments = [['efectivo', 50], ['yape', 25], ['plin', 8], ['tarjeta', 12], ['transferencia', 5]];
  const saleRows = [];
  const itemRows = [];
  sales.forEach((s, idx) => {
    const id = idx + 1;
    const number = `B001-${String(id).padStart(8, '0')}`;
    const total = round2([...s.lines].reduce((sum, [pid, q]) => sum + byId[pid].sale_price * q, 0));
    const subtotal = round2(total / 1.18);
    const method = weightedPick(payments, (x) => x[1])[0];
    const options = [10, 20, 50, 100, 200].filter((v) => v >= total);
    const received = method === 'efectivo' ? (Math.random() < 0.3 || !options.length ? total : options[0]) : total;
    const cancelled = cancelIdx.has(idx);
    const cancelAt = new Date(s.at.getTime() + 4 * 60000);
    const user = Math.random() < 0.8 ? cashier : admin;

    saleRows.push([
      id, number, subtotal, round2(total - subtotal), 0, total, method, received, round2(received - total), user, fmt(s.at),
      cancelled ? 'anulada' : 'completada', cancelled ? admin : null, cancelled ? 'Error en el registro del cajero' : null, cancelled ? fmt(cancelAt) : null,
    ]);
    s.lines.forEach((q, pid) => {
      const p = byId[pid];
      itemRows.push([id, pid, p.code, p.name, q, p.sale_price, p.purchase_price, round2(p.sale_price * q)]);
      events.push({ at: s.at, kind: 'mov', productId: pid, type: 'venta', qty: -q, cost: p.purchase_price, reason: 'Venta', ref: number, user });
      if (cancelled) {
        events.push({ at: cancelAt, kind: 'mov', productId: pid, type: 'anulacion', qty: q, cost: p.purchase_price, reason: 'Anulación: Error en el registro del cajero', ref: number, user: admin });
      }
    });
  });

  // 5) Kardex en orden cronológico con stock antes/después
  events.sort((a, b) => a.at - b.at);
  const running = {};
  const movRows = events.map((e) => {
    const before = running[e.productId] || 0;
    running[e.productId] = before + e.qty;
    return [e.productId, e.type, e.qty, before, running[e.productId], e.cost ?? null, e.reason ?? null, e.ref ?? null, e.supplier ?? null, e.user ?? null, fmt(e.at)];
  });

  await bulkInsert(conn, 'sales',
    ['id', 'number', 'subtotal', 'tax', 'discount', 'total', 'payment_method', 'amount_received', 'change_given', 'user_id', 'created_at', 'status', 'cancelled_by', 'cancel_reason', 'cancelled_at'],
    saleRows);
  await bulkInsert(conn, 'sale_items', ['sale_id', 'product_id', 'product_code', 'product_name', 'quantity', 'unit_price', 'unit_cost', 'subtotal'], itemRows);
  await bulkInsert(conn, 'stock_movements',
    ['product_id', 'type', 'quantity', 'stock_before', 'stock_after', 'unit_cost', 'reason', 'reference', 'supplier_id', 'user_id', 'created_at'],
    movRows);

  for (const p of products) await conn.query('UPDATE products SET stock = ? WHERE id = ?', [running[p.id] || 0, p.id]);
  await conn.query("UPDATE settings SET value = ? WHERE name = 'ticket_next_number'", [String(sales.length + 1)]);

  return { products: products.length, sales: sales.length, movements: movRows.length };
}

// ---------- programa principal ----------
async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const demo = !args.includes('--clean');
  const target = config.db.url ? 'DATABASE_URL' : `${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`;
  console.log(`\nConectando a MySQL (${target})...`);

  const conn = await connect();
  try {
    await conn.query(`SET time_zone = '${config.TZ_OFFSET}'`);

    if (reset) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of TABLES) await conn.query(`DROP TABLE IF EXISTS ${t}`);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('  ✓ Tablas anteriores eliminadas');
    }

    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('  ✓ Tablas creadas / verificadas');

    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await conn.query('INSERT IGNORE INTO settings (name, value) VALUES (?, ?)', [k, v]);
    }

    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
    if (n > 0) {
      console.log('  • La base ya tiene usuarios: no se cargan datos de ejemplo (usa "npm run db:reset" para reiniciar).\n');
      return;
    }

    await conn.beginTransaction();
    const users = demo ? USERS : USERS.slice(0, 1);
    for (const u of users) {
      await conn.query('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)', [u.username, await bcrypt.hash(u.password, 10), u.full_name, u.role]);
    }
    if (demo) {
      const r = await seedDemo(conn);
      console.log(`  ✓ Demo: ${r.products} productos, ${r.sales} ventas, ${r.movements} movimientos de stock`);
    } else {
      await conn.query("INSERT INTO categories (name, color) VALUES ('Gaseosas','#2563eb'), ('Cervezas','#d97706'), ('Aguas','#0891b2'), ('Otros','#64748b')");
    }
    await conn.commit();

    console.log('\n  Listo. Usuario administrador:  admin / admin123');
    if (demo) console.log('  Cajero: cajero / cajero123   |   Almacenero: almacen / almacen123');
    console.log('  IMPORTANTE: cambia las contraseñas desde el módulo Usuarios.\n');
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`\n  [ERROR] ${err.code || ''} ${err.message}`);
  if (['ECONNREFUSED', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'].includes(err.code)) {
    console.error('  Revisa los datos de conexión en el archivo .env (ver .env.example).');
  }
  process.exit(1);
});
