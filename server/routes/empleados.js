// Empleados de la empresa y su asignación a proyectos
import { Router } from 'express';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, str, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { SECCIONES } from './personal.js';
import { obraPropia, idsObrasPropias, etapaPropia, tareaPropia, piezaPropia, trabajadorPropio } from '../propiedad.js';

const r = Router();

function leer(b) {
  return {
    nombre: str(b.nombre, 'nombre', { required: true, max: 120 }),
    categoria: str(b.categoria, 'puesto', { max: 60, def: '' }),
    seccion: oneOf(b.seccion || 'montaje', 'oficio', SECCIONES),
    telefono: str(b.telefono, 'teléfono', { max: 30 }),
    documento: '',
    activo: b.activo === undefined ? true : !!b.activo,
  };
}

// Lista de empleados con los proyectos en los que están
r.get('/', requirePerm('personal.ver'), wrap(async (req, res) => {
  res.json(await many(
    `SELECT t.id, t.nombre, t.categoria, t.seccion, t.telefono, t.activo,
       COALESCE(json_agg(json_build_object('id', o.id, 'nombre', o.nombre, 'estado', o.estado, 'funcion', oe.funcion) ORDER BY o.nombre) FILTER (WHERE o.id IS NOT NULL), '[]') AS obras
     FROM trabajadores t LEFT JOIN obra_empleados oe ON oe.trabajador_id=t.id LEFT JOIN obras o ON o.id=oe.obra_id AND o.propietario_id=$2
     WHERE t.propietario_id=$2 AND ($1::boolean OR t.activo) GROUP BY t.id ORDER BY t.activo DESC, t.nombre`, [req.query.todos === '1', req.user.id]));
}));

r.post('/', requirePerm('personal.editar'), wrap(async (req, res) => {
  const d = leer(req.body);
  const n = await one(`INSERT INTO trabajadores (nombre, categoria, seccion, telefono, documento, activo, propietario_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [...Object.values(d), req.user.id]);
  await audit({ query: q }, { entidad: 'trabajador', entidadId: n.id, accion: 'crear', detalle: `Empleado ${n.nombre}`, usuarioId: req.user.id });
  res.status(201).json(n);
}));

r.put('/:id', requirePerm('personal.editar'), wrap(async (req, res) => {
  const cur = await trabajadorPropio(req, req.params.id);
  const d = leer({ ...cur, ...req.body });
  const n = await one(`UPDATE trabajadores SET nombre=$1, categoria=$2, seccion=$3, telefono=$4, documento=$5, activo=$6 WHERE id=$7 RETURNING *`, [...Object.values(d), cur.id]);
  await audit({ query: q }, { entidad: 'trabajador', entidadId: cur.id, accion: 'editar', detalle: `Empleado ${n.nombre}`, usuarioId: req.user.id });
  res.json(n);
}));

// ---------- Equipo de un proyecto ----------
r.get('/obra/:obraId', requirePerm('obras.ver'), wrap(async (req, res) => {
  await obraPropia(req, req.params.obraId);
  res.json(await many(
    `SELECT t.id, t.nombre, t.categoria, t.seccion, t.telefono, t.activo, oe.funcion, oe.creado_en AS asignado_en
     FROM obra_empleados oe JOIN trabajadores t ON t.id=oe.trabajador_id WHERE oe.obra_id=$1 ORDER BY t.nombre`, [req.params.obraId]));
}));

r.post('/obra/:obraId', requirePerm('obras.editar'), wrap(async (req, res) => {
  const obra = await obraPropia(req, req.params.obraId);
  const pedidos = (Array.isArray(req.body.ids) ? req.body.ids : [req.body.trabajador_id]).map(Number).filter(Boolean);
  const ids = (await many('SELECT id FROM trabajadores WHERE id = ANY($1) AND propietario_id=$2', [pedidos, req.user.id])).map((x) => x.id);
  if (!ids.length) throw bad('Elige al menos un empleado.');
  for (const id of ids) {
    await q('INSERT INTO obra_empleados (obra_id, trabajador_id, funcion) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [obra.id, id, str(req.body.funcion, 'función', { max: 80 })]);
  }
  await audit({ query: q }, { entidad: 'obra', entidadId: obra.id, obraId: obra.id, accion: 'equipo', detalle: `${ids.length} empleado(s) añadidos al equipo`, usuarioId: req.user.id });
  res.status(201).json({ ok: true });
}));

r.put('/obra/:obraId/:tid', requirePerm('obras.editar'), wrap(async (req, res) => {
  await obraPropia(req, req.params.obraId);
  const x = await one('UPDATE obra_empleados SET funcion=$1 WHERE obra_id=$2 AND trabajador_id=$3 RETURNING obra_id',
    [str(req.body.funcion, 'función', { max: 80 }), req.params.obraId, req.params.tid]);
  if (!x) throw notFound('Ese empleado no está en el proyecto.');
  res.json({ ok: true });
}));

r.delete('/obra/:obraId/:tid', requirePerm('obras.editar'), wrap(async (req, res) => {
  await obraPropia(req, req.params.obraId);
  await q('DELETE FROM obra_empleados WHERE obra_id=$1 AND trabajador_id=$2', [req.params.obraId, req.params.tid]);
  res.json({ ok: true });
}));

export default r;
