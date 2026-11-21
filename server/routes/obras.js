import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { resolverCiudad } from '../municipios.js';
import { resumenObras, resumenObra, crearFasesPorDefecto } from '../services/produccion.js';

const r = Router();
const ESTADOS = ['planificada', 'en_curso', 'pausada', 'terminada', 'cancelada'];

function leerObra(b) {
  return {
    codigo: str(b.codigo, 'código', { max: 40 }).toUpperCase(),
    nombre: str(b.nombre, 'nombre', { required: true, max: 200 }),
    cliente: str(b.cliente, 'cliente'),
    direccion: str(b.direccion, 'dirección', { max: 300 }),
    ...resolverCiudad(str(b.ciudad, 'ciudad', { max: 120 }), str(b.provincia, 'provincia', { max: 80 })),
    responsable_id: b.responsable_id ? num(b.responsable_id, 'responsable', { int: true }) : null,
    kg_contratados: num(b.kg_contratados, 'kg contratados', { min: 0, def: 0 }),
    kg_previstos_fab: num(b.kg_previstos_fab, 'peso previsto (kg)', { min: 0, def: 0 }),
    kg_previstos_montaje: num(b.kg_previstos_montaje, 'peso previsto de montaje (kg)', { min: 0, def: 0 }),
    m2_previstos: num(b.m2_previstos, 'superficie (m²)', { min: 0, def: 0 }),
    ml_previstos: num(b.ml_previstos, 'longitud (ml)', { min: 0, def: 0 }),
    codigo_postal: str(b.codigo_postal, 'código postal', { max: 10 }),
    lat: b.lat === null || b.lat === '' || b.lat === undefined ? null : num(b.lat, 'latitud', { min: 25, max: 45 }),
    lng: b.lng === null || b.lng === '' || b.lng === undefined ? null : num(b.lng, 'longitud', { min: -20, max: 6 }),
    estado: oneOf(b.estado, 'estado', ESTADOS, 'planificada'),
    observaciones: str(b.observaciones, 'observaciones', { max: 5000 }),
  };
}

/** Fases del proyecto (etapas): nombre editable y fechas de inicio y fin */
function leerEtapas(lista) {
  if (lista === undefined) return undefined;
  if (!Array.isArray(lista)) throw bad('Las fases no tienen un formato válido.');
  return lista.map((e, i) => {
    const et = { nombre: str(e.nombre, `nombre de la fase ${i + 1}`, { max: 120 }) || `Fase ${i + 1}`,
      fecha_inicio: date(e.fecha_inicio, `inicio de la fase ${i + 1}`), fecha_fin: date(e.fecha_fin, `fin de la fase ${i + 1}`) };
    if (et.fecha_inicio && et.fecha_fin && et.fecha_fin < et.fecha_inicio) throw bad(`En «${et.nombre}» la fecha de fin es anterior a la de inicio.`);
    return et;
  });
}

async function guardarEtapas(db, obraId, etapas) {
  if (etapas === undefined) return;
  await db.query('DELETE FROM etapas WHERE obra_id=$1', [obraId]);
  for (const [i, e] of etapas.entries()) {
    await db.query('INSERT INTO etapas (obra_id, orden, nombre, fecha_inicio, fecha_fin) VALUES ($1,$2,$3,$4,$5)', [obraId, i + 1, e.nombre, e.fecha_inicio, e.fecha_fin]);
  }
  // Las fechas generales del proyecto salen de sus fases
  await db.query(`UPDATE obras SET fecha_inicio = (SELECT MIN(fecha_inicio) FROM etapas WHERE obra_id=$1),
                  fecha_entrega = (SELECT MAX(fecha_fin) FROM etapas WHERE obra_id=$1) WHERE id=$1`, [obraId]);
}

const COLS = ['codigo', 'nombre', 'cliente', 'direccion', 'ciudad', 'provincia', 'responsable_id', 'kg_contratados', 'kg_previstos_fab',
  'kg_previstos_montaje', 'm2_previstos', 'ml_previstos', 'codigo_postal', 'lat', 'lng', 'estado', 'observaciones'];

r.get('/', requirePerm('obras.ver'), wrap(async (req, res) => {
  let obras = await resumenObras({ query: q });
  if (req.query.estado) obras = obras.filter((o) => o.estado === req.query.estado);
  if (req.query.activas === '1') obras = obras.filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado));
  res.json(obras);
}));

r.post('/', requirePerm('obras.editar'), wrap(async (req, res) => {
  const o = leerObra(req.body);
  const etapas = leerEtapas(req.body.etapas) ?? [];
  const obra = await tx(async (db) => {
    if (!o.codigo) {
      // Código automático: OB-AAAA-NNN
      const y = new Date().getFullYear();
      const { rows: [m] } = await db.query(`SELECT COALESCE(MAX(substring(codigo from '^OB-${y}-(\\d+)$')::int), 0) + 1 AS n FROM obras`);
      o.codigo = `OB-${y}-${String(m.n).padStart(3, '0')}`;
    }
    const { rows: [n] } = await db.query(
      `INSERT INTO obras (${COLS.join(',')}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, COLS.map((c) => o[c]));
    await crearFasesPorDefecto(db, n.id);
    await guardarEtapas(db, n.id, etapas);
    await audit(db, { entidad: 'obra', entidadId: n.id, obraId: n.id, accion: 'crear', detalle: `Proyecto ${n.codigo} creado con ${etapas.length} fase(s)`, usuarioId: req.user.id });
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
  if (!o.codigo) o.codigo = cur.codigo;
  const etapas = leerEtapas(req.body.etapas);
  const cambios = COLS.filter((k) => String(o[k] ?? '') !== String(cur[k] ?? ''));
  await tx(async (db) => {
    await db.query(`UPDATE obras SET ${COLS.map((c, i) => `${c}=$${i + 1}`).join(',')}, actualizado_en=now() WHERE id=$${COLS.length + 1}`, [...COLS.map((c) => o[c]), id]);
    await guardarEtapas(db, id, etapas);
    if (cambios.length || etapas) {
      await audit(db, { entidad: 'obra', entidadId: id, obraId: id, accion: 'editar', detalle: `Cambios: ${[...cambios, ...(etapas ? ['fases'] : [])].join(', ')}`,
        datos: Object.fromEntries(cambios.map((k) => [k, { antes: cur[k], despues: o[k] }])), usuarioId: req.user.id });
    }
  });
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
