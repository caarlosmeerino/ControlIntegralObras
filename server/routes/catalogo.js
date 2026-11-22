// Registro de piezas: perfiles normalizados + piezas propias creadas por el usuario
import { Router } from 'express';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, num, str, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { CATALOGO } from '../data/catalogo.js';

const r = Router();

/** Carga el catálogo inicial si aún no existe (se ejecuta al arrancar) */
export async function sembrarCatalogo(pool) {
  const { rows: [c] } = await pool.query('SELECT COUNT(*)::int n FROM catalogo_piezas WHERE NOT personalizada');
  if (c.n >= CATALOGO.length) return;
  for (const p of CATALOGO) {
    await pool.query(`INSERT INTO catalogo_piezas (familia, designacion, unidad, peso, dimensiones, norma) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (familia, designacion) WHERE NOT personalizada DO NOTHING`, [p.familia, p.designacion, p.unidad, p.peso, p.dimensiones, p.norma]);
  }
  console.log(`[catálogo] ${CATALOGO.length} piezas de la metalurgia cargadas`);
}

// Número de piezas por tipo (para las fichas del registro)
r.get('/familias', requirePerm('piezas.ver'), wrap(async (req, res) => {
  const filas = await many("SELECT familia, COUNT(*)::int AS n FROM catalogo_piezas WHERE NOT personalizada GROUP BY familia");
  const { n } = await one('SELECT COUNT(*)::int AS n FROM catalogo_piezas WHERE personalizada AND propietario_id=$1', [req.user.id]);
  res.json([...filas, { familia: 'propia', n }]);
}));

r.get('/', requirePerm('piezas.ver'), wrap(async (req, res) => {
  const t = String(req.query.q || '').trim();
  const params = [req.user.id];
  const cond = ['(NOT personalizada OR propietario_id=$1)'];
  if (req.query.familia) { params.push(req.query.familia); cond.push(`familia = $${params.length}`); }
  if (t) {
    // «ipe300», «IPE 300», «tubo 100x100» → buscar sin espacios ni puntuación
    params.push(`%${t.toLowerCase().replace(/[^a-z0-9ñø]/g, '')}%`);
    cond.push(`regexp_replace(lower(designacion || familia), '[^a-z0-9ñø]', '', 'g') LIKE $${params.length}`);
  }
  if (req.query.propias === '1') cond.push('personalizada');
  res.json(await many(`SELECT * FROM catalogo_piezas WHERE ${cond.join(' AND ')}
    ORDER BY personalizada DESC, familia, peso, designacion LIMIT ${Math.min(Number(req.query.limite) || 400, 1000)}`, params));
}));

function leer(b) {
  return {
    familia: str(b.familia, 'tipo', { def: 'propia', max: 40 }),
    designacion: str(b.designacion, 'nombre de la pieza', { required: true, max: 120 }),
    unidad: oneOf(b.unidad, 'unidad', ['m', 'm2', 'ud'], 'ud'),
    peso: num(b.peso, 'peso', { min: 0, max: 1e6 }),
    dimensiones: str(b.dimensiones, 'dimensiones', { max: 200 }),
    norma: str(b.norma, 'norma', { max: 80 }),
  };
}

// Piezas propias (las normalizadas no se pueden cambiar)
r.post('/', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const p = leer(req.body);
  const ex = await one(`SELECT * FROM catalogo_piezas WHERE familia=$1 AND lower(designacion)=lower($2) AND (NOT personalizada OR propietario_id=$3)`, [p.familia, p.designacion, req.user.id]);
  if (ex) return res.json(ex);
  res.status(201).json(await one(`INSERT INTO catalogo_piezas (familia, designacion, unidad, peso, dimensiones, norma, personalizada, propietario_id)
    VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`, [p.familia, p.designacion, p.unidad, p.peso, p.dimensiones, p.norma, req.user.id]));
}));

r.put('/:id', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM catalogo_piezas WHERE id=$1 AND (NOT personalizada OR propietario_id=$2)', [req.params.id, req.user.id]);
  if (!cur) throw notFound('No se ha encontrado la pieza.');
  if (!cur.personalizada) throw bad('Las piezas normalizadas no se pueden modificar. Crea una pieza propia.');
  const p = leer({ ...cur, ...req.body });
  res.json(await one('UPDATE catalogo_piezas SET familia=$1, designacion=$2, unidad=$3, peso=$4, dimensiones=$5, norma=$6 WHERE id=$7 RETURNING *',
    [p.familia, p.designacion, p.unidad, p.peso, p.dimensiones, p.norma, cur.id]));
}));

r.delete('/:id', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM catalogo_piezas WHERE id=$1 AND (NOT personalizada OR propietario_id=$2)', [req.params.id, req.user.id]);
  if (!cur) throw notFound();
  if (!cur.personalizada) throw bad('Las piezas normalizadas no se pueden eliminar.');
  await q('DELETE FROM catalogo_piezas WHERE id=$1', [cur.id]);
  res.json({ ok: true });
}));

export default r;
