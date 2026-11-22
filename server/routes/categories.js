/**
 * Categorías de productos.
 */
const express = require('express');
const { db } = require('../db');
const { authorize } = require('../middleware/auth');
const { HttpError, validate } = require('../utils/http');

const router = express.Router();

const RULES = {
  name: { type: 'string', required: true, max: 60, label: 'El nombre' },
  color: { type: 'string', pattern: /^#[0-9a-fA-F]{6}$/, patternMessage: 'Color inválido', default: '#2563eb' },
};

router.get('/', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
       FROM categories c ORDER BY c.name`
    )
  );
});

router.post('/', authorize('almacenero'), async (req, res) => {
  const data = validate(req.body, RULES);
  const info = await db.run('INSERT INTO categories (name, color) VALUES (:name, :color)', data);
  res.status(201).json(await db.get('SELECT * FROM categories WHERE id = ?', [info.insertId]));
});

router.put('/:id', authorize('almacenero'), async (req, res) => {
  const data = validate(req.body, RULES);
  const exists = await db.get('SELECT id FROM categories WHERE id = ?', [req.params.id]);
  if (!exists) throw new HttpError(404, 'Categoría no encontrada');
  await db.run('UPDATE categories SET name = :name, color = :color WHERE id = :id', { ...data, id: req.params.id });
  res.json(await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authorize(), async (req, res) => {
  const { c } = await db.get('SELECT COUNT(*) c FROM products WHERE category_id = ? AND active = 1', [req.params.id]);
  if (c) throw new HttpError(409, `No se puede eliminar: tiene ${c} producto(s) asociados`);
  const info = await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!info.affectedRows) throw new HttpError(404, 'Categoría no encontrada');
  res.json({ message: 'Categoría eliminada' });
});

module.exports = router;
