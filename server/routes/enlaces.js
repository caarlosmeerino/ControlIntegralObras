// Enlaces a planos y documentos guardados en iCloud Drive (o cualquier otra nube).
import { Router } from 'express';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, num, str, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';

const r = Router();

/** Comprueba que es un enlace web y propone un nombre si no se indica */
function leer(b) {
  const url = str(b.url, 'enlace', { required: true, max: 2000 });
  let u;
  try { u = new URL(url); } catch { throw bad('Eso no parece un enlace. Cópialo desde iCloud con «Compartir → Copiar enlace».'); }
  if (u.protocol !== 'https:') throw bad('El enlace debe empezar por https://');
  let nombre = str(b.nombre, 'nombre', { max: 200 });
  if (!nombre) {
    // Los enlaces de iCloud terminan en #Nombre_del_archivo
    const frag = decodeURIComponent(u.hash.replace(/^#/, '')).replace(/_/g, ' ').trim();
    nombre = frag || u.pathname.split('/').filter(Boolean).pop() || u.hostname;
  }
  return { tipo: oneOf(b.tipo, 'tipo', ['plano', 'documento'], 'documento'), nombre, url: u.toString() };
}

r.get('/', requirePerm('obras.ver'), wrap(async (req, res) => {
  const obraId = num(req.query.obra_id, 'obra', { int: true });
  res.json(await many(`SELECT e.*, u.nombre AS usuario FROM enlaces e LEFT JOIN usuarios u ON u.id=e.usuario_id
    WHERE e.obra_id=$1 AND ($2::text IS NULL OR e.tipo=$2) ORDER BY e.tipo, lower(e.nombre)`, [obraId, req.query.tipo || null]));
}));

r.post('/', requirePerm('archivos.subir'), wrap(async (req, res) => {
  const obraId = num(req.body.obra_id, 'obra', { int: true });
  const e = leer(req.body);
  const n = await one('INSERT INTO enlaces (obra_id, tipo, nombre, url, usuario_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [obraId, e.tipo, e.nombre, e.url, req.user.id]);
  await audit({ query: q }, { entidad: 'obra', entidadId: obraId, obraId, accion: 'enlazar', detalle: `${e.tipo === 'plano' ? 'Plano' : 'Documento'} enlazado: ${e.nombre}`, usuarioId: req.user.id });
  res.status(201).json(n);
}));

r.put('/:id', requirePerm('archivos.subir'), wrap(async (req, res) => {
  const cur = await one('SELECT * FROM enlaces WHERE id=$1', [req.params.id]);
  if (!cur) throw notFound('No se ha encontrado el enlace.');
  const e = leer({ ...cur, ...req.body });
  res.json(await one('UPDATE enlaces SET tipo=$1, nombre=$2, url=$3 WHERE id=$4 RETURNING *', [e.tipo, e.nombre, e.url, cur.id]));
}));

r.delete('/:id', requirePerm('archivos.subir'), wrap(async (req, res) => {
  const e = await one('SELECT * FROM enlaces WHERE id=$1', [req.params.id]);
  if (!e) throw notFound('No se ha encontrado el enlace.');
  await q('DELETE FROM enlaces WHERE id=$1', [e.id]);
  await audit({ query: q }, { entidad: 'obra', entidadId: e.obra_id, obraId: e.obra_id, accion: 'quitar_enlace', detalle: `Enlace quitado: ${e.nombre}`, usuarioId: req.user.id });
  res.json({ ok: true });
}));

export default r;
