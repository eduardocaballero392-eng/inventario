/**
 * Servicio de stock: ÚNICO punto que modifica products.stock.
 * Cada cambio genera un registro en stock_movements (kardex).
 * Debe llamarse con el ejecutor `t` de una transacción (db.tx).
 */
const { getSettings } = require('../db');
const { HttpError } = require('./http');

/** Condición SQL reutilizable para "stock bajo" (incluye agotados). */
const LOW_STOCK_SQL = 'p.stock <= p.min_stock';

/**
 * Aplica un movimiento de stock bloqueando la fila del producto (SELECT ... FOR UPDATE),
 * así dos cajas vendiendo a la vez no dejan el stock inconsistente.
 * @param t ejecutor de transacción
 * @param m { productId, type, quantity (con signo), unitCost, reason, reference, supplierId, userId }
 */
async function applyMovement(t, m, settings) {
  const product = await t.get('SELECT id, name, stock FROM products WHERE id = ? AND active = 1 FOR UPDATE', [m.productId]);
  if (!product) throw new HttpError(404, `Producto #${m.productId} no encontrado`);

  const before = product.stock;
  const after = before + m.quantity;
  const allowNegative = (settings || (await getSettings(t))).allow_negative_stock === '1';
  if (after < 0 && !allowNegative) {
    throw new HttpError(409, `Stock insuficiente para "${product.name}" (disponible: ${before})`);
  }

  await t.run('UPDATE products SET stock = ? WHERE id = ?', [after, product.id]);
  const info = await t.run(
    `INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, unit_cost, reason, reference, supplier_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product.id, m.type, m.quantity, before, after, m.unitCost ?? null, m.reason ?? null, m.reference ?? null, m.supplierId ?? null, m.userId ?? null]
  );
  return { id: info.insertId, product_id: product.id, before, after };
}

module.exports = { applyMovement, LOW_STOCK_SQL };
