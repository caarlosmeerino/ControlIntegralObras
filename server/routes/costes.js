import { nes } from '../http.js';
import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, notFound, num, str, date, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { costesObras, CATEGORIAS_COSTE } from '../services/informes.js';
import { hoy } from '../services/produccion.js';

const r = Router();
const CATS = Object.keys(CATEGORIAS_COSTE);

r.get('/resumen', requirePerm('costes.ver'), wrap(async (req, res) => {
  res.json({ categorias: CATEGORIAS_COSTE, obras: await costesObras(req.query.obra_id ? Number(req.query.obra_id) : null) });
}));

r.get('/obra/:obraId', requirePerm('costes.ver'), wrap(async (req, res) => {
  const id = Number(req.params.obraId);
  const [resumen] = await costesObras(id);
  if (!resumen) throw notFound('No se ha encontrado la obra.');
  const [partidas, costes] = await Promise.all([
    many('SELECT * FROM presupuesto_partidas WHERE obra_id=$1 ORDER BY categoria, concepto', [id]),
    many('SELECT c.*, u.nombre AS usuario FROM costes c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE obra_id=$1 ORDER BY fecha DESC, id DESC', [id]),
  ]);
  res.json({ categorias: CATEGORIAS_COSTE, resumen, partidas, costes });
}));

// Presupuesto: reemplaza todas las partidas de la obra
r.put('/obra/:obraId/presupuesto', requirePerm('costes.editar'), wrap(async (req, res) => {
  const id = Number(req.params.obraId);
  const partidas = (req.body.partidas || []).map((p) => ({ categoria: oneOf(p.categoria, 'categoría', CATS), concepto: str(p.concepto, 'concepto', { max: 200 }), importe: num(p.importe, 'importe', { min: 0 }) }));
  await tx(async (db) => {
    await db.query('DELETE FROM presupuesto_partidas WHERE obra_id=$1', [id]);
    for (const p of partidas) await db.query('INSERT INTO presupuesto_partidas (obra_id, categoria, concepto, importe) VALUES ($1,$2,$3,$4) ON CONFLICT (obra_id, categoria, concepto) DO UPDATE SET importe = presupuesto_partidas.importe + EXCLUDED.importe', [id, p.categoria, p.concepto, p.importe]);
    const total = partidas.reduce((s, p) => s + p.importe, 0);
    if (req.body.actualizar_presupuesto) await db.query('UPDATE obras SET presupuesto=$1 WHERE id=$2', [total, id]);
    await audit(db, { entidad: 'presupuesto', entidadId: id, obraId: id, accion: 'editar', detalle: `Presupuesto de costes: ${partidas.length} partidas, ${nes(total)} €`, usuarioId: req.user.id });
  });
  res.json({ ok: true, mensaje: 'Presupuesto guardado.' });
}));

r.post('/', requirePerm('costes.editar'), wrap(async (req, res) => {
  const b = req.body;
  const c = await one(`INSERT INTO costes (obra_id, fecha, categoria, concepto, proveedor, documento, importe, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [num(b.obra_id, 'obra', { int: true }), date(b.fecha, 'fecha') || hoy(), oneOf(b.categoria, 'categoría', CATS), str(b.concepto, 'concepto', { required: true, max: 300 }),
      str(b.proveedor, 'proveedor', { max: 200 }), str(b.documento, 'documento', { max: 60 }), num(b.importe, 'importe', { min: -1e9, max: 1e9 }), req.user.id]);
  await audit({ query: q }, { entidad: 'coste', entidadId: c.id, obraId: c.obra_id, accion: 'crear', detalle: `${CATEGORIAS_COSTE[c.categoria]}: ${c.concepto} (${c.importe} €)`, usuarioId: req.user.id });
  res.status(201).json(c);
}));

r.delete('/:id', requirePerm('costes.editar'), wrap(async (req, res) => {
  const c = await one('DELETE FROM costes WHERE id=$1 RETURNING *', [req.params.id]);
  if (!c) throw notFound();
  await audit({ query: q }, { entidad: 'coste', entidadId: c.id, obraId: c.obra_id, accion: 'eliminar', detalle: `${c.concepto} (${c.importe} €)`, datos: c, usuarioId: req.user.id });
  res.json({ ok: true });
}));

export default r;
