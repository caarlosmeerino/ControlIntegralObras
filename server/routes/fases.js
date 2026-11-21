import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';

const r = Router();

r.get('/plantilla', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await many('SELECT * FROM fases_plantilla ORDER BY orden'));
}));

r.get('/obra/:obraId', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await many(
    `SELECT f.*, (SELECT COUNT(*)::int FROM pieza_avance a WHERE a.obra_fase_id=f.id AND a.cantidad>0) AS piezas_con_avance
     FROM obra_fases f WHERE obra_id=$1 ORDER BY orden`, [req.params.obraId]));
}));

function leer(b, cur = {}) {
  const m = { ...cur, ...b };
  const f = {
    nombre: str(m.nombre, 'nombre', { required: true, max: 120 }),
    descripcion: str(m.descripcion, 'descripción', { max: 2000 }),
    ambito: oneOf(m.ambito, 'ámbito', ['oficina', 'taller', 'obra'], 'taller'),
    seccion: str(m.seccion, 'sección', { def: null }),
    indicador: str(m.indicador, 'indicador', { def: 'completadas', max: 60 }),
    peso_ponderacion: num(m.peso_ponderacion, 'ponderación', { min: 0, max: 100, def: 10 }),
    kg_previstos: m.kg_previstos === '' || m.kg_previstos == null ? null : num(m.kg_previstos, 'kg previstos', { min: 0 }),
    fecha_inicio_prevista: date(m.fecha_inicio_prevista, 'inicio previsto'),
    fecha_fin_prevista: date(m.fecha_fin_prevista, 'fin previsto'),
  };
  if (f.fecha_inicio_prevista && f.fecha_fin_prevista && f.fecha_fin_prevista < f.fecha_inicio_prevista) throw bad('El fin previsto no puede ser anterior al inicio.');
  return f;
}

// Añadir fase personalizada en una posición (por defecto al final)
r.post('/obra/:obraId', requirePerm('fases.editar'), wrap(async (req, res) => {
  const obraId = Number(req.params.obraId);
  const f = leer(req.body);
  const fase = await tx(async (db) => {
    const { rows: fases } = await db.query('SELECT * FROM obra_fases WHERE obra_id=$1 ORDER BY orden FOR UPDATE', [obraId]);
    const pos = Math.max(1, Math.min(num(req.body.posicion, 'posición', { int: true, def: fases.length + 1 }), fases.length + 1));
    // desplazar (en dos pasos para no chocar con UNIQUE(obra_id, orden))
    await db.query('UPDATE obra_fases SET orden = orden + 1000 WHERE obra_id=$1 AND orden >= $2', [obraId, pos]);
    await db.query('UPDATE obra_fases SET orden = orden - 999 WHERE obra_id=$1 AND orden >= 1000', [obraId]);
    const { rows: [n] } = await db.query(
      `INSERT INTO obra_fases (obra_id, orden, nombre, descripcion, ambito, seccion, indicador, peso_ponderacion, kg_previstos, fecha_inicio_prevista, fecha_fin_prevista)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [obraId, pos, f.nombre, f.descripcion, f.ambito, f.seccion, f.indicador, f.peso_ponderacion, f.kg_previstos, f.fecha_inicio_prevista, f.fecha_fin_prevista]);
    // Mantener la coherencia: las piezas que ya pasaron de esta posición se consideran completadas en la nueva fase
    const siguiente = fases.find((x) => x.orden === pos);
    if (siguiente) {
      await db.query(`INSERT INTO pieza_avance (pieza_id, obra_fase_id, cantidad) SELECT pieza_id, $1, cantidad FROM pieza_avance WHERE obra_fase_id=$2 AND cantidad>0`, [n.id, siguiente.id]);
    }
    await audit(db, { entidad: 'fase', entidadId: n.id, obraId, accion: 'crear', detalle: `Fase «${n.nombre}» añadida en la posición ${pos}`, usuarioId: req.user.id });
    return n;
  });
  res.status(201).json(fase);
}));

r.put('/:id', requirePerm('fases.editar'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM obra_fases WHERE id=$1', [req.params.id]);
  if (!cur) throw notFound('No se ha encontrado la fase.');
  const f = leer(req.body, cur);
  const n = await one(
    `UPDATE obra_fases SET nombre=$1, descripcion=$2, ambito=$3, seccion=$4, indicador=$5, peso_ponderacion=$6, kg_previstos=$7,
     fecha_inicio_prevista=$8, fecha_fin_prevista=$9 WHERE id=$10 RETURNING *`, [...Object.values(f), cur.id]);
  const cambios = Object.keys(f).filter((k) => String(f[k] ?? '') !== String(cur[k] ?? ''));
  if (cambios.length) await audit({ query: q }, { entidad: 'fase', entidadId: cur.id, obraId: cur.obra_id, accion: 'editar', detalle: `Fase «${n.nombre}»: ${cambios.join(', ')}`, usuarioId: req.user.id });
  res.json(n);
}));

// Reordenar: solo si ninguna pieza tiene avance (para no romper la secuencia)
r.put('/obra/:obraId/orden', requirePerm('fases.editar'), wrap(async (req, res) => {
  const obraId = Number(req.params.obraId);
  const ids = (req.body.ids || []).map(Number);
  await tx(async (db) => {
    const { rows: fases } = await db.query('SELECT id FROM obra_fases WHERE obra_id=$1', [obraId]);
    if (ids.length !== fases.length || !fases.every((f) => ids.includes(f.id))) throw bad('La lista de fases no coincide con las de la obra.');
    const { rows: [c] } = await db.query('SELECT COUNT(*)::int n FROM pieza_avance a JOIN obra_fases f ON f.id=a.obra_fase_id WHERE f.obra_id=$1 AND a.cantidad>0', [obraId]);
    if (c.n > 0) throw bad('No se pueden reordenar las fases porque ya hay piezas con avances registrados.');
    await db.query('UPDATE obra_fases SET orden = orden + 1000 WHERE obra_id=$1', [obraId]);
    for (let i = 0; i < ids.length; i++) await db.query('UPDATE obra_fases SET orden=$1 WHERE id=$2', [i + 1, ids[i]]);
    await audit(db, { entidad: 'fase', obraId, accion: 'reordenar', detalle: 'Orden de fases modificado', usuarioId: req.user.id });
  });
  res.json(await many('SELECT * FROM obra_fases WHERE obra_id=$1 ORDER BY orden', [obraId]));
}));

r.delete('/:id', requirePerm('fases.editar'), wrap(async (req, res) => {
  await tx(async (db) => {
    const { rows: [f] } = await db.query('SELECT * FROM obra_fases WHERE id=$1', [req.params.id]);
    if (!f) throw notFound('No se ha encontrado la fase.');
    const { rows: [c] } = await db.query('SELECT COUNT(*)::int n FROM movimientos WHERE obra_fase_id=$1', [f.id]);
    if (c.n > 0) throw bad(`No se puede eliminar «${f.nombre}» porque tiene ${c.n} movimiento(s) registrados.`);
    const { rows: [t] } = await db.query('SELECT COUNT(*)::int n FROM obra_fases WHERE obra_id=$1', [f.obra_id]);
    if (t.n <= 1) throw bad('La obra debe tener al menos una fase.');
    await db.query('DELETE FROM obra_fases WHERE id=$1', [f.id]);
    await db.query('UPDATE obra_fases SET orden = orden + 1000 WHERE obra_id=$1 AND orden > $2', [f.obra_id, f.orden]);
    await db.query('UPDATE obra_fases SET orden = orden - 1001 WHERE obra_id=$1 AND orden > 1000', [f.obra_id]);
    await audit(db, { entidad: 'fase', entidadId: f.id, obraId: f.obra_id, accion: 'eliminar', detalle: `Fase «${f.nombre}» eliminada`, usuarioId: req.user.id });
  });
  res.json({ ok: true });
}));

export default r;
