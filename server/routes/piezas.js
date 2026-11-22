import { nes } from '../http.js';
import { Router } from 'express';
import QRCode from 'qrcode';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { obraPropia, idsObrasPropias, etapaPropia, tareaPropia, piezaPropia, trabajadorPropio } from '../propiedad.js';
import { piezasConEstado, piezaConEstado, registrarAvance, completarHasta } from '../services/produccion.js';
import { config } from '../config.js';

const r = Router();

async function comprobarEtapa(etapaId, obraId) {
  if (!etapaId) return;
  const e = await one('SELECT obra_id FROM etapas WHERE id=$1', [etapaId]); // la obra ya se ha comprobado que es del usuario
  if (!e || e.obra_id !== Number(obraId)) throw bad('La fase elegida no pertenece a este proyecto.');
}
export const ELEMENTOS = ['pilar', 'viga', 'cercha', 'correa', 'arriostramiento', 'placa', 'escalera', 'barandilla', 'forjado', 'otro'];

function leer(b) {
  return {
    marca: str(b.marca, 'marca', { required: true, max: 40 }).toUpperCase(),
    elemento: ELEMENTOS.includes(String(b.elemento || '').toLowerCase()) ? String(b.elemento).toLowerCase() : 'otro',
    perfil: str(b.perfil, 'perfil', { max: 80 }),
    plano: str(b.plano, 'plano', { max: 80 }),
    peso_unitario_kg: num(b.peso_unitario_kg, 'peso unitario (kg)', { min: 0, max: 1e6 }),
    cantidad: num(b.cantidad, 'cantidad', { min: 1, max: 100000, int: true, def: 1 }),
    observaciones: str(b.observaciones, 'observaciones', { max: 5000 }),
    m2_unitario: num(b.m2_unitario, 'superficie por unidad (m²)', { min: 0, max: 1e6, def: 0 }),
    ml_unitario: num(b.ml_unitario, 'longitud por unidad (ml)', { min: 0, max: 1e6, def: 0 }),
    catalogo_id: b.catalogo_id ? num(b.catalogo_id, 'pieza del registro', { int: true }) : null,
    etapa_id: b.etapa_id ? num(b.etapa_id, 'fase', { int: true }) : null,
  };
}

r.get('/', requirePerm('piezas.ver'), wrap(async (req, res) => {
  const cond = ['o.propietario_id=$1']; const p = [req.user.id];
  if (req.query.obra_id) { p.push(Number(req.query.obra_id)); cond.push(`p.obra_id=$${p.length}`); }
  if (req.query.etapa_id) { p.push(Number(req.query.etapa_id)); cond.push(`p.etapa_id=$${p.length}`); }
  if (req.query.q) { p.push(`%${req.query.q}%`); cond.push(`(p.marca ILIKE $${p.length} OR p.plano ILIKE $${p.length} OR p.perfil ILIKE $${p.length} OR o.codigo ILIKE $${p.length})`); }
  if (req.query.activas === '1') cond.push(`o.estado IN ('planificada','en_curso','pausada')`);
  let piezas = await piezasConEstado({ query: q }, cond.join(' AND '), p);
  if (req.query.estado) piezas = piezas.filter((x) => x.estado === req.query.estado);
  if (req.query.fase_clave) piezas = piezas.filter((x) => x.fase_actual_clave === req.query.fase_clave);
  if (req.query.fase_id) piezas = piezas.filter((x) => x.fase_actual_id === Number(req.query.fase_id));
  if (req.query.ambito) piezas = piezas.filter((x) => x.fase_actual_ambito === req.query.ambito);
  if (req.query.elemento) piezas = piezas.filter((x) => x.elemento === req.query.elemento);
  res.json(piezas);
}));

r.post('/', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const obraId = num(req.body.obra_id, 'obra', { int: true });
  await obraPropia(req, obraId);
  const d = leer(req.body);
  await comprobarEtapa(d.etapa_id, obraId);
  const n = await one(
    `INSERT INTO piezas (obra_id, marca, elemento, perfil, plano, peso_unitario_kg, cantidad, observaciones, m2_unitario, ml_unitario, catalogo_id, etapa_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, marca`,
    [obraId, d.marca, d.elemento, d.perfil, d.plano, d.peso_unitario_kg, d.cantidad, d.observaciones, d.m2_unitario, d.ml_unitario, d.catalogo_id, d.etapa_id]);
  await audit({ query: q }, { entidad: 'pieza', entidadId: n.id, obraId, accion: 'crear', detalle: `Pieza ${n.marca}: ${d.cantidad} × ${d.peso_unitario_kg} kg`, usuarioId: req.user.id });
  res.status(201).json(await piezaConEstado({ query: q }, n.id));
}));

// Importación masiva desde texto CSV/Excel pegado (marca;elemento;perfil;plano;peso;cantidad;observaciones)
r.post('/importar', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const obraId = num(req.body.obra_id, 'obra', { int: true });
  await obraPropia(req, obraId);
  const texto = String(req.body.texto || '').trim();
  if (!texto) throw bad('Pega las filas de piezas que quieras importar.');
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = lineas[0].includes('\t') ? '\t' : lineas[0].includes(';') ? ';' : ',';
  const filas = lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  if (/marca/i.test(filas[0][0])) filas.shift();
  const errores = []; const datos = [];
  filas.forEach((f, i) => {
    try {
      datos.push(leer({ marca: f[0], elemento: f[1], perfil: f[2], plano: f[3], peso_unitario_kg: f[4], cantidad: f[5] || 1, m2_unitario: f[6], ml_unitario: f[7], observaciones: f[8] }));
    } catch (e) { errores.push(`Fila ${i + 1}: ${e.message}`); }
  });
  if (errores.length) throw bad('Hay filas con errores. No se ha importado nada.', { errores });
  const resultado = await tx(async (db) => {
    let creadas = 0, actualizadas = 0;
    for (const d of datos) {
      const { rows: [ex] } = await db.query('SELECT id FROM piezas WHERE obra_id=$1 AND marca=$2', [obraId, d.marca]);
      if (ex) {
        const { rows: [m] } = await db.query('SELECT COALESCE(MAX(cantidad),0) c FROM pieza_avance WHERE pieza_id=$1', [ex.id]);
        if (d.cantidad < m.c) throw bad(`La marca ${d.marca} ya tiene ${m.c} unidades con avance; no se puede bajar la cantidad a ${d.cantidad}.`);
        await db.query('UPDATE piezas SET elemento=$1, perfil=$2, plano=$3, peso_unitario_kg=$4, cantidad=$5, observaciones=$6, m2_unitario=$7, ml_unitario=$8, actualizado_en=now() WHERE id=$9',
          [d.elemento, d.perfil, d.plano, d.peso_unitario_kg, d.cantidad, d.observaciones, d.m2_unitario, d.ml_unitario, ex.id]);
        actualizadas++;
      } else {
        await db.query('INSERT INTO piezas (obra_id, marca, elemento, perfil, plano, peso_unitario_kg, cantidad, observaciones, m2_unitario, ml_unitario) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [obraId, d.marca, d.elemento, d.perfil, d.plano, d.peso_unitario_kg, d.cantidad, d.observaciones, d.m2_unitario, d.ml_unitario]);
        creadas++;
      }
    }
    const kg = datos.reduce((s, d) => s + d.peso_unitario_kg * d.cantidad, 0);
    await audit(db, { entidad: 'pieza', obraId, accion: 'importar', detalle: `Importación: ${creadas} nuevas, ${actualizadas} actualizadas (${Math.round(kg)} kg)`, usuarioId: req.user.id });
    return { creadas, actualizadas, kg };
  });
  res.json(resultado);
}));

r.get('/qr/:token', requirePerm('piezas.ver'), wrap(async (req, res) => {
  const p = await one('SELECT p.id FROM piezas p JOIN obras o ON o.id=p.obra_id WHERE p.qr_token=$1 AND o.propietario_id=$2', [req.params.token, req.user.id]);
  if (!p) throw notFound('Este código QR no corresponde a ninguna pieza.');
  res.json({ id: p.id });
}));

r.get('/:id', requirePerm('piezas.ver'), wrap(async (req, res) => {
  await piezaPropia(req, req.params.id);
  const p = await piezaConEstado({ query: q }, Number(req.params.id));
  const [movimientos, historial, archivos] = await Promise.all([
    many(`SELECT m.*, f.nombre AS fase, f.clave, u.nombre AS usuario, t.nombre AS trabajador FROM movimientos m
          JOIN obra_fases f ON f.id=m.obra_fase_id LEFT JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN trabajadores t ON t.id=m.trabajador_id
          WHERE m.pieza_id=$1 ORDER BY m.fecha DESC, m.id DESC`, [p.id]),
    many(`SELECT h.*, u.nombre AS usuario FROM historial h LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE h.entidad='pieza' AND h.entidad_id=$1 ORDER BY h.fecha DESC`, [p.id]),
    many(`SELECT a.*, u.nombre AS usuario FROM archivos a LEFT JOIN usuarios u ON u.id=a.usuario_id WHERE entidad='pieza' AND entidad_id=$1 ORDER BY creado_en DESC`, [p.id]),
  ]);
  res.json({ ...p, movimientos, historial, archivos });
}));

r.put('/:id', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await piezaPropia(req, id);
  const d = leer({ ...cur, ...req.body });
  await comprobarEtapa(d.etapa_id, cur.obra_id);
  const { c } = await one('SELECT COALESCE(MAX(cantidad),0) c FROM pieza_avance WHERE pieza_id=$1', [id]);
  if (d.cantidad < c) throw bad(`Ya hay ${c} unidades con avance registrado; la cantidad no puede ser menor.`);
  const extra = {
    fecha_fabricacion: req.body.fecha_fabricacion !== undefined ? date(req.body.fecha_fabricacion, 'fabricación') : cur.fecha_fabricacion,
    fecha_expedicion: req.body.fecha_expedicion !== undefined ? date(req.body.fecha_expedicion, 'expedición') : cur.fecha_expedicion,
    fecha_montaje: req.body.fecha_montaje !== undefined ? date(req.body.fecha_montaje, 'montaje') : cur.fecha_montaje,
    incidencia: req.body.incidencia !== undefined ? !!req.body.incidencia : cur.incidencia,
  };
  await q(`UPDATE piezas SET marca=$1, elemento=$2, perfil=$3, plano=$4, peso_unitario_kg=$5, cantidad=$6, observaciones=$7, m2_unitario=$8, ml_unitario=$9,
           catalogo_id=$10, fecha_fabricacion=$11, fecha_expedicion=$12, fecha_montaje=$13, incidencia=$14, etapa_id=$16, actualizado_en=now() WHERE id=$15`,
  [d.marca, d.elemento, d.perfil, d.plano, d.peso_unitario_kg, d.cantidad, d.observaciones, d.m2_unitario, d.ml_unitario, d.catalogo_id, ...Object.values(extra), id, d.etapa_id]);
  const todo = { ...d, ...extra };
  const cambios = Object.keys(todo).filter((k) => String(todo[k] ?? '') !== String(cur[k] ?? ''));
  if (cambios.length) await audit({ query: q }, { entidad: 'pieza', entidadId: id, obraId: cur.obra_id, accion: 'editar',
    detalle: `Pieza ${d.marca}: ${cambios.join(', ')}`, datos: Object.fromEntries(cambios.map((k) => [k, { antes: cur[k], despues: todo[k] }])), usuarioId: req.user.id });
  res.json(await piezaConEstado({ query: q }, id));
}));

r.delete('/:id', requirePerm('piezas.editar'), wrap(async (req, res) => {
  const p = await piezaPropia(req, req.params.id);
  const { n } = await one('SELECT COUNT(*)::int n FROM movimientos WHERE pieza_id=$1', [p.id]);
  if (n > 0 && req.user.rol !== 'admin') throw bad(`La pieza ${p.marca} tiene ${n} movimientos registrados. Solo un administrador puede eliminarla.`);
  await q('DELETE FROM piezas WHERE id=$1', [p.id]);
  await audit({ query: q }, { entidad: 'pieza', entidadId: p.id, obraId: p.obra_id, accion: 'eliminar', detalle: `Pieza ${p.marca} eliminada`, datos: p, usuarioId: req.user.id });
  res.json({ ok: true });
}));

// ---- Avances ----
r.post('/:id/avance', wrap(async (req, res) => {
  await piezaPropia(req, req.params.id);
  const b = req.body;
  const out = await tx((db) => registrarAvance(db, {
    piezaId: Number(req.params.id), faseId: b.fase_id || null,
    cantidad: b.cantidad === undefined || b.cantidad === null || b.cantidad === '' ? null : num(b.cantidad, 'cantidad', { int: true }),
    user: req.user, origen: ['web', 'qr', 'movil'].includes(b.origen) ? b.origen : 'web', nota: str(b.nota, 'nota', { max: 500 }),
    trabajadorId: b.trabajador_id ? Number(b.trabajador_id) : null,
  }));
  const pieza = await piezaConEstado({ query: q }, Number(req.params.id));
  const verbo = out.unidades > 0 ? 'completada' : 'corregida';
  res.json({ pieza, mensaje: `${pieza.marca}: «${out.fase.nombre}» ${verbo} (${Math.abs(out.unidades)} ud · ${nes(Math.abs(out.kg))} kg).` });
}));

// Avance en lote: varias piezas hasta una fase (o siguiente fase de cada una)
r.post('/lote/avance', wrap(async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  if (!ids.length) throw bad('Selecciona al menos una pieza.');
  if (ids.length > 500) throw bad('Máximo 500 piezas por operación.');
  for (const id of ids) await piezaPropia(req, id);
  const resultado = await tx(async (db) => {
    let kg = 0, movs = 0;
    for (const id of ids) {
      if (req.body.hasta_fase_id) {
        // la fase se indica por obra: { obraId: faseId } o un id único si todas son de la misma obra
        const { rows: [p] } = await db.query('SELECT obra_id FROM piezas WHERE id=$1', [id]);
        if (!p) continue;
        let faseId = req.body.hasta_fase_id;
        if (typeof faseId === 'object') faseId = faseId[p.obra_id];
        if (!faseId) continue;
        const rs = await completarHasta(db, { piezaId: id, faseId, user: req.user, origen: 'lote', nota: str(req.body.nota, 'nota') });
        rs.forEach((x) => { kg += x.kg; movs++; });
      } else {
        const x = await registrarAvance(db, { piezaId: id, user: req.user, origen: 'lote', nota: str(req.body.nota, 'nota') });
        kg += x.kg; movs++;
      }
    }
    return { kg, movs };
  });
  res.json({ ...resultado, mensaje: `Avance registrado en ${ids.length} pieza(s): ${resultado.movs} movimiento(s), ${nes(resultado.kg)} kg.` });
}));

// ---- QR ----
r.get('/:id/qr.svg', requirePerm('piezas.ver'), wrap(async (req, res) => {
  const p = await piezaPropia(req, req.params.id);
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  const svg = await QRCode.toString(`${base}/q/${p.qr_token}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').set('Cache-Control', 'private, max-age=86400').send(svg);
}));

r.get('/etiquetas/:obraId', requirePerm('piezas.ver'), wrap(async (req, res) => {
  await obraPropia(req, req.params.obraId);
  const ids = req.query.ids ? String(req.query.ids).split(',').map(Number) : null;
  const piezas = await many(
    `SELECT p.id, p.marca, p.elemento, p.perfil, p.plano, p.peso_unitario_kg, p.cantidad, p.qr_token, o.codigo, o.nombre AS obra
     FROM piezas p JOIN obras o ON o.id=p.obra_id WHERE p.obra_id=$1 ${ids ? 'AND p.id = ANY($2)' : ''} ORDER BY p.marca`,
    ids ? [req.params.obraId, ids] : [req.params.obraId]);
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  const out = [];
  for (const p of piezas) out.push({ ...p, svg: await QRCode.toString(`${base}/q/${p.qr_token}`, { type: 'svg', margin: 0 }) });
  res.json(out);
}));

export default r;
