/**
 * Gestión de usuarios (solo administrador).
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { HttpError, validate } = require('../utils/http');

const router = express.Router();

const ROLES = ['admin', 'cajero', 'almacenero'];
const FIELDS = 'id, username, full_name, role, active, last_login, created_at';

const RULES = {
  username: {
    type: 'string', required: true, min: 3, max: 30, label: 'El usuario',
    pattern: /^[a-zA-Z0-9._-]+$/, patternMessage: 'El usuario solo admite letras, números, punto, guion y guion bajo',
  },
  full_name: { type: 'string', required: true, min: 3, max: 100, label: 'El nombre completo' },
  role: { type: 'string', required: true, enum: ROLES, label: 'El rol' },
  active: { type: 'boolean', default: true },
};

async function otherActiveAdmins(excludeId) {
  const { c } = await db.get("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", [excludeId]);
  return c;
}

const getUser = (id) => db.get(`SELECT ${FIELDS} FROM users WHERE id = ?`, [id]);

router.get('/', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT ${FIELDS.split(', ').map((f) => `u.${f}`).join(', ')},
        (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id AND s.status = 'completada') AS sales_count
       FROM users u ORDER BY u.active DESC, u.full_name`
    )
  );
});

router.post('/', async (req, res) => {
  const data = validate(req.body, {
    ...RULES,
    password: { type: 'string', required: true, min: 6, max: 100, label: 'La contraseña' },
  });
  const info = await db.run(
    'INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?)',
    [data.username, await bcrypt.hash(data.password, 10), data.full_name, data.role, data.active ? 1 : 0]
  );
  res.status(201).json(await getUser(info.insertId));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const current = await getUser(id);
  if (!current) throw new HttpError(404, 'Usuario no encontrado');

  const data = validate(req.body, {
    ...RULES,
    password: { type: 'string', min: 6, max: 100, label: 'La contraseña' },
  });

  if (id === req.user.id && (!data.active || data.role !== 'admin')) {
    throw new HttpError(400, 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }
  if (current.role === 'admin' && (data.role !== 'admin' || !data.active) && (await otherActiveAdmins(id)) === 0) {
    throw new HttpError(400, 'Debe existir al menos un administrador activo');
  }

  await db.run('UPDATE users SET username = ?, full_name = ?, role = ?, active = ? WHERE id = ?', [data.username, data.full_name, data.role, data.active ? 1 : 0, id]);
  if (data.password) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(data.password, 10), id]);
  }
  res.json(await getUser(id));
});

// Si el usuario tiene ventas/movimientos se desactiva para conservar la trazabilidad
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'No puedes eliminar tu propia cuenta');
  const current = await getUser(id);
  if (!current) throw new HttpError(404, 'Usuario no encontrado');
  if (current.role === 'admin' && (await otherActiveAdmins(id)) === 0) throw new HttpError(400, 'Debe existir al menos un administrador activo');

  const { used } = await db.get(
    'SELECT (SELECT COUNT(*) FROM sales WHERE user_id = :id OR cancelled_by = :id) + (SELECT COUNT(*) FROM stock_movements WHERE user_id = :id) AS used',
    { id }
  );
  if (used) {
    await db.run('UPDATE users SET active = 0 WHERE id = ?', [id]);
    return res.json({ message: 'El usuario tiene historial, se desactivó en lugar de eliminarse' });
  }
  await db.run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ message: 'Usuario eliminado' });
});

module.exports = router;
