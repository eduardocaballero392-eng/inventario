/**
 * Proveedores: CRUD y productos asociados.
 */
const express = require('express');
const { db } = require('../db');
const { authorize } = require('../middleware/auth');
const { HttpError, validate, pagination } = require('../utils/http');

const router = express.Router();

const RULES = {
  name: { type: 'string', required: true, min: 2, max: 120, label: 'La razón social' },
  ruc: { type: 'string', pattern: /^\d{11}$/, patternMessage: 'El RUC debe tener 11 dígitos', label: 'El RUC' },
  phone: { type: 'string', max: 30, pattern: /^[0-9+()\s-]+$/, patternMessage: 'Teléfono inválido', label: 'El teléfono' },
  email: { type: 'string', max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: 'Correo inválido', label: 'El correo' },
  address: { type: 'string', max: 200, label: 'La dirección' },
  contact: { type: 'string', max: 120, label: 'El contacto' },
  notes: { type: 'string', max: 500, label: 'Las notas' },
};

async function getSupplier(id) {
  const s = await db.get('SELECT * FROM suppliers WHERE id = ? AND active = 1', [id]);
  if (!s) throw new HttpError(404, 'Proveedor no encontrado');
  return s;
}

router.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req.query, 15);
  const params = {};
  let where = 'WHERE s.active = 1';
  if (req.query.q) {
    where += ' AND (s.name LIKE :q OR s.ruc LIKE :q OR s.contact LIKE :q OR s.phone LIKE :q)';
    params.q = `%${req.query.q}%`;
  }
  const { total } = await db.get(`SELECT COUNT(*) AS total FROM suppliers s ${where}`, params);
  const data = await db.all(
    `SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) AS product_count,
      (SELECT MAX(created_at) FROM stock_movements m WHERE m.supplier_id = s.id AND m.type = 'entrada') AS last_purchase
     FROM suppliers s ${where} ORDER BY s.name LIMIT :limit OFFSET :offset`,
    { ...params, limit, offset }
  );
  res.json({ data, total, page, limit });
});

router.get('/:id', async (req, res) => {
  const supplier = await getSupplier(req.params.id);
  supplier.products = await db.all(
    `SELECT p.id, p.code, p.name, p.presentation, p.stock, p.min_stock, p.purchase_price, p.sale_price, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.supplier_id = ? AND p.active = 1 ORDER BY p.name`,
    [supplier.id]
  );
  supplier.purchases = await db.all(
    `SELECT m.created_at, m.reference, p.name AS product_name, m.quantity, m.unit_cost
     FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.supplier_id = ? AND m.type = 'entrada' ORDER BY m.created_at DESC LIMIT 20`,
    [supplier.id]
  );
  res.json(supplier);
});

router.post('/', authorize('almacenero'), async (req, res) => {
  const data = validate(req.body, RULES);
  const info = await db.run(
    'INSERT INTO suppliers (name, ruc, phone, email, address, contact, notes) VALUES (:name, :ruc, :phone, :email, :address, :contact, :notes)',
    data
  );
  res.status(201).json(await getSupplier(info.insertId));
});

router.put('/:id', authorize('almacenero'), async (req, res) => {
  await getSupplier(req.params.id);
  const data = validate(req.body, RULES);
  await db.run(
    'UPDATE suppliers SET name=:name, ruc=:ruc, phone=:phone, email=:email, address=:address, contact=:contact, notes=:notes WHERE id=:id',
    { ...data, id: req.params.id }
  );
  res.json(await getSupplier(req.params.id));
});

// Se desactiva (no se borra) para conservar el historial de compras
router.delete('/:id', authorize(), async (req, res) => {
  await getSupplier(req.params.id);
  await db.tx(async (t) => {
    await t.run('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?', [req.params.id]);
    await t.run('UPDATE suppliers SET active = 0 WHERE id = ?', [req.params.id]);
  });
  res.json({ message: 'Proveedor eliminado' });
});

module.exports = router;
