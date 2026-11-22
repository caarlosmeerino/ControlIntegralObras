// Formatos españoles: 1.250 kg · 12,52 t · 12/03/2026 · 1.234,50 €
const nf = (min, max) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: 'always' });
const n0 = nf(0, 0), n1 = nf(0, 1), n2 = nf(2, 2), e2 = nf(2, 2);

export const num = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : nf(0, d).format(Number(v)));
export const kg = (v) => (v == null ? '—' : `${n0.format(Number(v))} kg`);
export const t = (vkg, d = 2) => (vkg == null ? '—' : `${nf(d, d).format(Number(vkg) / 1000)} t`);
export const tNum = (vkg, d = 2) => (vkg == null ? '—' : nf(d, d).format(Number(vkg) / 1000));
export const pct = (v) => (v == null ? '—' : `${n1.format(Number(v))} %`);
export const eur = (v) => (v == null ? '—' : `${e2.format(Number(v))} €`);
export const eur0 = (v) => (v == null ? '—' : `${n0.format(Number(v))} €`);
export const horas = (v) => (v == null ? '—' : `${n1.format(Number(v))} h`);
export const fecha = (v) => {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/');
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' });
};
export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '—');
export const hora = (v) => (v ? new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '—');
export const diaCorto = (v) => { const d = new Date(String(v).slice(0, 10) + 'T12:00:00Z'); return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', ''); };
export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
export const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const tamano = (b) => (b > 1048576 ? `${n1.format(b / 1048576)} MB` : `${n0.format(Math.max(1, b / 1024))} KB`);
export const plural = (n, s, p = s + 's') => `${num(n)} ${n === 1 ? s : p}`;
// Admite "1.250,5" o "1250.5"
export const parseNum = (s) => {
  if (s === '' || s == null) return null;
  if (typeof s === 'number') return s;
  const v = String(s).trim();
  const n = v.includes(',') ? Number(v.replace(/\./g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const ESTADOS = {
  terminado: { label: 'Terminado', tone: 'ok' },
  en_curso: { label: 'En curso', tone: 'warn' },
  retrasado: { label: 'Retrasado', tone: 'bad' },
  pendiente: { label: 'Pendiente', tone: 'idle' },
};
export const ESTADOS_OBRA = {
  planificada: { label: 'Planificada', tone: 'idle' },
  en_curso: { label: 'En curso', tone: 'warn' },
  pausada: { label: 'Pausada', tone: 'idle' },
  terminada: { label: 'Terminada', tone: 'ok' },
  cancelada: { label: 'Cancelada', tone: 'idle' },
};
export const SECCIONES = { corte: 'Corte', armado: 'Armado', soldadura: 'Soldadura', pintura: 'Pintura', montaje: 'Montaje', calidad: 'Calidad', expedicion: 'Expedición', oficina: 'Oficina' };
export const ELEMENTOS = { pilar: 'Pilar', viga: 'Viga', cercha: 'Cercha', correa: 'Correa', arriostramiento: 'Arriostramiento', placa: 'Placa', escalera: 'Escalera', barandilla: 'Barandilla', forjado: 'Forjado', otro: 'Otro' };
export const AMBITOS = { oficina: 'Oficina', taller: 'Taller', obra: 'Obra' };
export const ROLES = { admin: 'Administrador', director: 'Director de producción', jefe_taller: 'Jefe de taller', encargado_montaje: 'Encargado de montaje', operario: 'Operario', administracion: 'Administración' };
// Colores de fase (para barras apiladas de ubicación)
export const COLOR_FASE = ['#c7c7cc', '#aeaeb2', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff9f0a', '#30d158', '#248a3d', '#8e8e93', '#636366'];
export const m2 = (v) => (v == null ? '—' : `${nf(0, 2).format(Number(v))} m²`);
export const ml = (v) => (v == null ? '—' : `${nf(0, 2).format(Number(v))} ml`);
/** Enlace a Google Maps con la dirección completa */
export const mapsUrl = (o) => {
  // Con coordenadas (dirección elegida del callejero) el punto es exacto
  if (o.lat != null && o.lng != null) return `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`;
  const q = [o.direccion, o.ciudad, o.provincia && o.provincia !== o.ciudad ? o.provincia : '', 'España'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
