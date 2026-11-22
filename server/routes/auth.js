/**
 * Autenticación: login, usuario actual y cambio de contraseña.
 * Incluye bloqueo temporal tras varios intentos fallidos (anti fuerza bruta).
 * Nota: en Vercel el contador vive por instancia; es una barrera razonable,
 * no un sistema distribuido.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authenticate, signToken } = require('../middleware/auth');
const { HttpError, validate } = require('../utils/http');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map(); // clave: ip|usuario -> { count, until }

function checkLock(key) {
  const a = attempts.get(key);
  if (a && a.until && a.until > Date.now()) {
    const min = Math.ceil((a.until - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${min} minuto(s).`);
  }
}

function registerFail(key) {
  const a = attempts.get(key) || { count: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.until = Date.now() + LOCK_MS;
    a.count = 0;
  }
  attempts.set(key, a);
  if (attempts.size > 5000) attempts.clear(); // evita crecer sin límite
}

const publicUser = (u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role });

router.post('/login', async (req, res) => {
  const { username, password } = validate(req.body, {
    username: { type: 'string', required: true, max: 50, label: 'El usuario' },
    password: { type: 'string', required: true, max: 100, label: 'La contraseña' },
  });

  const key = `${req.ip}|${username.toLowerCase()}`;
  checkLock(key);

  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    registerFail(key);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  if (!user.active) throw new HttpError(403, 'Tu usuario está deshabilitado. Contacta al administrador.');

  attempts.delete(key);
  await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', authenticate, async (req, res) => {
  const data = validate(req.body, {
    current_password: { type: 'string', required: true, label: 'La contraseña actual' },
    new_password: { type: 'string', required: true, min: 6, max: 100, label: 'La nueva contraseña' },
  });
  const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(data.current_password, user.password_hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(data.new_password, 10), req.user.id]);
  res.json({ message: 'Contraseña actualizada' });
});

module.exports = router;
