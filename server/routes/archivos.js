import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, str } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { obraPropia, idsObrasPropias, etapaPropia, tareaPropia, piezaPropia, trabajadorPropio } from '../propiedad.js';
import { storage } from '../storage.js';
import { config } from '../config.js';
import { can } from '../permissions.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxFileMb * 1024 * 1024, files: 10 } });
const PERMITIDOS = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf|application\/(vnd\.openxmlformats|vnd\.ms-|msword|zip|x-zip|acad|dxf|x-dwg)|image\/vnd\.dwg|text\/(plain|csv)|application\/octet-stream)/;

async function obraDe(entidad, id) {
  if (entidad === 'obra') return id;
  if (entidad === 'pieza') return (await one('SELECT obra_id FROM piezas WHERE id=$1', [id]))?.obra_id;
  if (entidad === 'parte_montaje') return (await one('SELECT obra_id FROM partes_montaje WHERE id=$1', [id]))?.obra_id;
  return null;
}

r.get('/', requirePerm('obras.ver'), wrap(async (req, res) => {
  const { entidad, entidad_id, obra_id } = req.query;
  await obraPropia(req, obra_id || await obraDe(entidad, Number(entidad_id)));
  if (obra_id) {
    return res.json(await many(`SELECT a.*, u.nombre AS usuario, p.marca FROM archivos a LEFT JOIN usuarios u ON u.id=a.usuario_id
      LEFT JOIN piezas p ON a.entidad='pieza' AND p.id=a.entidad_id WHERE a.obra_id=$1 ORDER BY a.creado_en DESC`, [obra_id]));
  }
  res.json(await many(`SELECT a.*, u.nombre AS usuario FROM archivos a LEFT JOIN usuarios u ON u.id=a.usuario_id WHERE entidad=$1 AND entidad_id=$2 ORDER BY creado_en DESC`, [entidad, entidad_id]));
}));

r.post('/', requirePerm('archivos.subir'), upload.array('archivos', 10), wrap(async (req, res) => {
  const entidad = req.body.entidad; const entidadId = Number(req.body.entidad_id);
  if (!['obra', 'pieza', 'parte_montaje'].includes(entidad) || !entidadId) throw bad('Falta indicar a qué pertenece el archivo.');
  if (!req.files?.length) throw bad('No se ha recibido ningún archivo.');
  const obraId = await obraDe(entidad, entidadId);
  if (!obraId) throw notFound('No se ha encontrado el elemento al que adjuntar el archivo.');
  await obraPropia(req, obraId);
  const out = [];
  for (const f of req.files) {
    if (!PERMITIDOS.test(f.mimetype)) throw bad(`Tipo de archivo no admitido: ${f.originalname}`);
    const nombre = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const ext = path.extname(nombre).toLowerCase().slice(0, 8);
    const clave = `obras/${obraId}/${entidad}/${entidadId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await storage.put(clave, f.buffer, f.mimetype);
    const tipo = req.body.tipo && ['foto', 'plano', 'documento'].includes(req.body.tipo) ? req.body.tipo : f.mimetype.startsWith('image/') ? 'foto' : 'documento';
    out.push(await one(`INSERT INTO archivos (entidad, entidad_id, obra_id, tipo, nombre, mime, tamano, clave, descripcion, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [entidad, entidadId, obraId, tipo, nombre, f.mimetype, f.size, clave, str(req.body.descripcion, 'descripción', { max: 500 }), req.user.id]));
  }
  await audit({ query: q }, { entidad, entidadId, obraId, accion: 'adjuntar', detalle: `${out.length} archivo(s): ${out.map((a) => a.nombre).join(', ')}`, usuarioId: req.user.id });
  res.status(201).json({ archivos: out, mensaje: `${out.length} archivo(s) subido(s) correctamente.` });
}));

r.get('/:id/contenido', requirePerm('obras.ver'), wrap(async (req, res) => {
  const a = await one('SELECT * FROM archivos WHERE id=$1', [req.params.id]);
  if (!a) throw notFound('No se ha encontrado el archivo.');
  if (['backup', 'informe'].includes(a.entidad)) { if (!can(req.user, 'sistema.admin')) throw notFound(); } else await obraPropia(req, a.obra_id);
  const s = await storage.stream(a.clave).catch(() => null);
  if (!s) throw notFound('El archivo no está disponible en el almacenamiento.');
  res.set('Content-Type', a.mime);
  res.set('Cache-Control', 'private, max-age=604800');
  res.set('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nombre)}`);
  s.pipe(res);
}));

r.delete('/:id', requirePerm('archivos.subir'), wrap(async (req, res) => {
  const a = await one('SELECT * FROM archivos WHERE id=$1', [req.params.id]);
  if (!a) throw notFound();
  if (a.obra_id) await obraPropia(req, a.obra_id); else if (!can(req.user, 'sistema.admin')) throw notFound();
  if (a.usuario_id !== req.user.id && !can(req.user, 'obras.editar')) throw bad('Solo puedes borrar archivos que hayas subido tú.');
  await q('DELETE FROM archivos WHERE id=$1', [a.id]);
  await storage.remove(a.clave);
  await audit({ query: q }, { entidad: a.entidad, entidadId: a.entidad_id, obraId: a.obra_id, accion: 'eliminar_archivo', detalle: a.nombre, usuarioId: req.user.id });
  res.json({ ok: true });
}));

export default r;
