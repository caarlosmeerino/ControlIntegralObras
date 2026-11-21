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
