// Utilidades HTTP: errores en español, validación sencilla
export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (m, extra) => new HttpError(400, m, extra);
export const notFound = (m = 'No se ha encontrado el elemento solicitado.') => new HttpError(404, m);
export const forbidden = (m = 'Tu perfil no tiene permiso para realizar esta acción.') => new HttpError(403, m);

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  if (err?.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con ese código o marca.' });
  if (err?.code === '23503') return res.status(409).json({ error: 'No se puede completar: hay datos relacionados que lo impiden.' });
  if (err?.code === '22P02' || err?.code === '22007' || err?.code === '22008') return res.status(400).json({ error: 'Algún dato tiene un formato no válido.' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo es demasiado grande.' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Ha ocurrido un error inesperado. Inténtalo de nuevo en unos segundos.' });
}

export function num(v, name, { min = -Infinity, max = Infinity, def, int = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (def !== undefined) return def;
    throw bad(`Falta el campo «${name}».`);
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw bad(`El campo «${name}» debe ser un número.`);
  if (int && !Number.isInteger(n)) throw bad(`El campo «${name}» debe ser un número entero.`);
  if (n < min || n > max) throw bad(`El campo «${name}» está fuera de rango.`);
  return n;
}
export function str(v, name, { required = false, max = 2000, def = '' } = {}) {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (required) throw bad(`Falta el campo «${name}».`);
    return def;
  }
  const s = String(v).trim();
  if (s.length > max) throw bad(`El campo «${name}» es demasiado largo.`);
  return s;
}
export function date(v, name) {
  if (v === undefined || v === null || v === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw bad(`La fecha «${name}» no es válida.`);
  return String(v);
}
export function oneOf(v, name, list, def) {
  if ((v === undefined || v === null || v === '') && def !== undefined) return def;
  if (!list.includes(v)) throw bad(`Valor no válido para «${name}».`);
  return v;
}

// Números con formato español y separador de miles siempre (1.250 kg)
export const nes = (n, d = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: d, useGrouping: 'always' }).format(Number(n) || 0);
