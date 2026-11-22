import { hoyISO } from './format.js';
// Avance separado en FABRICACIÓN (fases de oficina y taller) y MONTAJE (fases de obra)
export const esMontaje = (fase) => fase.ambito === 'obra';

export function avanceGrupo(resumen, grupo) {
  const fs = resumen.fases.filter((x) => (grupo === 'montaje' ? esMontaje(x) : !esMontaje(x)));
  const w = fs.reduce((s, x) => s + (x.peso_ponderacion || 1), 0) || 1;
  return { fases: fs, porcentaje: fs.reduce((s, x) => s + x.porcentaje * (x.peso_ponderacion || 1), 0) / w };
}

export const ACTIVAS = ['planificada', 'en_curso', 'pausada'];
export const iniciales = (s) => String(s || '?').trim().split(/\s+/).filter((x) => !/^(s\.?l\.?|s\.?a\.?|de|del|la|y)$/i.test(x)).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || '?';
export const urlCliente = (c) => `/clientes/${encodeURIComponent(c || 'Sin cliente')}`;

// Color estable por cliente (degradados al estilo de Contactos / Mensajes)
const PALETA = [['#ff9a8b', '#ff5e62'], ['#ffb347', '#ff8c00'], ['#ffd86f', '#f7b500'], ['#7be495', '#2fb36d'], ['#5fd3f3', '#1f9bd7'],
  ['#6aa8ff', '#2f6bff'], ['#a78bfa', '#7c3aed'], ['#f78fb3', '#e1306c'], ['#9aa5b1', '#69737d'], ['#5eead4', '#0d9488']];
export function colorCliente(nombre) {
  let h = 0; for (const ch of String(nombre || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = PALETA[h % PALETA.length];
  return `linear-gradient(180deg, ${a}, ${b})`;
}

// ---------- Fases del proyecto ----------

/** Estado de una fase: solo está terminada si se ha confirmado; si pasa la fecha de fin sin confirmar, retraso */
export function estadoEtapa(e, hoy = hoyISO()) {
  if (e.completada) return 'terminado';
  if (e.fecha_fin && e.fecha_fin < hoy) return 'retrasado';
  if (e.fecha_inicio && e.fecha_inicio <= hoy) return 'en_curso';
  if (!e.fecha_inicio && e.fecha_fin) return 'en_curso';
  return 'pendiente';
}
export const obraRetrasada = (o) => (o.etapas || []).some((e) => estadoEtapa(e) === 'retrasado');
export function faseActual(o) {
  const es = o.etapas || [];
  return es.find((e) => estadoEtapa(e) === 'retrasado') || es.find((e) => estadoEtapa(e) === 'en_curso') || es.find((e) => !e.completada) || null;
}

// ---------- Semanas ISO (1–52/53) ----------
const D = (iso) => new Date(`${iso}T12:00:00Z`);
export const isoDe = (d) => d.toISOString().slice(0, 10);
export function semanaISO(iso) {
  const d = D(iso); const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia + 3); // jueves de esa semana
  const anio = d.getUTCFullYear();
  const primerJueves = new Date(Date.UTC(anio, 0, 4)); primerJueves.setUTCDate(primerJueves.getUTCDate() - ((primerJueves.getUTCDay() + 6) % 7) + 3);
  return { anio, semana: 1 + Math.round((d - primerJueves) / (7 * 86400000)) };
}
/** Lunes de la semana ISO indicada */
export function lunesDeSemana(anio, semana) {
  const ene4 = new Date(Date.UTC(anio, 0, 4));
  const lunes1 = new Date(ene4); lunes1.setUTCDate(ene4.getUTCDate() - ((ene4.getUTCDay() + 6) % 7));
  lunes1.setUTCDate(lunes1.getUTCDate() + (semana - 1) * 7);
  return isoDe(lunes1);
}
export const masDias = (iso, n) => { const d = D(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };
export const semanasDelAnio = (anio) => semanaISO(`${anio}-12-28`).semana;
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
/** Una fase toca un intervalo de fechas */
export const solapa = (e, desde, hasta) => (e.fecha_inicio || e.fecha_fin) && (e.fecha_inicio || e.fecha_fin) <= hasta && (e.fecha_fin || e.fecha_inicio) >= desde;
