/**
 * Autenticación JWT y autorización por rol.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');
const { db } = require('../db');
const { HttpError } = require('../utils/http');

/** Verifica el token Bearer y carga el usuario (debe seguir activo). */
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Sesión no iniciada');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Tu sesión expiró, vuelve a ingresar');
  }

  const user = await db.get('SELECT id, username, full_name, role, active FROM users WHERE id = ?', [payload.sub]);
  if (!user || !user.active) throw new HttpError(401, 'Usuario deshabilitado');

  req.user = user;
  next();
}

/** Restringe una ruta a uno o más roles. El admin siempre tiene acceso. */
function authorize(...roles) {
  return (req, _res, next) => {
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    next(new HttpError(403, 'No tienes permisos para realizar esta acción'));
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

module.exports = { authenticate, authorize, signToken };
