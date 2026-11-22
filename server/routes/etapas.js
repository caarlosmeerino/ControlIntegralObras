// Fases del proyecto: detalle, confirmación de fin, checklist y planning semanal
import { Router } from 'express';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, str, date } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { obraPropia, idsObrasPropias, etapaPropia, tareaPropia, piezaPropia, trabajadorPropio } from '../propiedad.js';

const r = Router();

const conTareas = `SELECT e.*, o.codigo AS obra_codigo, o.nombre AS obra_nombre, o.cliente, o.ciudad, o.estado AS obra_estado,
  u.nombre AS completada_por_nombre,
  (SELECT COUNT(*)::int FROM etapa_tareas t WHERE t.etapa_id=e.id) AS tareas_total,
  (SELECT COUNT(*)::int FROM etapa_tareas t WHERE t.etapa_id=e.id AND t.hecha) AS tareas_hechas
  FROM etapas e JOIN obras o ON o.id=e.obra_id LEFT JOIN usuarios u ON u.id=e.completada_por`;

// Planning: fases que se solapan con un rango de fechas
r.get('/planning', requirePerm('obras.ver'), wrap(async (req, res) => {
  const desde = date(req.query.desde, 'desde'); const hasta = date(req.query.hasta, 'hasta');
  if (!desde || !hasta) throw bad('Indica el rango de fechas.');
  res.json(await many(`${conTareas}
    WHERE o.propietario_id=$3 AND o.estado NOT IN ('cancelada') AND COALESCE(e.fecha_inicio, e.fecha_fin) <= $2 AND COALESCE(e.fecha_fin, e.fecha_inicio) >= $1
    ORDER BY COALESCE(e.fecha_inicio, e.fecha_fin), o.nombre, e.orden`, [desde, hasta, req.user.id]));
}));

r.get('/:id', requirePerm('obras.ver'), wrap(async (req, res) => {
  const e = await one(`${conTareas} WHERE e.id=$1 AND o.propietario_id=$2`, [req.params.id, req.user.id]);
  if (!e) throw notFound('No se ha encontrado la fase.');
  const tareas = await many(`SELECT t.*, u.nombre AS hecha_por_nombre FROM etapa_tareas t LEFT JOIN usuarios u ON u.id=t.hecha_por
    WHERE t.etapa_id=$1 ORDER BY t.orden, t.id`, [e.id]);
  const hermanas = await many('SELECT id, orden, nombre, fecha_inicio, fecha_fin FROM etapas WHERE obra_id=$1 ORDER BY orden', [e.obra_id]);
  res.json({ ...e, tareas, hermanas });
}));

// Confirmar (o reabrir) que la fase está terminada
r.put('/:id/completar', requirePerm('obras.editar', 'fases.editar'), wrap(async (req, res) => {
  const e = await etapaPropia(req, req.params.id);
  const si = !!req.body.completada;
  await q(`UPDATE etapas SET completada=$1, completada_en=CASE WHEN $1 THEN now() END, completada_por=CASE WHEN $1 THEN $2::int END WHERE id=$3`, [si, req.user.id, e.id]);
  await audit({ query: q }, { entidad: 'obra', entidadId: e.obra_id, obraId: e.obra_id, accion: si ? 'fase_terminada' : 'fase_reabierta',
    detalle: `${e.nombre}: ${si ? 'confirmada como terminada' : 'reabierta'}`, usuarioId: req.user.id });
  res.json(await one(`${conTareas} WHERE e.id=$1`, [e.id]));
}));

r.put('/:id/notas', requirePerm('obras.editar', 'fases.editar'), wrap(async (req, res) => {
  await etapaPropia(req, req.params.id);
  const e = await one('UPDATE etapas SET notas=$1 WHERE id=$2 RETURNING id', [str(req.body.notas, 'notas', { max: 5000 }), req.params.id]);
  if (!e) throw notFound(); res.json({ ok: true });
}));

// ---- Checklist ----
r.post('/:id/tareas', requirePerm('obras.editar', 'fases.editar'), wrap(async (req, res) => {
  const e = await etapaPropia(req, req.params.id);
  const textos = (Array.isArray(req.body.textos) ? req.body.textos : [req.body.texto]).map((x) => str(x, 'tarea', { max: 300 })).filter(Boolean);
  if (!textos.length) throw bad('Escribe la tarea.');
  const { rows: [m] } = await q('SELECT COALESCE(MAX(orden),0) n FROM etapa_tareas WHERE etapa_id=$1', [e.id]);
  const out = [];
  for (const [i, t] of textos.entries()) out.push(await one('INSERT INTO etapa_tareas (etapa_id, orden, texto) VALUES ($1,$2,$3) RETURNING *', [e.id, m.n + i + 1, t]));
  res.status(201).json(out);
}));

r.put('/tareas/:tid', requirePerm('obras.editar', 'fases.editar'), wrap(async (req, res) => {
  const t = await tareaPropia(req, req.params.tid);
  const hecha = req.body.hecha === undefined ? t.hecha : !!req.body.hecha;
  const texto = req.body.texto === undefined ? t.texto : str(req.body.texto, 'tarea', { required: true, max: 300 });
  res.json(await one(`UPDATE etapa_tareas SET hecha=$1, texto=$2, hecha_en=CASE WHEN $1 THEN COALESCE(hecha_en, now()) END,
    hecha_por=CASE WHEN $1 THEN COALESCE(hecha_por, $3::int) END WHERE id=$4 RETURNING *`, [hecha, texto, req.user.id, t.id]));
}));

r.delete('/tareas/:tid', requirePerm('obras.editar', 'fases.editar'), wrap(async (req, res) => {
  await tareaPropia(req, req.params.tid);
  const t = await one('DELETE FROM etapa_tareas WHERE id=$1 RETURNING id', [req.params.tid]);
  if (!t) throw notFound(); res.json({ ok: true });
}));

export default r;
