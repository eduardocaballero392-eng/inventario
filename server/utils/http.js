/**
 * Utilidades HTTP: error tipado, validación declarativa y paginación.
 */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Valida y normaliza un objeto según reglas simples.
 * Regla: { type: 'string'|'number'|'integer'|'boolean'|'date', required, min, max, enum, label }
 * - string: min/max = longitud. number/integer: min/max = valor.
 * Lanza HttpError(400) con el detalle por campo si algo falla.
 */
function validate(data = {}, rules = {}, { partial = false } = {}) {
  const out = {};
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    let value = data[field];
    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

    if (empty) {
      if (partial && value === undefined) continue;
      if (rule.required) errors[field] = `${label} es obligatorio`;
      else out[field] = rule.default !== undefined ? rule.default : null;
      continue;
    }

    switch (rule.type) {
      case 'string':
        value = String(value).trim();
        if (rule.min && value.length < rule.min) errors[field] = `${label} debe tener al menos ${rule.min} caracteres`;
        else if (rule.max && value.length > rule.max) errors[field] = `${label} admite máximo ${rule.max} caracteres`;
        else if (rule.pattern && !rule.pattern.test(value)) errors[field] = rule.patternMessage || `${label} tiene un formato inválido`;
        break;
      case 'number':
      case 'integer':
        value = Number(value);
        if (!Number.isFinite(value)) errors[field] = `${label} debe ser un número`;
        else if (rule.type === 'integer' && !Number.isInteger(value)) errors[field] = `${label} debe ser un número entero`;
        else if (rule.min !== undefined && value < rule.min) errors[field] = `${label} debe ser mayor o igual a ${rule.min}`;
        else if (rule.max !== undefined && value > rule.max) errors[field] = `${label} debe ser menor o igual a ${rule.max}`;
        break;
      case 'boolean':
        value = value === true || value === 1 || value === '1' || value === 'true';
        break;
      case 'date':
        value = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) errors[field] = `${label} debe ser una fecha válida`;
        break;
      default:
        break;
    }

    if (rule.enum && !rule.enum.includes(value)) errors[field] = `${label} no es un valor permitido`;
    if (!errors[field]) out[field] = value;
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, Object.values(errors)[0], errors);
  }
  return out;
}

/** Lee page/limit de la query con límites seguros. */
function pagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const all = query.limit === 'all';
  const limit = all ? 100000 : Math.min(500, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Redondeo monetario a 2 decimales evitando errores de coma flotante. */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * "Ahora" en la zona horaria del negocio (TZ_OFFSET), independiente del servidor.
 * Vercel corre en UTC: sin esto, las ventas de las 8 p. m. en Perú caerían "mañana".
 * Devuelve un Date cuyos campos UTC (getUTC*) son la hora local del negocio.
 */
function businessNow() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(require('../config').TZ_OFFSET) || ['', '-', '05', '00'];
  const offsetMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return new Date(Date.now() + offsetMin * 60000);
}

/** Fecha local del negocio 'YYYY-MM-DD' desplazada N días. */
function localDate(offsetDays = 0) {
  const d = businessNow();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Valida un rango de fechas from/to de la query (por defecto: últimos 30 días). */
function dateRange(query, defaultDays = 30) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = re.test(query.from || '') ? query.from : localDate(-(defaultDays - 1));
  const to = re.test(query.to || '') ? query.to : localDate(0);
  if (from > to) throw new HttpError(400, 'La fecha inicial no puede ser mayor que la final');
  return { from, to, fromTs: `${from} 00:00:00`, toTs: `${to} 23:59:59` };
}

/** Lista de días 'YYYY-MM-DD' entre dos fechas (inclusive). */
function daysBetween(from, to) {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Envuelve un handler async (Express 5 ya propaga errores async, se deja por claridad). */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, validate, pagination, round2, localDate, dateRange, daysBetween, businessNow, ah };
