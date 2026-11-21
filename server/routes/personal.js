import { nes } from '../http.js';
import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { can } from '../permissions.js';
import { audit } from '../audit.js';
import { hoy } from '../services/produccion.js';

const r = Router();
export const SECCIONES = ['corte', 'armado', 'soldadura', 'pintura', 'montaje', 'calidad', 'expedicion', 'oficina'];

// ---------- Trabajadores ----------
r.get('/trabajadores', wrap(async (req, res) => {
  const verCostes = can(req.user, 'costes.ver') || can(req.user, 'personal.editar');
  const rows = await many(
    `SELECT t.*, e.nombre AS equipo, u.username,
       COALESCE((SELECT array_agg(clave_fase ORDER BY clave_fase) FROM trabajador_operaciones o WHERE o.trabajador_id=t.id), '{}') AS operaciones
     FROM trabajadores t LEFT JOIN equipos e ON e.id=t.equipo_id LEFT JOIN usuarios u ON u.id=t.usuario_id
     WHERE ($1::boolean OR t.activo) ORDER BY t.activo DESC, t.nombre`, [req.query.todos === '1']);
  res.json(rows.map((t) => (verCostes ? t : { ...t, coste_hora: undefined, documento: undefined })));
}));

function leerT(b) {
  return {
    nombre: str(b.nombre, 'nombre', { required: true, max: 120 }),
    documento: str(b.documento, 'documento', { max: 30 }),
    telefono: str(b.telefono, 'teléfono', { max: 30 }),
    seccion: oneOf(b.seccion, 'sección', SECCIONES),
    categoria: str(b.categoria, 'categoría', { def: 'Oficial 1ª', max: 60 }),
    coste_hora: num(b.coste_hora, 'coste por hora', { min: 0, max: 500, def: 0 }),
    equipo_id: b.equipo_id ? Number(b.equipo_id) : null,
    usuario_id: b.usuario_id ? Number(b.usuario_id) : null,
    activo: b.activo === undefined ? true : !!b.activo,
  };
}
async function guardarOps(db, id, ops) {
  if (!Array.isArray(ops)) return;
  await db.query('DELETE FROM trabajador_operaciones WHERE trabajador_id=$1', [id]);
  for (const c of ops) await db.query('INSERT INTO trabajador_operaciones VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, String(c)]);
}

r.post('/trabajadores', requirePerm('personal.editar'), wrap(async (req, res) => {
  const t = leerT(req.body);
  const n = await tx(async (db) => {
    const { rows: [n] } = await db.query(
      `INSERT INTO trabajadores (nombre, documento, telefono, seccion, categoria, coste_hora, equipo_id, usuario_id, activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, Object.values(t));
    await guardarOps(db, n.id, req.body.operaciones);
    await audit(db, { entidad: 'trabajador', entidadId: n.id, accion: 'crear', detalle: `Trabajador ${n.nombre} (${n.seccion})`, usuarioId: req.user.id });
    return n;
  });
  res.status(201).json(n);
}));

r.put('/trabajadores/:id', requirePerm('personal.editar'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM trabajadores WHERE id=$1', [req.params.id]);
  if (!cur) throw notFound('No se ha encontrado el trabajador.');
  const t = leerT({ ...cur, ...req.body });
  const n = await tx(async (db) => {
    const { rows: [n] } = await db.query(
      `UPDATE trabajadores SET nombre=$1, documento=$2, telefono=$3, seccion=$4, categoria=$5, coste_hora=$6, equipo_id=$7, usuario_id=$8, activo=$9 WHERE id=$10 RETURNING *`,
      [...Object.values(t), cur.id]);
    await guardarOps(db, cur.id, req.body.operaciones);
    await audit(db, { entidad: 'trabajador', entidadId: cur.id, accion: 'editar', detalle: `Trabajador ${n.nombre}`, usuarioId: req.user.id });
    return n;
  });
  res.json(n);
}));

// ---------- Equipos ----------
r.get('/equipos', wrap(async (req, res) => {
  res.json(await many(`SELECT e.*, (SELECT COUNT(*)::int FROM trabajadores t WHERE t.equipo_id=e.id AND t.activo) AS personas FROM equipos e ORDER BY e.activo DESC, e.seccion, e.nombre`));
}));
r.post('/equipos', requirePerm('personal.editar'), wrap(async (req, res) => {
  res.status(201).json(await one('INSERT INTO equipos (nombre, seccion) VALUES ($1,$2) RETURNING *',
    [str(req.body.nombre, 'nombre', { required: true }), oneOf(req.body.seccion, 'sección', SECCIONES)]));
}));
r.put('/equipos/:id', requirePerm('personal.editar'), wrap(async (req, res) => {
  const n = await one('UPDATE equipos SET nombre=$1, seccion=$2, activo=$3 WHERE id=$4 RETURNING *',
    [str(req.body.nombre, 'nombre', { required: true }), oneOf(req.body.seccion, 'sección', SECCIONES), req.body.activo !== false, req.params.id]);
  if (!n) throw notFound(); res.json(n);
}));

// ---------- Medios de elevación ----------
r.get('/medios', wrap(async (req, res) => {
  const rows = await many('SELECT * FROM medios ORDER BY activo DESC, tipo, nombre');
  res.json(can(req.user, 'costes.ver') ? rows : rows.map((m) => ({ ...m, coste_hora: undefined })));
}));
const leerM = (b) => [str(b.nombre, 'nombre', { required: true }), str(b.tipo, 'tipo', { def: 'grua' }), str(b.matricula, 'matrícula'),
  num(b.coste_hora, 'coste por hora', { min: 0, def: 0 }), b.propio !== false, b.activo !== false];
r.post('/medios', requirePerm('personal.editar'), wrap(async (req, res) => {
  res.status(201).json(await one('INSERT INTO medios (nombre, tipo, matricula, coste_hora, propio, activo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', leerM(req.body)));
}));
r.put('/medios/:id', requirePerm('personal.editar'), wrap(async (req, res) => {
  const n = await one('UPDATE medios SET nombre=$1, tipo=$2, matricula=$3, coste_hora=$4, propio=$5, activo=$6 WHERE id=$7 RETURNING *', [...leerM(req.body), req.params.id]);
  if (!n) throw notFound(); res.json(n);
}));

// ---------- Partes de horas ----------
r.get('/horas', wrap(async (req, res) => {
  const fecha = date(req.query.fecha, 'fecha');
  const desde = date(req.query.desde, 'desde') || fecha || hoy();
  const hasta = date(req.query.hasta, 'hasta') || fecha || hoy();
  // Un operario solo ve sus propias horas
  let soloTrab = null;
  if (!can(req.user, 'personal.ver')) {
    const t = await one('SELECT id FROM trabajadores WHERE usuario_id=$1', [req.user.id]);
    soloTrab = t?.id || -1;
  }
  res.json(await many(
    `SELECT ph.*, t.nombre AS trabajador, t.seccion AS seccion_trabajador, o.codigo AS obra_codigo, u.nombre AS registrado_por
     FROM partes_horas ph JOIN trabajadores t ON t.id=ph.trabajador_id LEFT JOIN obras o ON o.id=ph.obra_id LEFT JOIN usuarios u ON u.id=ph.usuario_id
     WHERE ph.fecha BETWEEN $1 AND $2 AND ($3::int IS NULL OR ph.trabajador_id=$3) AND ($4::text IS NULL OR ph.seccion=$4)
     ORDER BY ph.fecha DESC, t.nombre`, [desde, hasta, soloTrab ?? (req.query.trabajador_id ? Number(req.query.trabajador_id) : null), req.query.seccion || null]));
}));

r.post('/horas', requirePerm('partes.taller', 'partes.montaje'), wrap(async (req, res) => {
  const lineas = Array.isArray(req.body.lineas) ? req.body.lineas : [req.body];
  if (!lineas.length) throw bad('Añade al menos un trabajador.');
  const creados = await tx(async (db) => {
    const out = [];
    let miTrab = null;
    if (!can(req.user, 'personal.ver')) miTrab = (await db.query('SELECT id FROM trabajadores WHERE usuario_id=$1', [req.user.id])).rows[0]?.id;
    for (const l of lineas) {
      const tid = num(l.trabajador_id, 'trabajador', { int: true });
      if (miTrab !== null && tid !== miTrab) throw bad('Solo puedes registrar tus propias horas.');
      const { rows: [t] } = await db.query('SELECT * FROM trabajadores WHERE id=$1', [tid]);
      if (!t) throw notFound('No se ha encontrado el trabajador.');
      const horas = num(l.horas, 'horas', { min: 0.25, max: 24 });
      const { rows: [n] } = await db.query(
        `INSERT INTO partes_horas (fecha, trabajador_id, obra_id, seccion, horas, operacion, coste, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [date(l.fecha || req.body.fecha, 'fecha') || hoy(), tid, l.obra_id || req.body.obra_id || null, oneOf(l.seccion || t.seccion, 'sección', SECCIONES),
          horas, str(l.operacion, 'operación', { max: 300 }), Math.round(horas * Number(t.coste_hora) * 100) / 100, req.user.id]);
      out.push(n);
    }
    return out;
  });
  const total = creados.reduce((s, c) => s + Number(c.horas), 0);
  res.status(201).json({ creados, mensaje: `Registradas ${nes(total)} h para ${creados.length} trabajador(es).` });
}));

r.delete('/horas/:id', requirePerm('partes.taller', 'partes.montaje'), wrap(async (req, res) => {
  const h = await one('SELECT * FROM partes_horas WHERE id=$1', [req.params.id]);
  if (!h) throw notFound();
  if (!can(req.user, 'personal.ver') && h.usuario_id !== req.user.id) throw bad('Solo puedes borrar horas que hayas registrado tú.');
  await q('DELETE FROM partes_horas WHERE id=$1', [h.id]);
  res.json({ ok: true });
}));

export default r;
