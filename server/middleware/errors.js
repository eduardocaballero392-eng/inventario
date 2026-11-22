/**
 * Manejo centralizado de errores: siempre responde JSON { error, details }.
 */
const { HttpError } = require('../utils/http');

function notFound(req, _res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

const DB_DOWN = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'];

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // Errores conocidos de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'Ya existe un registro con ese valor (código, usuario o nombre duplicado)';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 409;
    message = 'El registro está relacionado con otros datos y no puede modificarse así';
  } else if (err.code === 'ER_NO_SUCH_TABLE') {
    status = 503;
    message = 'La base de datos no está inicializada. Ejecuta "npm run db:setup".';
  } else if (DB_DOWN.includes(err.code)) {
    status = 503;
    message = 'No se pudo conectar con la base de datos. Revisa la configuración o tu conexión.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'JSON inválido en la solicitud';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'La información enviada es demasiado grande';
  }

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
    if (status === 500) message = 'Ocurrió un error inesperado. Intenta nuevamente.';
  }

  res.status(status).json({ error: message, details: err instanceof HttpError ? err.details : undefined });
}

module.exports = { notFound, errorHandler };
