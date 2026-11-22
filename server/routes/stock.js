/**
 * Control de stock: entradas (compras), salidas, mermas, ajustes, historial y alertas.
 */
const express = require('express');
const { db, getSettings } = require('../db');
const { authorize } = require('../middleware/auth');
const { HttpError, validate, pagination } = require('../utils/http');
const { applyMovement, LOW_STOCK_SQL } = require('../utils/stock');

const router = express.Router();

const MANUAL_TYPES = ['entrada', 'salida', 'merma', 'ajuste'];
const ALL_TYPES = [...MANUAL_TYPES, 'venta', 'anulacion'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Historial de movimientos ----------
router.get('/movements', async (req, res) => {
  const { page, limit, offset } = pagination(req.query, 20);
  const where = ['1 = 1'];
  const params = {};

  if (req.query.product_id) { where.push('m.product_id = :product_id'); params.product_id = Number(req.query.product_id); }
  if (ALL_TYPES.includes(req.query.type)) { where.push('m.type = :type'); params.type = req.query.type; }
  if (DATE_RE.test(req.query.from || '')) { where.push('m.created_at >= :from'); params.from = `${req.query.from} 00:00:00`; }
  if (DATE_RE.test(req.query.to || '')) { where.push('m.created_at <= :to'); params.to = `${req.query.to} 23:59:59`; }
  if (req.query.q) { where.push('(p.name LIKE :q OR p.code LIKE :q OR m.reason LIKE :q OR m.reference LIKE :q)'); params.q = `%${req.query.q}%`; }

  const from = `FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE ${where.join(' AND ')}`;

  const { total } = await db.get(`SELECT COUNT(*) AS total ${from}`, params);
  const data = await db.all(
    `SELECT m.*, p.name AS product_name, p.code AS product_code, p.presentation, u.full_name AS user_name, s.name AS supplier_name
     ${from} ORDER BY m.created_at DESC, m.id DESC LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );
  res.json({ data, total, page, limit });
});

// ---------- Registrar movimiento(s) ----------
/**
 * Body: { type, reason, reference, supplier_id, update_cost, items: [{ product_id, quantity, unit_cost, new_stock }] }
 * - entrada: suma quantity (permite varias líneas, como una factura de compra)
 * - salida / merma: resta quantity
 * - ajuste: fija el stock en new_stock (conteo físico)
 */
router.post('/movements', authorize('almacenero'), async (req, res) => {
  const head = validate(req.body, {
    type: { type: 'string', required: true, enum: MANUAL_TYPES, label: 'El tipo de movimiento' },
    reason: { type: 'string', max: 200, label: 'El motivo' },
    reference: { type: 'string', max: 60, label: 'La referencia' },
    supplier_id: { type: 'integer', min: 1, label: 'El proveedor' },
    update_cost: { type: 'boolean', default: false },
  });
  if (head.type !== 'entrada' && !head.reason) {
    throw new HttpError(400, 'Debes indicar el motivo o justificación del movimiento');
  }
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) throw new HttpError(400, 'Agrega al menos un producto');
  if (rawItems.length > 200) throw new HttpError(400, 'Máximo 200 productos por movimiento');

  const items = rawItems.map((raw) =>
    validate(raw, {
      product_id: { type: 'integer', required: true, min: 1, label: 'El producto' },
      quantity: { type: 'integer', min: 1, max: 1000000, label: 'La cantidad' },
      new_stock: { type: 'integer', min: 0, max: 1000000, label: 'El stock contado' },
      unit_cost: { type: 'number', min: 0, max: 1000000, label: 'El costo unitario' },
    })
  );

  const results = await db.tx(async (t) => {
    const settings = await getSettings(t);
    const out = [];
    for (const item of items) {
      let quantity;
      if (head.type === 'ajuste') {
        if (item.new_stock === null) throw new HttpError(400, 'Indica el stock real contado');
        const p = await t.get('SELECT stock FROM products WHERE id = ? AND active = 1 FOR UPDATE', [item.product_id]);
        if (!p) throw new HttpError(404, 'Producto no encontrado');
        quantity = item.new_stock - p.stock;
        if (quantity === 0) throw new HttpError(400, 'El stock contado es igual al actual; no hay nada que ajustar');
      } else {
        if (!item.quantity) throw new HttpError(400, 'Indica una cantidad mayor a cero');
        quantity = head.type === 'entrada' ? item.quantity : -item.quantity;
      }

      if (head.type === 'entrada' && head.update_cost && item.unit_cost !== null) {
        await t.run('UPDATE products SET purchase_price = ? WHERE id = ?', [item.unit_cost, item.product_id]);
      }

      out.push(
        await applyMovement(t, {
          productId: item.product_id,
          type: head.type,
          quantity,
          unitCost: item.unit_cost,
          reason: head.reason || (head.type === 'entrada' ? 'Compra / reposición' : null),
          reference: head.reference,
          supplierId: head.type === 'entrada' ? head.supplier_id : null,
          userId: req.user.id,
        }, settings)
      );
    }
    return out;
  });

  res.status(201).json({ message: `${results.length} movimiento(s) registrado(s)`, results });
});

// ---------- Alertas: stock bajo, agotados y por vencer ----------
router.get('/alerts', async (_req, res) => {
  const days = Number((await getSettings()).expiry_alert_days) || 30;
  const low = await db.all(
    `SELECT p.id, p.code, p.name, p.presentation, p.stock, p.min_stock, c.name AS category_name, s.name AS supplier_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.active = 1 AND ${LOW_STOCK_SQL}
     ORDER BY (p.stock / GREATEST(p.min_stock, 1)) ASC, p.name`
  );
  const expiring = await db.all(
    `SELECT p.id, p.code, p.name, p.presentation, p.stock, p.expiry_date, DATEDIFF(p.expiry_date, CURDATE()) AS days_left
     FROM products p
     WHERE p.active = 1 AND p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY p.expiry_date`,
    [days]
  );
  res.json({ low, expiring, expiry_days: days });
});

module.exports = router;
