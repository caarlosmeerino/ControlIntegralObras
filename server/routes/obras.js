import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { resumenObras, resumenObra, crearFasesPorDefecto } from '../services/produccion.js';

const r = Router();
const ESTADOS = ['planificada', 'en_curso', 'pausada', 'terminada', 'cancelada'];

function leerObra(b) {
  return {
    codigo: str(b.codigo, 'código', { required: true, max: 40 }).toUpperCase(),
    nombre: str(b.nombre, 'nombre', { required: true, max: 200 }),
    cliente: str(b.cliente, 'cliente'),
    direccion: str(b.direccion, 'dirección de montaje'),
    responsable_id: b.responsable_id ? num(b.responsable_id, 'responsable', { int: true }) : null,
    fecha_inicio: date(b.fecha_inicio, 'inicio'),
    fecha_entrega: date(b.fecha_entrega, 'entrega'),
    kg_contratados: num(b.kg_contratados, 'kg contratados', { min: 0, def: 0 }),
    kg_previstos_fab: num(b.kg_previstos_fab, 'kg previstos de fabricación', { min: 0, def: 0 }),
    kg_previstos_montaje: num(b.kg_previstos_montaje, 'kg previstos de montaje', { min: 0, def: 0 }),
    presupuesto: num(b.presupuesto, 'presupuesto', { min: 0, def: 0 }),
    estado: oneOf(b.estado, 'estado', ESTADOS, 'planificada'),
    observaciones: str(b.observaciones, 'observaciones', { max: 5000 }),
  };
}

r.get('/', requirePerm('obras.ver'), wrap(async (req, res) => {
  let obras = await resumenObras({ query: q });
  if (req.query.estado) obras = obras.filter((o) => o.estado === req.query.estado);
  if (req.query.activas === '1') obras = obras.filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado));
  res.json(obras);
}));

r.post('/', requirePerm('obras.editar'), wrap(async (req, res) => {
  const o = leerObra(req.body);
  if (o.fecha_inicio && o.fecha_entrega && o.fecha_entrega < o.fecha_inicio) throw bad('La fecha de entrega no puede ser anterior a la de inicio.');
  const obra = await tx(async (db) => {
    const { rows: [n] } = await db.query(
      `INSERT INTO obras (codigo,nombre,cliente,direccion,responsable_id,fecha_inicio,fecha_entrega,kg_contratados,kg_previstos_fab,kg_previstos_montaje,presupuesto,estado,observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, Object.values(o));
    await crearFasesPorDefecto(db, n.id);
    await audit(db, { entidad: 'obra', entidadId: n.id, obraId: n.id, accion: 'crear', detalle: `Obra ${n.codigo} creada con las 9 fases por defecto`, usuarioId: req.user.id });
    return n;
  });
  res.status(201).json(obra);
}));

r.get('/:id', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await resumenObra({ query: q }, req.params.id));
}));

r.put('/:id', requirePerm('obras.editar'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await one('SELECT * FROM obras WHERE id=$1', [id]);
  if (!cur) throw notFound('No se ha encontrado la obra.');
  const o = leerObra({ ...cur, ...req.body });
  if (o.fecha_inicio && o.fecha_entrega && o.fecha_entrega < o.fecha_inicio) throw bad('La fecha de entrega no puede ser anterior a la de inicio.');
  const cambios = Object.keys(o).filter((k) => String(o[k] ?? '') !== String(cur[k] ?? ''));
  await q(`UPDATE obras SET codigo=$1,nombre=$2,cliente=$3,direccion=$4,responsable_id=$5,fecha_inicio=$6,fecha_entrega=$7,kg_contratados=$8,
           kg_previstos_fab=$9,kg_previstos_montaje=$10,presupuesto=$11,estado=$12,observaciones=$13,actualizado_en=now() WHERE id=$14`,
  [...Object.values(o), id]);
  if (cambios.length) {
    await audit({ query: q }, { entidad: 'obra', entidadId: id, obraId: id, accion: 'editar', detalle: `Cambios: ${cambios.join(', ')}`,
      datos: Object.fromEntries(cambios.map((k) => [k, { antes: cur[k], despues: o[k] }])), usuarioId: req.user.id });
  }
  res.json(await resumenObra({ query: q }, id));
}));

r.delete('/:id', requirePerm('usuarios.admin'), wrap(async (req, res) => {
  const o = await one('DELETE FROM obras WHERE id=$1 RETURNING codigo', [req.params.id]);
  if (!o) throw notFound('No se ha encontrado la obra.');
  await audit({ query: q }, { entidad: 'obra', entidadId: Number(req.params.id), accion: 'eliminar', detalle: `Obra ${o.codigo} eliminada`, usuarioId: req.user.id });
  res.json({ ok: true });
}));

r.get('/:id/historial', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await many(
    `SELECT h.*, u.nombre AS usuario FROM historial h LEFT JOIN usuarios u ON u.id=h.usuario_id
     WHERE h.obra_id=$1 ORDER BY h.fecha DESC LIMIT 300`, [req.params.id]));
}));

r.get('/:id/movimientos', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await many(
    `SELECT m.*, p.marca, f.nombre AS fase, f.clave, u.nombre AS usuario, t.nombre AS trabajador
     FROM movimientos m JOIN piezas p ON p.id=m.pieza_id JOIN obra_fases f ON f.id=m.obra_fase_id
     LEFT JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN trabajadores t ON t.id=m.trabajador_id
     WHERE m.obra_id=$1 ORDER BY m.fecha DESC LIMIT $2`, [req.params.id, Math.min(Number(req.query.limit) || 200, 2000)]));
}));

export default r;
