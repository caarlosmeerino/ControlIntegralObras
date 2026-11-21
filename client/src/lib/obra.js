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
