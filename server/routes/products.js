/**
 * Productos: listado con filtros, CRUD, imagen, búsqueda rápida (POS) e importación masiva.
 */
const express = require('express');
const { db, getSettings } = require('../db');
const { authorize } = require('../middleware/auth');
const { HttpError, validate, pagination } = require('../utils/http');
const { applyMovement, LOW_STOCK_SQL } = require('../utils/stock');

const router = express.Router();

// La imagen (data URL) no viaja en los listados: se pide aparte por /:id/image (cacheable)
const COLUMNS = `p.id, p.code, p.name, p.category_id, p.brand, p.presentation, p.purchase_price, p.sale_price,
  p.stock, p.min_stock, p.supplier_id, p.expiry_date, p.created_at, p.updated_at,
  (p.image IS NOT NULL) AS has_image`;
const BASE_SELECT = `
  SELECT ${COLUMNS}, c.name AS category_name, c.color AS category_color, s.name AS supplier_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id`;

const RULES = {
  code: { type: 'string', max: 60, label: 'El código' },
  name: { type: 'string', required: true, min: 2, max: 120, label: 'El nombre' },
  category_id: { type: 'integer', min: 1, label: 'La categoría' },
  brand: { type: 'string', max: 60, label: 'La marca' },
  presentation: { type: 'string', max: 60, label: 'La presentación' },
  purchase_price: { type: 'number', required: true, min: 0, max: 1000000, label: 'El precio de compra' },
  sale_price: { type: 'number', required: true, min: 0, max: 1000000, label: 'El precio de venta' },
  min_stock: { type: 'integer', min: 0, max: 1000000, default: 0, label: 'El stock mínimo' },
  supplier_id: { type: 'integer', min: 1, label: 'El proveedor' },
  expiry_date: { type: 'date', label: 'La fecha de vencimiento' },
};

// En la importación la categoría y el proveedor llegan por nombre, no por id
const { category_id: _c, supplier_id: _s, ...IMPORT_BASE } = RULES;
const IMPORT_RULES = { ...IMPORT_BASE, stock: { type: 'integer', min: 0, max: 1000000, label: 'El stock' } };

const SORTS = {
  name: 'p.name',
  code: 'p.code',
  stock: 'p.stock',
  sale_price: 'p.sale_price',
  purchase_price: 'p.purchase_price',
  category: 'c.name',
  expiry_date: 'p.expiry_date',
  created_at: 'p.created_at',
  margin: '(p.sale_price - p.purchase_price)',
};

const MAX_IMAGE_CHARS = 900 * 1024; // ~650 KB de imagen

/** Genera un código interno correlativo si el usuario no ingresa uno. */
async function nextCode(t = db) {
  const row = await t.get('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM products');
  return `PRD-${String(row.n).padStart(5, '0')}`;
}

async function getProduct(id, t = db) {
  const p = await t.get(`${BASE_SELECT} WHERE p.id = ? AND p.active = 1`, [id]);
  if (!p) throw new HttpError(404, 'Producto no encontrado');
  return p;
}

// ---------- Listado con búsqueda, filtros, orden y paginación ----------
router.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req.query, 15);
  const where = ['p.active = 1'];
  const params = {};

  if (req.query.q) {
    where.push('(p.name LIKE :q OR p.code LIKE :q OR p.brand LIKE :q OR c.name LIKE :q OR p.presentation LIKE :q)');
    params.q = `%${String(req.query.q).trim()}%`;
  }
  if (req.query.category_id) {
    where.push('p.category_id = :category_id');
    params.category_id = Number(req.query.category_id);
  }
  if (req.query.supplier_id) {
    where.push('p.supplier_id = :supplier_id');
    params.supplier_id = Number(req.query.supplier_id);
  }
  switch (req.query.status) {
    case 'low': where.push(`${LOW_STOCK_SQL} AND p.stock > 0`); break;
    case 'out': where.push('p.stock <= 0'); break;
    case 'ok': where.push('p.stock > p.min_stock'); break;
    case 'alert': where.push(LOW_STOCK_SQL); break;
    case 'expiring':
      where.push('p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL :days DAY)');
      params.days = Number((await getSettings()).expiry_alert_days) || 30;
      break;
    default: break;
  }

  const sort = SORTS[req.query.sort] || 'p.name';
  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const { total } = await db.get(`SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`, params);
  const data = await db.all(`${BASE_SELECT} ${whereSql} ORDER BY ${sort} ${order}, p.id ASC LIMIT :limit OFFSET :offset`, { ...params, limit, offset });

  res.json({ data, total, page, limit });
});

// ---------- Búsqueda rápida para el POS (código exacto o nombre) ----------
router.get('/lookup', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const exact = await db.get(`${BASE_SELECT} WHERE p.active = 1 AND p.code = ?`, [q]);
  if (exact) return res.json([exact]);
  res.json(await db.all(`${BASE_SELECT} WHERE p.active = 1 AND (p.name LIKE :q OR p.code LIKE :q OR p.brand LIKE :q) ORDER BY p.name LIMIT 20`, { q: `%${q}%` }));
});

router.get('/:id', async (req, res) => {
  res.json(await getProduct(req.params.id));
});

// Kardex de un producto
router.get('/:id/movements', async (req, res) => {
  await getProduct(req.params.id);
  res.json(
    await db.all(
      `SELECT m.*, u.full_name AS user_name FROM stock_movements m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
      [req.params.id]
    )
  );
});

// ---------- Crear ----------
router.post('/', authorize('almacenero'), async (req, res) => {
  const data = validate(req.body, {
    ...RULES,
    stock: { type: 'integer', min: 0, max: 1000000, default: 0, label: 'El stock inicial' },
  });

  const id = await db.tx(async (t) => {
    data.code = data.code || (await nextCode(t));
    const info = await t.run(
      `INSERT INTO products (code, name, category_id, brand, presentation, purchase_price, sale_price, stock, min_stock, supplier_id, expiry_date)
       VALUES (:code, :name, :category_id, :brand, :presentation, :purchase_price, :sale_price, 0, :min_stock, :supplier_id, :expiry_date)`,
      data
    );
    if (data.stock > 0) {
      await applyMovement(t, {
        productId: info.insertId, type: 'entrada', quantity: data.stock, unitCost: data.purchase_price,
        reason: 'Stock inicial', supplierId: data.supplier_id, userId: req.user.id,
      });
    }
    return info.insertId;
  });

  res.status(201).json(await getProduct(id));
});

// ---------- Editar (el stock NO se edita aquí: se usa Control de Stock) ----------
router.put('/:id', authorize('almacenero'), async (req, res) => {
  const current = await getProduct(req.params.id);
  const data = validate(req.body, RULES);
  data.code = data.code || current.code;
  await db.run(
    `UPDATE products SET code=:code, name=:name, category_id=:category_id, brand=:brand, presentation=:presentation,
      purchase_price=:purchase_price, sale_price=:sale_price, min_stock=:min_stock, supplier_id=:supplier_id, expiry_date=:expiry_date
     WHERE id=:id`,
    { ...data, id: current.id }
  );
  res.json(await getProduct(current.id));
});

// ---------- Imagen (pública para poder usarla en <img>; la URL incluye ?v= para caché) ----------
// Se monta en app.js ANTES de la autenticación (las etiquetas <img> no envían el token)
async function imageHandler(req, res) {
  const row = await db.get('SELECT image FROM products WHERE id = ?', [req.params.id]);
  const m = row && row.image && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(row.image);
  if (!m) throw new HttpError(404, 'Sin imagen');
  res.set('Cache-Control', 'public, max-age=604800, immutable');
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}

router.put('/:id/image', authorize('almacenero'), async (req, res) => {
  const current = await getProduct(req.params.id);
  const image = String(req.body.image || '');
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw new HttpError(400, 'Formato de imagen no válido (usa JPG, PNG o WEBP)');
  }
  if (image.length > MAX_IMAGE_CHARS) throw new HttpError(413, 'La imagen es demasiado grande');
  await db.run('UPDATE products SET image = ? WHERE id = ?', [image, current.id]);
  res.json(await getProduct(current.id));
});

router.delete('/:id/image', authorize('almacenero'), async (req, res) => {
  const current = await getProduct(req.params.id);
  await db.run('UPDATE products SET image = NULL WHERE id = ?', [current.id]);
  res.json(await getProduct(current.id));
});

// ---------- Eliminar ----------
// Si tiene historial se desactiva (para no romper reportes) y se libera su código.
router.delete('/:id', authorize(), async (req, res) => {
  const current = await getProduct(req.params.id);
  const { used } = await db.get(
    `SELECT (SELECT COUNT(*) FROM sale_items WHERE product_id = :id) + (SELECT COUNT(*) FROM stock_movements WHERE product_id = :id) AS used`,
    { id: current.id }
  );
  if (used) {
    await db.run("UPDATE products SET active = 0, code = CONCAT(LEFT(code, 50), '~', id) WHERE id = ?", [current.id]);
  } else {
    await db.run('DELETE FROM products WHERE id = ?', [current.id]);
  }
  res.json({ message: 'Producto eliminado' });
});

// ---------- Importación masiva (desde Excel/CSV parseado en el navegador) ----------
router.post('/import', authorize('almacenero'), async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
  if (!rows || !rows.length) throw new HttpError(400, 'El archivo no contiene filas');
  if (rows.length > 2000) throw new HttpError(400, 'Máximo 2000 productos por importación');

  // 1) Validar todo antes de escribir
  const result = { created: 0, updated: 0, errors: [] };
  const valid = [];
  rows.forEach((raw, i) => {
    try {
      const data = validate(raw, IMPORT_RULES);
      data.category = raw.category ? String(raw.category).trim().slice(0, 60) : null;
      data.supplier = raw.supplier ? String(raw.supplier).trim().slice(0, 120) : null;
      valid.push({ line: i + 2, data }); // fila 1 = encabezados
    } catch (err) {
      result.errors.push({ row: i + 2, message: err.message });
    }
  });

  // 2) Escribir en una sola transacción
  await db.tx(async (t) => {
    const settings = await getSettings(t);
    const cache = { cat: new Map(), sup: new Map() };
    const resolve = async (kind, name) => {
      if (!name) return null;
      const key = name.toLowerCase();
      if (cache[kind].has(key)) return cache[kind].get(key);
      const table = kind === 'cat' ? 'categories' : 'suppliers';
      const extra = kind === 'sup' ? ' AND active = 1' : '';
      const row = await t.get(`SELECT id FROM ${table} WHERE name = ?${extra} LIMIT 1`, [name]);
      const id = row ? row.id : (await t.run(`INSERT INTO ${table} (name) VALUES (?)`, [name])).insertId;
      cache[kind].set(key, id);
      return id;
    };

    for (const { line, data } of valid) {
      try {
        data.category_id = await resolve('cat', data.category);
        data.supplier_id = await resolve('sup', data.supplier);
        data.code = data.code || (await nextCode(t));
        const existing = await t.get('SELECT id, stock FROM products WHERE code = ? AND active = 1', [data.code]);
        if (existing) {
          await t.run(
            `UPDATE products SET name=:name, category_id=:category_id, brand=:brand, presentation=:presentation,
              purchase_price=:purchase_price, sale_price=:sale_price, min_stock=:min_stock, supplier_id=:supplier_id, expiry_date=:expiry_date
             WHERE id=:id`,
            { ...data, id: existing.id }
          );
          if (data.stock !== null && data.stock !== existing.stock) {
            await applyMovement(t, { productId: existing.id, type: 'ajuste', quantity: data.stock - existing.stock, reason: 'Ajuste por importación', userId: req.user.id }, settings);
          }
          result.updated += 1;
        } else {
          const info = await t.run(
            `INSERT INTO products (code, name, category_id, brand, presentation, purchase_price, sale_price, stock, min_stock, supplier_id, expiry_date)
             VALUES (:code, :name, :category_id, :brand, :presentation, :purchase_price, :sale_price, 0, :min_stock, :supplier_id, :expiry_date)`,
            data
          );
          if (data.stock > 0) {
            await applyMovement(t, { productId: info.insertId, type: 'entrada', quantity: data.stock, unitCost: data.purchase_price, reason: 'Stock inicial (importación)', userId: req.user.id }, settings);
          }
          result.created += 1;
        }
      } catch (err) {
        if (!(err instanceof HttpError) && err.code !== 'ER_DUP_ENTRY') throw err;
        result.errors.push({ row: line, message: err.code === 'ER_DUP_ENTRY' ? 'Código duplicado' : err.message });
      }
    }
  });

  res.json(result);
});

module.exports = router;
module.exports.imageHandler = imageHandler;
