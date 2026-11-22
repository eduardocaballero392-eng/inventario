/**
 * Ventas: registro desde el POS (descuenta stock), historial, detalle y anulación.
 */
const express = require('express');
const { db, getSettings } = require('../db');
const { authorize } = require('../middleware/auth');
const { HttpError, validate, pagination, round2 } = require('../utils/http');
const { applyMovement } = require('../utils/stock');

const router = express.Router();

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'yape', 'plin'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getSale(id, user, t = db) {
  const sale = await t.get(
    `SELECT s.*, u.full_name AS user_name, cu.full_name AS cancelled_by_name
     FROM sales s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN users cu ON cu.id = s.cancelled_by
     WHERE s.id = ?`,
    [id]
  );
  if (!sale) throw new HttpError(404, 'Venta no encontrada');
  if (user && user.role === 'cajero' && sale.user_id !== user.id) throw new HttpError(403, 'Solo puedes ver tus propias ventas');
  sale.items = await t.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [id]);
  return sale;
}

/**
 * Calcula totales según la configuración de impuestos.
 * - Precio incluye impuesto: total = suma - descuento; base = total / (1 + tasa)
 * - Precio sin impuesto: base = suma - descuento; total = base * (1 + tasa)
 */
function computeTotals(gross, discount, settings) {
  const rate = (Number(settings.tax_rate) || 0) / 100;
  const net = round2(gross - discount);
  if (settings.tax_included === '1') {
    const subtotal = round2(net / (1 + rate));
    return { subtotal, tax: round2(net - subtotal), total: net };
  }
  const tax = round2(net * rate);
  return { subtotal: net, tax, total: round2(net + tax) };
}

// ---------- Listado ----------
router.get('/', authorize('cajero'), async (req, res) => {
  const { page, limit, offset } = pagination(req.query, 15);
  const where = ['1 = 1'];
  const params = {};

  if (req.user.role === 'cajero') { where.push('s.user_id = :me'); params.me = req.user.id; }
  if (DATE_RE.test(req.query.from || '')) { where.push('s.created_at >= :from'); params.from = `${req.query.from} 00:00:00`; }
  if (DATE_RE.test(req.query.to || '')) { where.push('s.created_at <= :to'); params.to = `${req.query.to} 23:59:59`; }
  if (PAYMENT_METHODS.includes(req.query.payment_method)) { where.push('s.payment_method = :pm'); params.pm = req.query.payment_method; }
  if (['completada', 'anulada'].includes(req.query.status)) { where.push('s.status = :status'); params.status = req.query.status; }
  if (req.query.user_id) { where.push('s.user_id = :user_id'); params.user_id = Number(req.query.user_id); }
  if (req.query.q) { where.push('(s.number LIKE :q OR s.customer_name LIKE :q OR s.customer_doc LIKE :q)'); params.q = `%${req.query.q}%`; }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const summary = await db.get(
    `SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN s.status='completada' THEN s.total END), 0) AS total
     FROM sales s ${whereSql}`,
    params
  );
  const data = await db.all(
    `SELECT s.*, u.full_name AS user_name,
            (SELECT SUM(quantity) FROM sale_items i WHERE i.sale_id = s.id) AS items_count
     FROM sales s LEFT JOIN users u ON u.id = s.user_id
     ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );

  res.json({ data, total: summary.count, sum: round2(summary.total), page, limit });
});

router.get('/:id', authorize('cajero'), async (req, res) => {
  res.json(await getSale(req.params.id, req.user));
});

// ---------- Registrar venta (POS) ----------
router.post('/', authorize('cajero'), async (req, res) => {
  const head = validate(req.body, {
    payment_method: { type: 'string', required: true, enum: PAYMENT_METHODS, label: 'El método de pago' },
    discount: { type: 'number', min: 0, max: 1000000, default: 0, label: 'El descuento' },
    amount_received: { type: 'number', min: 0, max: 10000000, label: 'El monto recibido' },
    customer_name: { type: 'string', max: 120, label: 'El nombre del cliente' },
    customer_doc: { type: 'string', max: 15, pattern: /^[0-9A-Za-z-]+$/, patternMessage: 'Documento inválido', label: 'El documento' },
    notes: { type: 'string', max: 200, label: 'La nota' },
  });

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) throw new HttpError(400, 'El carrito está vacío');
  if (rawItems.length > 300) throw new HttpError(400, 'Demasiados productos en una sola venta');

  // Agrupa líneas repetidas del mismo producto
  const grouped = new Map();
  for (const raw of rawItems) {
    const it = validate(raw, {
      product_id: { type: 'integer', required: true, min: 1, label: 'El producto' },
      quantity: { type: 'integer', required: true, min: 1, max: 100000, label: 'La cantidad' },
    });
    grouped.set(it.product_id, (grouped.get(it.product_id) || 0) + it.quantity);
  }

  const saleId = await db.tx(async (t) => {
    const settings = await getSettings(t);

    // Precios SIEMPRE desde la base de datos (nunca del navegador)
    const lines = [];
    for (const [productId, quantity] of grouped) {
      const p = await t.get('SELECT id, code, name, sale_price, purchase_price FROM products WHERE id = ? AND active = 1', [productId]);
      if (!p) throw new HttpError(404, `Producto #${productId} no existe o fue eliminado`);
      lines.push({ product: p, quantity, subtotal: round2(p.sale_price * quantity) });
    }

    const gross = round2(lines.reduce((s, l) => s + l.subtotal, 0));
    if (head.discount > gross) throw new HttpError(400, 'El descuento no puede ser mayor al total');
    const totals = computeTotals(gross, head.discount, settings);

    let received = totals.total;
    let change = 0;
    if (head.payment_method === 'efectivo') {
      received = head.amount_received ?? totals.total;
      if (received + 0.001 < totals.total) throw new HttpError(400, 'El monto recibido es menor al total a pagar');
      change = round2(received - totals.total);
    }

    // Correlativo del ticket: la fila se bloquea para que dos cajas no repitan número
    const counter = await t.get("SELECT value FROM settings WHERE name = 'ticket_next_number' FOR UPDATE");
    const next = Number(counter?.value) || 1;
    const number = `${settings.ticket_series || 'B001'}-${String(next).padStart(8, '0')}`;
    await t.run("UPDATE settings SET value = ? WHERE name = 'ticket_next_number'", [String(next + 1)]);

    const info = await t.run(
      `INSERT INTO sales (number, subtotal, tax, discount, total, payment_method, amount_received, change_given, customer_name, customer_doc, notes, user_id)
       VALUES (:number, :subtotal, :tax, :discount, :total, :payment_method, :received, :change, :customer_name, :customer_doc, :notes, :user_id)`,
      { ...head, ...totals, number, received, change, user_id: req.user.id }
    );

    for (const l of lines) {
      await t.run(
        `INSERT INTO sale_items (sale_id, product_id, product_code, product_name, quantity, unit_price, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [info.insertId, l.product.id, l.product.code, l.product.name, l.quantity, l.product.sale_price, l.product.purchase_price, l.subtotal]
      );
      await applyMovement(t, {
        productId: l.product.id, type: 'venta', quantity: -l.quantity, unitCost: l.product.purchase_price,
        reason: 'Venta', reference: number, userId: req.user.id,
      }, settings);
    }
    return info.insertId;
  });

  res.status(201).json(await getSale(saleId));
});

// ---------- Anular venta (solo admin): devuelve el stock ----------
router.post('/:id/cancel', authorize(), async (req, res) => {
  const { reason } = validate(req.body, {
    reason: { type: 'string', required: true, min: 3, max: 200, label: 'El motivo de anulación' },
  });

  await db.tx(async (t) => {
    const locked = await t.get('SELECT id, status FROM sales WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!locked) throw new HttpError(404, 'Venta no encontrada');
    if (locked.status === 'anulada') throw new HttpError(409, 'La venta ya está anulada');
    const sale = await getSale(locked.id, null, t);
    const settings = await getSettings(t);

    await t.run("UPDATE sales SET status='anulada', cancelled_by=?, cancel_reason=?, cancelled_at=NOW() WHERE id=?", [req.user.id, reason, sale.id]);
    for (const it of sale.items) {
      const exists = await t.get('SELECT id FROM products WHERE id = ? AND active = 1', [it.product_id]);
      if (!exists) continue; // producto eliminado: no hay stock que devolver
      await applyMovement(t, {
        productId: it.product_id, type: 'anulacion', quantity: it.quantity, unitCost: it.unit_cost,
        reason: `Anulación: ${reason}`.slice(0, 200), reference: sale.number, userId: req.user.id,
      }, settings);
    }
  });

  res.json(await getSale(req.params.id));
});

module.exports = router;
