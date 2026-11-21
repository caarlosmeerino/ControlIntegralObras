// Cliente de la API con mensajes en español y cola sin conexión para avances
const OUTBOX = 'cio-pendientes';

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, form, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, signal, credentials: 'same-origin',
      headers: form ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'No hay conexión con el servidor. Comprueba la cobertura o la red Wi-Fi.');
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : null;
  if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data?.error || `Error ${res.status}`, data);
  return data;
}
export const get = (p, o) => api(p, o);
export const post = (p, body) => api(p, { method: 'POST', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

export const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};

// ---------- Cola sin conexión (solo avances de pieza) ----------
const leer = () => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { return []; } };
const guardar = (l) => { try { localStorage.setItem(OUTBOX, JSON.stringify(l)); } catch { /* sin almacenamiento */ } window.dispatchEvent(new Event('cio-outbox')); };
export const pendientes = () => leer();

/** Registra un avance; si no hay red, lo guarda para enviarlo después. */
export async function registrarAvance(piezaId, body, etiqueta) {
  try {
    return await post(`/piezas/${piezaId}/avance`, body);
  } catch (e) {
    if (e.status === 0) {
      guardar([...leer(), { piezaId, body, etiqueta, creado: new Date().toISOString() }]);
      return { encolado: true, mensaje: `Sin conexión: el avance de ${etiqueta} se ha guardado y se enviará al recuperar la red.` };
    }
    throw e;
  }
}

export async function sincronizar() {
  const l = leer();
  if (!l.length) return { enviados: 0, errores: [] };
  const quedan = []; const errores = []; let enviados = 0;
  for (const it of l) {
    try { await post(`/piezas/${it.piezaId}/avance`, { ...it.body, nota: `${it.body.nota || ''} (registrado sin conexión ${new Date(it.creado).toLocaleString('es-ES')})`.trim() }); enviados++; }
    catch (e) { if (e.status === 0) quedan.push(it); else errores.push(`${it.etiqueta}: ${e.message}`); }
  }
  guardar(quedan);
  return { enviados, errores };
}
