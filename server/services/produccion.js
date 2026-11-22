// =====================================================================
// NÚCLEO DE PRODUCCIÓN
//
// Modelo: cada pieza (marca) tiene una cantidad de unidades. Para cada
// fase se guarda cuántas unidades se han COMPLETADO (pieza_avance).
// Siempre se cumple: completadas(n+1) <= completadas(n) <= cantidad.
//
//  · kg completados de una fase = Σ completadas × peso unitario
//  · % de la fase              = kg completados / kg previstos de esa fase
//  · kg "en la fase" (ubicación) = kg completados fase anterior − kg completados fase
//    → la suma de ubicaciones es exactamente el peso único de la obra.
//  · Toneladas únicas          = Σ peso unitario × cantidad (cada pieza una vez)
//  · Producción acumulada      = Σ kg de movimientos (una tonelada cuenta en cada fase)
//
// NUNCA se suman las toneladas de todas las fases para obtener el total.
// =====================================================================
import { HttpError, bad, notFound, forbidden } from '../http.js';
import { can, permisoAvance } from '../permissions.js';
import { config } from '../config.js';

export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());

const r2 = (n) => Math.round(n * 100) / 100;

export async function fasesDeObra(db, obraId) {
  const { rows } = await db.query('SELECT * FROM obra_fases WHERE obra_id=$1 ORDER BY orden', [obraId]);
  return rows;
}

export async function crearFasesPorDefecto(db, obraId) {
  await db.query(
    `INSERT INTO obra_fases (obra_id, orden, clave, nombre, descripcion, ambito, seccion, indicador, peso_ponderacion)
     SELECT $1, orden, clave, nombre, descripcion, ambito, seccion, indicador, peso_ponderacion FROM fases_plantilla ORDER BY orden`,
    [obraId]
  );
}

// ---------- Estado de una pieza ----------
export function estadoPieza(pieza, fases, avMap, today = hoy()) {
  const comp = fases.map((f) => avMap.get(f.id) || 0);
  const idx = comp.findIndex((c) => c < pieza.cantidad);
  const actual = idx === -1 ? null : fases[idx];
  const algo = comp.some((c) => c > 0);
  let estado = !algo ? 'pendiente' : idx === -1 ? 'terminado' : 'en_curso';
  if (actual && actual.fecha_fin_prevista && actual.fecha_fin_prevista < today) estado = 'retrasado';
  const pesoTotal = r2(pieza.peso_unitario_kg * pieza.cantidad);
  const sumW = fases.reduce((s, f) => s + Number(f.peso_ponderacion), 0) || 1;
  const progreso = fases.reduce((s, f, i) => s + (comp[i] / pieza.cantidad) * Number(f.peso_ponderacion), 0) / sumW * 100;
  return {
    ...pieza,
    peso_total_kg: pesoTotal,
    estado,
    progreso: r2(progreso),
    fase_actual_id: actual?.id ?? null,
    fase_actual_nombre: actual?.nombre ?? 'Terminada',
    fase_actual_orden: actual?.orden ?? null,
    fase_actual_clave: actual?.clave ?? null,
    fase_actual_ambito: actual?.ambito ?? null,
    // unidades que están ahora en la fase actual (disponibles para completar)
    unidades_disponibles: idx === -1 ? 0 : (idx === 0 ? pieza.cantidad : comp[idx - 1]) - comp[idx],
    unidades_completadas_fase: idx === -1 ? pieza.cantidad : comp[idx],
    avance: fases.map((f, i) => ({ fase_id: f.id, orden: f.orden, nombre: f.nombre, clave: f.clave, ambito: f.ambito, completadas: comp[i],
      disponibles: (i === 0 ? pieza.cantidad : comp[i - 1]) - comp[i] })),
  };
}

export async function piezasConEstado(db, where = 'TRUE', params = []) {
  const { rows: piezas } = await db.query(
    `SELECT p.*, o.codigo AS obra_codigo, o.nombre AS obra_nombre, cp.familia, cp.designacion AS catalogo_nombre, cp.unidad AS catalogo_unidad, cp.peso AS catalogo_peso,
       et.nombre AS etapa_nombre, et.orden AS etapa_orden
     FROM piezas p JOIN obras o ON o.id=p.obra_id LEFT JOIN catalogo_piezas cp ON cp.id=p.catalogo_id LEFT JOIN etapas et ON et.id=p.etapa_id
     WHERE ${where} ORDER BY o.codigo, p.marca`, params);
  if (!piezas.length) return [];
  const obraIds = [...new Set(piezas.map((p) => p.obra_id))];
  const { rows: fases } = await db.query('SELECT * FROM obra_fases WHERE obra_id = ANY($1) ORDER BY obra_id, orden', [obraIds]);
  const { rows: av } = await db.query('SELECT * FROM pieza_avance WHERE pieza_id = ANY($1)', [piezas.map((p) => p.id)]);
  const fasesPorObra = new Map();
  for (const f of fases) (fasesPorObra.get(f.obra_id) || fasesPorObra.set(f.obra_id, []).get(f.obra_id)).push(f);
  const avPorPieza = new Map();
  for (const a of av) (avPorPieza.get(a.pieza_id) || avPorPieza.set(a.pieza_id, new Map()).get(a.pieza_id)).set(a.obra_fase_id, a.cantidad);
  const t = hoy();
  return piezas.map((p) => estadoPieza(p, fasesPorObra.get(p.obra_id) || [], avPorPieza.get(p.id) || new Map(), t));
}

export async function piezaConEstado(db, id) {
  const [p] = await piezasConEstado(db, 'p.id=$1', [id]);
  if (!p) throw notFound('No se ha encontrado la pieza.');
  return p;
}

// ---------- Registrar avance ----------
/**
 * Completa (delta > 0) o corrige (delta < 0) unidades de una pieza en una fase.
 * Si no se indica fase, se usa la fase actual. Si no se indica cantidad,
 * se completan todas las unidades disponibles en esa fase.
 */
export async function registrarAvance(db, { piezaId, faseId = null, cantidad = null, user, origen = 'web', nota = '',
  trabajadorId = null, parteMontajeId = null, fecha = null, checkPerm = true }) {
  const { rows: [pieza] } = await db.query('SELECT * FROM piezas WHERE id=$1 FOR UPDATE', [piezaId]);
  if (!pieza) throw notFound('No se ha encontrado la pieza.');
  const fases = await fasesDeObra(db, pieza.obra_id);
  if (!fases.length) throw bad('La obra no tiene fases definidas.');
  const { rows: av } = await db.query('SELECT obra_fase_id, cantidad FROM pieza_avance WHERE pieza_id=$1', [piezaId]);
  const avMap = new Map(av.map((a) => [a.obra_fase_id, a.cantidad]));
  const comp = fases.map((f) => avMap.get(f.id) || 0);

  let idx = faseId ? fases.findIndex((f) => f.id === Number(faseId)) : comp.findIndex((c) => c < pieza.cantidad);
  if (faseId && idx === -1) throw bad('La fase indicada no pertenece a la obra de esta pieza.');
  if (idx === -1) throw bad(`La pieza ${pieza.marca} ya ha completado todas las fases.`);
  const fase = fases[idx];
  const prev = idx === 0 ? pieza.cantidad : comp[idx - 1];
  const next = idx === fases.length - 1 ? 0 : comp[idx + 1];
  const actual = comp[idx];
  const delta = cantidad === null || cantidad === undefined ? prev - actual : Number(cantidad);

  if (!Number.isInteger(delta) || delta === 0) {
    if (prev - actual === 0) {
      throw bad(idx > 0 && prev < pieza.cantidad
        ? `No hay unidades de ${pieza.marca} disponibles en «${fase.nombre}». Primero hay que completar «${fases[idx - 1].nombre}».`
        : `La fase «${fase.nombre}» ya está completa para ${pieza.marca}.`);
    }
    throw bad('Indica una cantidad de unidades válida.');
  }
  if (checkPerm) {
    if (!can(user, permisoAvance(fase.ambito))) throw forbidden(`Tu perfil no puede registrar avances en «${fase.nombre}».`);
    if (delta < 0 && !can(user, 'avance.corregir') && !can(user, 'avance.obra')) throw forbidden('Tu perfil no puede corregir avances.');
  }
  if (delta > 0 && actual + delta > prev) {
    throw new HttpError(409, `Solo hay ${prev - actual} unidad(es) de ${pieza.marca} disponibles en «${fase.nombre}».` +
      (idx > 0 ? ` Las demás aún no han terminado «${fases[idx - 1].nombre}».` : ''));
  }
  if (delta < 0 && actual + delta < next) {
    throw new HttpError(409, `No se puede bajar a ${actual + delta}: ya hay ${next} unidad(es) en la fase siguiente. Corrige primero «${fases[idx + 1].nombre}».`);
  }
  const nuevo = actual + delta;
  await db.query(
    `INSERT INTO pieza_avance (pieza_id, obra_fase_id, cantidad, actualizado_en) VALUES ($1,$2,$3,now())
     ON CONFLICT (pieza_id, obra_fase_id) DO UPDATE SET cantidad=EXCLUDED.cantidad, actualizado_en=now()`,
    [piezaId, fase.id, nuevo]
  );
  const kg = r2(delta * pieza.peso_unitario_kg);
  const { rows: [mov] } = await db.query(
    `INSERT INTO movimientos (obra_id, pieza_id, obra_fase_id, cantidad, kg, usuario_id, origen, nota, trabajador_id, parte_montaje_id, fecha)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, COALESCE($11::timestamptz, now())) RETURNING *`,
    [pieza.obra_id, piezaId, fase.id, delta, kg, user?.id ?? null, origen, nota || '', trabajadorId, parteMontajeId, fecha]
  );
  // Fechas de la pieza
  const campo = { calidad: 'fecha_fabricacion', expedicion: 'fecha_expedicion', montaje: 'fecha_montaje' }[fase.clave];
  if (campo) {
    const dia = (fecha ? String(fecha).slice(0, 10) : hoy());
    if (nuevo === pieza.cantidad) await db.query(`UPDATE piezas SET ${campo}=COALESCE(${campo}, $2::date), actualizado_en=now() WHERE id=$1`, [piezaId, dia]);
    else if (delta < 0) await db.query(`UPDATE piezas SET ${campo}=NULL, actualizado_en=now() WHERE id=$1`, [piezaId]);
  }
  await db.query('UPDATE obras SET estado = CASE WHEN estado=\'planificada\' THEN \'en_curso\' ELSE estado END, actualizado_en=now() WHERE id=$1', [pieza.obra_id]);
  return { movimiento: mov, fase, pieza, unidades: delta, kg };
}

/** Lleva una pieza (todas o N unidades) hasta completar la fase indicada, rellenando las intermedias. */
export async function completarHasta(db, { piezaId, faseId, unidades = null, user, origen = 'lote', nota = '', trabajadorId = null, fecha = null, checkPerm = true }) {
  const { rows: [pieza] } = await db.query('SELECT * FROM piezas WHERE id=$1', [piezaId]);
  if (!pieza) throw notFound('No se ha encontrado la pieza.');
  const fases = await fasesDeObra(db, pieza.obra_id);
  const target = fases.findIndex((f) => f.id === Number(faseId));
  if (target === -1) throw bad('La fase indicada no pertenece a la obra de esta pieza.');
  const objetivo = Math.min(unidades ?? pieza.cantidad, pieza.cantidad);
  const res = [];
  for (let i = 0; i <= target; i++) {
    const { rows: [a] } = await db.query('SELECT cantidad FROM pieza_avance WHERE pieza_id=$1 AND obra_fase_id=$2', [piezaId, fases[i].id]);
    const actual = a?.cantidad || 0;
    if (actual < objetivo) {
      res.push(await registrarAvance(db, { piezaId, faseId: fases[i].id, cantidad: objetivo - actual, user, origen, nota, trabajadorId, fecha, checkPerm }));
    }
  }
  return res;
}

// ---------- Resumen de toneladas por obra ----------
function baseFase(f, obra, totalKg) {
  if (f.kg_previstos != null && Number(f.kg_previstos) > 0) return Number(f.kg_previstos);
  const prev = f.ambito === 'obra' ? Number(obra.kg_previstos_montaje) : Number(obra.kg_previstos_fab);
  return prev > 0 ? prev : totalKg;
}

export function calcularResumen(obra, fases, kgPorFase, piezasStats, today = hoy()) {
  const totalKg = piezasStats.kg_total || 0;
  let prevKg = totalKg;
  let sumW = 0, sumPct = 0, retrasadas = 0;
  const out = fases.map((f) => {
    const kg = r2(kgPorFase.get(f.id) || 0);
    const base = baseFase(f, obra, totalKg);
    const pct = base > 0 ? Math.min(100, (kg / base) * 100) : 0;
    const enFase = r2(Math.max(0, prevKg - kg));
    prevKg = kg;
    let estado = totalKg > 0 && kg >= totalKg - 0.001 ? 'terminado' : kg > 0 ? 'en_curso' : 'pendiente';
    if (estado !== 'terminado' && f.fecha_fin_prevista && f.fecha_fin_prevista < today) { estado = 'retrasado'; retrasadas++; }
    sumW += Number(f.peso_ponderacion); sumPct += pct * Number(f.peso_ponderacion);
    return {
      id: f.id, orden: f.orden, clave: f.clave, nombre: f.nombre, indicador: f.indicador, ambito: f.ambito, seccion: f.seccion,
      descripcion: f.descripcion, peso_ponderacion: Number(f.peso_ponderacion), kg_previstos: f.kg_previstos,
      fecha_inicio_prevista: f.fecha_inicio_prevista, fecha_fin_prevista: f.fecha_fin_prevista,
      kg_base: r2(base), kg_completados: kg, kg_pendientes: r2(Math.max(0, base - kg)), kg_en_fase: enFase, porcentaje: r2(pct), estado,
    };
  });
  const porClave = Object.fromEntries(out.filter((f) => f.clave).map((f) => [f.clave, f.kg_completados]));
  const avanceGlobal = sumW ? r2(sumPct / sumW) : 0;
  const ultimaFab = [...out].reverse().find((f) => f.ambito !== 'obra');
  const montaje = out.find((f) => f.clave === 'montaje') || [...out].reverse().find((f) => f.ambito === 'obra');
  const kgFabricados = porClave.calidad ?? porClave.armado ?? 0;
  let estado = obra.estado;
  const retrasada = (obra.fecha_entrega && obra.fecha_entrega < today && !['terminada', 'cancelada'].includes(obra.estado)) || retrasadas > 0;
  return {
    kg_unicos: r2(totalKg),
    n_piezas: piezasStats.n_marcas || 0,
    n_unidades: piezasStats.n_unidades || 0,
    kg_previstos_fab: Number(obra.kg_previstos_fab),
    kg_previstos_montaje: Number(obra.kg_previstos_montaje),
    kg_contratados: Number(obra.kg_contratados),
    toneladas: {
      previstas: Number(obra.kg_previstos_fab) || r2(totalKg),
      aprobadas: porClave.ingenieria ?? null,
      recibidas: porClave.compras ?? null,
      cortadas: porClave.corte ?? null,
      armadas: porClave.armado ?? null,
      inspeccionadas: porClave.calidad ?? null,
      pintadas: porClave.pintura ?? null,
      expedidas: porClave.expedicion ?? null,
      montadas: porClave.montaje ?? null,
      entregadas: porClave.entrega ?? null,
    },
    kg_fabricados: kgFabricados,
    kg_pendiente_fabricar: r2(Math.max(0, (Number(obra.kg_previstos_fab) || totalKg) - kgFabricados)),
    kg_montados: montaje?.kg_completados ?? 0,
    kg_pendiente_montar: r2(Math.max(0, (Number(obra.kg_previstos_montaje) || totalKg) - (montaje?.kg_completados ?? 0))),
    kg_salida_taller: ultimaFab?.kg_completados ?? 0,
    produccion_acumulada_kg: r2(out.reduce((s, f) => s + f.kg_completados, 0)),
    avance_global: avanceGlobal,
    fases_retrasadas: retrasadas,
    retrasada,
    estado,
    fases: out,
  };
}

export async function resumenObras(db, obraIds = null) {
  const filtro = obraIds ? 'WHERE o.id = ANY($1)' : '';
  const params = obraIds ? [obraIds] : [];
  const { rows: obras } = await db.query(
    `SELECT o.*, u.nombre AS responsable_nombre FROM obras o LEFT JOIN usuarios u ON u.id=o.responsable_id ${filtro} ORDER BY o.fecha_entrega NULLS LAST, o.codigo`, params);
  if (!obras.length) return [];
  const ids = obras.map((o) => o.id);
  const [{ rows: fases }, { rows: kg }, { rows: stats }, { rows: etapas }] = await Promise.all([
    db.query('SELECT * FROM obra_fases WHERE obra_id = ANY($1) ORDER BY obra_id, orden', [ids]),
    db.query(`SELECT a.obra_fase_id, SUM(a.cantidad * p.peso_unitario_kg) AS kg FROM pieza_avance a JOIN piezas p ON p.id=a.pieza_id
              WHERE p.obra_id = ANY($1) GROUP BY a.obra_fase_id`, [ids]),
    db.query(`SELECT obra_id, COUNT(*)::int AS n_marcas, SUM(cantidad)::int AS n_unidades, SUM(peso_unitario_kg*cantidad) AS kg_total,
              SUM(m2_unitario*cantidad) AS m2_total, SUM(ml_unitario*cantidad) AS ml_total
              FROM piezas WHERE obra_id = ANY($1) GROUP BY obra_id`, [ids]),
    db.query(`SELECT e.*, (SELECT COUNT(*)::int FROM etapa_tareas t WHERE t.etapa_id=e.id) AS tareas_total,
      (SELECT COUNT(*)::int FROM etapa_tareas t WHERE t.etapa_id=e.id AND t.hecha) AS tareas_hechas
      FROM etapas e WHERE e.obra_id = ANY($1) ORDER BY e.obra_id, e.orden`, [ids]),
  ]);
  const kgMap = new Map(kg.map((k) => [k.obra_fase_id, Number(k.kg)]));
  const st = new Map(stats.map((s) => [s.obra_id, s]));
  const t = hoy();
  return obras.map((o) => {
    const fs = fases.filter((f) => f.obra_id === o.id);
    const sp = st.get(o.id) || {};
    return { ...o, etapas: etapas.filter((e) => e.obra_id === o.id), m2_despiece: Number(sp.m2_total || 0), ml_despiece: Number(sp.ml_total || 0),
      resumen: calcularResumen(o, fs, kgMap, sp, t) };
  });
}

export async function resumenObra(db, obraId) {
  const [o] = await resumenObras(db, [Number(obraId)]);
  if (!o) throw notFound('No se ha encontrado la obra.');
  return o;
}
