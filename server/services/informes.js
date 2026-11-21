// Consultas de informes, rendimientos y costes (usadas por la API y por las exportaciones PDF/Excel)
import { q } from '../db.js';
import { resumenObras, hoy } from './produccion.js';

const db = { query: q };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function rango(query = {}) {
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(query.hasta || '') ? query.hasta : hoy();
  let desde = /^\d{4}-\d{2}-\d{2}$/.test(query.desde || '') ? query.desde : null;
  if (!desde) { const d = new Date(hasta + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 29); desde = d.toISOString().slice(0, 10); }
  const agrupar = ['dia', 'semana', 'mes'].includes(query.agrupar) ? query.agrupar : 'dia';
  return { desde, hasta, agrupar, obraId: query.obra_id ? Number(query.obra_id) : null, seccion: query.seccion || null };
}

const trunc = { dia: 'day', semana: 'week', mes: 'month' };
const tz = "'Europe/Madrid'";

/** Producción (acumulada) por periodo y fase: Σ kg de movimientos. */
export async function produccionPeriodo({ desde, hasta, agrupar, obraId }) {
  const { rows } = await q(
    `SELECT to_char(date_trunc('${trunc[agrupar]}', (m.fecha AT TIME ZONE ${tz}))::date, 'YYYY-MM-DD') AS periodo,
            COALESCE(f.clave, 'otras') AS clave, MIN(f.orden) AS orden, SUM(m.kg) AS kg, SUM(m.cantidad)::int AS unidades
     FROM movimientos m JOIN obra_fases f ON f.id=m.obra_fase_id
     WHERE (m.fecha AT TIME ZONE ${tz})::date BETWEEN $1 AND $2 AND ($3::int IS NULL OR m.obra_id=$3)
     GROUP BY 1, 2 ORDER BY 1, 3`, [desde, hasta, obraId]);
  const periodos = [...new Set(rows.map((r) => r.periodo))];
  const claves = ['ingenieria', 'compras', 'corte', 'armado', 'calidad', 'pintura', 'expedicion', 'montaje', 'entrega', 'otras'];
  return periodos.map((p) => {
    const o = { periodo: p, total_acumulado: 0 };
    for (const c of claves) o[c] = 0;
    rows.filter((r) => r.periodo === p).forEach((r) => { o[r.clave] = r2(r.kg); o.total_acumulado += Number(r.kg); });
    o.total_acumulado = r2(o.total_acumulado);
    return o;
  });
}

export async function obrasResumen({ soloActivas = true } = {}) {
  const obras = await resumenObras(db);
  return soloActivas ? obras.filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado)) : obras;
}

export async function retrasos() {
  const obras = await obrasResumen();
  const out = [];
  const t = hoy();
  for (const o of obras) {
    for (const f of o.resumen.fases) {
      if (f.estado === 'retrasado') {
        const dias = Math.round((new Date(t) - new Date(f.fecha_fin_prevista)) / 86400000);
        out.push({ obra_id: o.id, obra: `${o.codigo} · ${o.nombre}`, fase: f.nombre, fecha_fin_prevista: f.fecha_fin_prevista, dias_retraso: dias, porcentaje: f.porcentaje, kg_pendientes: f.kg_pendientes });
      }
    }
    if (o.fecha_entrega && o.fecha_entrega < t && o.estado !== 'terminada') {
      out.push({ obra_id: o.id, obra: `${o.codigo} · ${o.nombre}`, fase: 'Entrega de la obra', fecha_fin_prevista: o.fecha_entrega,
        dias_retraso: Math.round((new Date(t) - new Date(o.fecha_entrega)) / 86400000), porcentaje: o.resumen.avance_global, kg_pendientes: o.resumen.kg_pendiente_montar });
    }
  }
  return out.sort((a, b) => b.dias_retraso - a.dias_retraso);
}

/** Rendimiento por trabajador: horas de partes + kg de movimientos firmados por el trabajador. */
export async function rendimientoTrabajadores({ desde, hasta, seccion, obraId }) {
  const { rows } = await q(
    `WITH h AS (
       SELECT trabajador_id, SUM(horas) horas, SUM(coste) coste, COUNT(DISTINCT fecha)::int dias
       FROM partes_horas WHERE fecha BETWEEN $1 AND $2 AND ($4::int IS NULL OR obra_id=$4) GROUP BY trabajador_id),
     k AS (
       SELECT trabajador_id, SUM(kg) kg, COUNT(*)::int operaciones
       FROM movimientos WHERE trabajador_id IS NOT NULL AND (fecha AT TIME ZONE ${tz})::date BETWEEN $1 AND $2 AND ($4::int IS NULL OR obra_id=$4) GROUP BY trabajador_id)
     SELECT t.id, t.nombre, t.seccion, t.categoria, t.coste_hora, e.nombre AS equipo, e.id AS equipo_id,
            COALESCE(h.horas,0) horas, COALESCE(h.coste,0) coste, COALESCE(h.dias,0) dias, COALESCE(k.kg,0) kg, COALESCE(k.operaciones,0) operaciones
     FROM trabajadores t LEFT JOIN equipos e ON e.id=t.equipo_id LEFT JOIN h ON h.trabajador_id=t.id LEFT JOIN k ON k.trabajador_id=t.id
     WHERE t.activo AND ($3::text IS NULL OR t.seccion=$3)
     ORDER BY COALESCE(k.kg,0) DESC, t.nombre`, [desde, hasta, seccion, obraId]);
  return rows.map((r) => ({ ...r, kg_hora: r.horas > 0 ? r2(r.kg / r.horas) : 0, coste_tonelada: r.kg > 0 ? r2(r.coste / (r.kg / 1000)) : null }));
}

export async function rendimientoEquipos(params) {
  const ts = await rendimientoTrabajadores(params);
  const m = new Map();
  for (const t of ts) {
    const k = t.equipo_id || 0;
    const e = m.get(k) || { equipo_id: t.equipo_id, equipo: t.equipo || 'Sin equipo', seccion: t.seccion, personas: 0, horas: 0, coste: 0, kg: 0, operaciones: 0 };
    e.personas++; e.horas += t.horas; e.coste += t.coste; e.kg += t.kg; e.operaciones += t.operaciones;
    m.set(k, e);
  }
  return [...m.values()].map((e) => ({ ...e, horas: r2(e.horas), coste: r2(e.coste), kg: r2(e.kg), kg_hora: e.horas ? r2(e.kg / e.horas) : 0, coste_tonelada: e.kg ? r2(e.coste / (e.kg / 1000)) : null }))
    .sort((a, b) => b.kg - a.kg);
}

export async function rendimientoSecciones(params) {
  const ts = await rendimientoTrabajadores({ ...params, seccion: null });
  const m = new Map();
  for (const t of ts) {
    const e = m.get(t.seccion) || { seccion: t.seccion, personas: 0, horas: 0, coste: 0, kg: 0 };
    e.personas++; e.horas += t.horas; e.coste += t.coste; e.kg += t.kg; m.set(t.seccion, e);
  }
  return [...m.values()].map((e) => ({ ...e, horas: r2(e.horas), coste: r2(e.coste), kg: r2(e.kg), kg_hora: e.horas ? r2(e.kg / e.horas) : 0 }));
}

/** Serie temporal de horas y kg para rendimientos diarios/semanales/mensuales */
export async function rendimientoSerie({ desde, hasta, agrupar, seccion, obraId }) {
  const { rows: h } = await q(
    `SELECT to_char(date_trunc('${trunc[agrupar]}', ph.fecha)::date,'YYYY-MM-DD') periodo, SUM(ph.horas) horas, SUM(ph.coste) coste
     FROM partes_horas ph JOIN trabajadores t ON t.id=ph.trabajador_id
     WHERE ph.fecha BETWEEN $1 AND $2 AND ($3::text IS NULL OR t.seccion=$3) AND ($4::int IS NULL OR ph.obra_id=$4) GROUP BY 1`, [desde, hasta, seccion, obraId]);
  const { rows: k } = await q(
    `SELECT to_char(date_trunc('${trunc[agrupar]}', (m.fecha AT TIME ZONE ${tz}))::date,'YYYY-MM-DD') periodo, SUM(m.kg) kg
     FROM movimientos m JOIN trabajadores t ON t.id=m.trabajador_id
     WHERE (m.fecha AT TIME ZONE ${tz})::date BETWEEN $1 AND $2 AND ($3::text IS NULL OR t.seccion=$3) AND ($4::int IS NULL OR m.obra_id=$4) GROUP BY 1`, [desde, hasta, seccion, obraId]);
  const ps = [...new Set([...h.map((x) => x.periodo), ...k.map((x) => x.periodo)])].sort();
  return ps.map((p) => {
    const hh = h.find((x) => x.periodo === p) || {}; const kk = k.find((x) => x.periodo === p) || {};
    const horas = Number(hh.horas || 0), kg = Number(kk.kg || 0);
    return { periodo: p, horas: r2(horas), coste: r2(hh.coste || 0), kg: r2(kg), kg_hora: horas ? r2(kg / horas) : 0 };
  });
}

export const CATEGORIAS_COSTE = { material: 'Material', mano_obra: 'Mano de obra', pintura: 'Pintura y tratamientos', transporte: 'Transporte', elevacion: 'Medios de elevación', subcontrata: 'Subcontratas', otros: 'Otros' };

/** Costes reales por obra y categoría + coste por tonelada */
export async function costesObras(obraId = null) {
  const obras = (await resumenObras(db)).filter((o) => !obraId || o.id === obraId);
  const ids = obras.map((o) => o.id);
  if (!ids.length) return [];
  const [{ rows: manual }, { rows: mo }, { rows: el }, { rows: pres }] = await Promise.all([
    q('SELECT obra_id, categoria, SUM(importe) importe FROM costes WHERE obra_id = ANY($1) GROUP BY 1,2', [ids]),
    q('SELECT obra_id, SUM(coste) importe, SUM(horas) horas FROM partes_horas WHERE obra_id = ANY($1) GROUP BY 1', [ids]),
    q(`SELECT pm.obra_id, SUM(pmm.horas * md.coste_hora) importe FROM parte_montaje_medios pmm JOIN partes_montaje pm ON pm.id=pmm.parte_id
       JOIN medios md ON md.id=pmm.medio_id WHERE pm.obra_id = ANY($1) GROUP BY 1`, [ids]),
    q('SELECT obra_id, categoria, SUM(importe) importe FROM presupuesto_partidas WHERE obra_id = ANY($1) GROUP BY 1,2', [ids]),
  ]);
  return obras.map((o) => {
    const cats = {};
    for (const c of Object.keys(CATEGORIAS_COSTE)) cats[c] = { previsto: 0, real: 0 };
    manual.filter((x) => x.obra_id === o.id).forEach((x) => { cats[x.categoria].real += Number(x.importe); });
    const m = mo.find((x) => x.obra_id === o.id); if (m) cats.mano_obra.real += Number(m.importe);
    const e = el.find((x) => x.obra_id === o.id); if (e) cats.elevacion.real += Number(e.importe);
    pres.filter((x) => x.obra_id === o.id).forEach((x) => { cats[x.categoria].previsto += Number(x.importe); });
    const real = Object.values(cats).reduce((s, c) => s + c.real, 0);
    const previstoPartidas = Object.values(cats).reduce((s, c) => s + c.previsto, 0);
    const previsto = previstoPartidas || Number(o.presupuesto);
    const tFab = o.resumen.kg_fabricados / 1000; const tMont = o.resumen.kg_montados / 1000; const tUnicas = o.resumen.kg_unicos / 1000;
    for (const c of Object.values(cats)) { c.previsto = r2(c.previsto); c.real = r2(c.real); }
    return {
      obra_id: o.id, codigo: o.codigo, nombre: o.nombre, estado: o.estado, presupuesto: Number(o.presupuesto), previsto: r2(previsto), real: r2(real),
      desviacion: r2(real - previsto * (o.resumen.avance_global / 100)), consumido_pct: previsto ? r2((real / previsto) * 100) : 0,
      avance_global: o.resumen.avance_global, horas: r2(m?.horas || 0),
      t_unicas: r2(tUnicas), t_fabricadas: r2(tFab), t_montadas: r2(tMont),
      coste_t_fabricada: tFab ? r2(real / tFab) : null,
      coste_t_prevista: o.resumen.kg_previstos_fab ? r2(previsto / (o.resumen.kg_previstos_fab / 1000)) : null,
      precio_venta_t: o.resumen.kg_contratados ? r2(Number(o.presupuesto) / (o.resumen.kg_contratados / 1000)) : null,
      categorias: cats,
    };
  });
}

/** Comparativa fabricado vs. montado por obra */
export async function comparativaFabMontaje() {
  const obras = await obrasResumen();
  return obras.map((o) => {
    const r = o.resumen;
    return {
      obra_id: o.id, codigo: o.codigo, nombre: o.nombre, kg_unicos: r.kg_unicos, kg_fabricados: r.kg_fabricados,
      kg_expedidos: r.toneladas.expedidas ?? 0, kg_montados: r.kg_montados,
      kg_en_obra_sin_montar: r2(Math.max(0, (r.toneladas.expedidas ?? 0) - r.kg_montados)),
      kg_fabricado_sin_expedir: r2(Math.max(0, r.kg_fabricados - (r.toneladas.expedidas ?? 0))),
      pct_montado_sobre_fabricado: r.kg_fabricados ? r2((r.kg_montados / r.kg_fabricados) * 100) : 0,
    };
  });
}

export async function pendientes() {
  const obras = await obrasResumen();
  return obras.map((o) => ({
    obra_id: o.id, codigo: o.codigo, nombre: o.nombre, fecha_entrega: o.fecha_entrega,
    kg_previstos_fab: o.resumen.kg_previstos_fab, kg_fabricados: o.resumen.kg_fabricados, kg_pendiente_fabricar: o.resumen.kg_pendiente_fabricar,
    kg_previstos_montaje: o.resumen.kg_previstos_montaje, kg_montados: o.resumen.kg_montados, kg_pendiente_montar: o.resumen.kg_pendiente_montar,
  }));
}
