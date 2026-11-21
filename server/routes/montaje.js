import { nes } from '../http.js';
import { Router } from 'express';
import { many, one, q, tx } from '../db.js';
import { wrap, bad, notFound, num, str, date } from '../http.js';
import { requirePerm } from '../auth.js';
import { audit } from '../audit.js';
import { registrarAvance, fasesDeObra, hoy, piezasConEstado } from '../services/produccion.js';
import { comparativaFabMontaje } from '../services/informes.js';

const r = Router();

r.get('/partes', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await many(
    `SELECT pm.*, o.codigo AS obra_codigo, o.nombre AS obra_nombre, u.nombre AS encargado,
       (SELECT COUNT(DISTINCT trabajador_id)::int FROM partes_horas h WHERE h.parte_montaje_id=pm.id) AS personas,
       (SELECT COALESCE(string_agg(md.nombre, ', '),'') FROM parte_montaje_medios x JOIN medios md ON md.id=x.medio_id WHERE x.parte_id=pm.id) AS medios,
       (SELECT COUNT(*)::int FROM archivos a WHERE a.entidad='parte_montaje' AND a.entidad_id=pm.id) AS fotos
     FROM partes_montaje pm JOIN obras o ON o.id=pm.obra_id LEFT JOIN usuarios u ON u.id=pm.encargado_id
     WHERE ($1::int IS NULL OR pm.obra_id=$1) ORDER BY pm.fecha DESC, pm.id DESC LIMIT 200`, [req.query.obra_id ? Number(req.query.obra_id) : null]));
}));

r.get('/partes/:id', requirePerm('obras.ver'), wrap(async (req, res) => {
  const p = await one(`SELECT pm.*, o.codigo AS obra_codigo, o.nombre AS obra_nombre, u.nombre AS encargado FROM partes_montaje pm
    JOIN obras o ON o.id=pm.obra_id LEFT JOIN usuarios u ON u.id=pm.encargado_id WHERE pm.id=$1`, [req.params.id]);
  if (!p) throw notFound('No se ha encontrado el parte.');
  const [movimientos, horas, medios, fotos] = await Promise.all([
    many(`SELECT m.*, pz.marca, f.nombre AS fase, f.clave FROM movimientos m JOIN piezas pz ON pz.id=m.pieza_id JOIN obra_fases f ON f.id=m.obra_fase_id WHERE m.parte_montaje_id=$1 ORDER BY f.orden, pz.marca`, [p.id]),
    many(`SELECT h.*, t.nombre AS trabajador FROM partes_horas h JOIN trabajadores t ON t.id=h.trabajador_id WHERE h.parte_montaje_id=$1 ORDER BY t.nombre`, [p.id]),
    many(`SELECT x.*, md.nombre, md.tipo FROM parte_montaje_medios x JOIN medios md ON md.id=x.medio_id WHERE x.parte_id=$1`, [p.id]),
    many(`SELECT * FROM archivos WHERE entidad='parte_montaje' AND entidad_id=$1 ORDER BY creado_en`, [p.id]),
  ]);
  res.json({ ...p, movimientos, horas, medios, fotos });
}));

/**
 * Parte diario de montaje. En una sola operación:
 *  - recibidas: completa la fase de expedición/recepción de esas piezas
 *  - montadas : completa la fase de montaje
 *  - horas por trabajador, medios de elevación, incidencias
 */
r.post('/partes', requirePerm('partes.montaje'), wrap(async (req, res) => {
  const b = req.body;
  const obraId = num(b.obra_id, 'obra', { int: true });
  const fecha = date(b.fecha, 'fecha') || hoy();
  if (fecha > hoy()) throw bad('La fecha del parte no puede ser futura.');
  const parte = await tx(async (db) => {
    const fases = await fasesDeObra(db, obraId);
    if (!fases.length) throw notFound('No se ha encontrado la obra.');
    const fRecep = fases.find((f) => f.clave === 'expedicion') || [...fases].reverse().find((f) => f.ambito !== 'obra');
    const fMont = fases.find((f) => f.clave === 'montaje') || fases.find((f) => f.ambito === 'obra');
    const { rows: [p] } = await db.query(
      `INSERT INTO partes_montaje (obra_id, fecha, encargado_id, piezas_descargadas, clima, incidencias, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [obraId, fecha, req.user.id, num(b.piezas_descargadas, 'piezas descargadas', { min: 0, int: true, def: 0 }),
        str(b.clima, 'clima', { max: 60 }), str(b.incidencias, 'incidencias', { max: 5000 }), str(b.observaciones, 'observaciones', { max: 5000 })]);
    const ts = `${fecha}T${new Date().toISOString().slice(11, 19)}Z`;
    let recib = 0, kgRecib = 0, mont = 0, kgMont = 0;
    for (const x of b.recibidas || []) {
      const rr = await registrarAvance(db, { piezaId: Number(x.pieza_id), faseId: fRecep.id, cantidad: x.cantidad ? Number(x.cantidad) : null,
        user: req.user, origen: 'parte_montaje', nota: 'Recibida en obra', parteMontajeId: p.id, fecha: fecha === hoy() ? null : ts, checkPerm: false });
      recib += rr.unidades; kgRecib += rr.kg;
    }
    for (const x of b.montadas || []) {
      const rr = await registrarAvance(db, { piezaId: Number(x.pieza_id), faseId: fMont.id, cantidad: x.cantidad ? Number(x.cantidad) : null,
        user: req.user, origen: 'parte_montaje', nota: 'Montada', parteMontajeId: p.id, fecha: fecha === hoy() ? null : ts });
      mont += rr.unidades; kgMont += rr.kg;
    }
    let horasTot = 0;
    for (const h of b.horas || []) {
      if (!h.horas) continue;
      const { rows: [t] } = await db.query('SELECT * FROM trabajadores WHERE id=$1', [h.trabajador_id]);
      if (!t) continue;
      const hh = num(h.horas, 'horas', { min: 0.25, max: 24 });
      horasTot += hh;
      await db.query(`INSERT INTO partes_horas (fecha, trabajador_id, obra_id, seccion, horas, operacion, parte_montaje_id, coste, usuario_id) VALUES ($1,$2,$3,'montaje',$4,'Montaje en obra',$5,$6,$7)`,
        [fecha, t.id, obraId, hh, p.id, Math.round(hh * Number(t.coste_hora) * 100) / 100, req.user.id]);
    }
    for (const m of b.medios || []) {
      if (!m.medio_id) continue;
      await db.query('INSERT INTO parte_montaje_medios (parte_id, medio_id, horas) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [p.id, m.medio_id, num(m.horas, 'horas de medio', { min: 0, max: 24, def: 0 })]);
    }
    // Si no se seleccionan piezas, se admiten cifras manuales
    if (!(b.recibidas || []).length) { recib = num(b.piezas_recibidas, 'piezas recibidas', { min: 0, int: true, def: 0 }); kgRecib = num(b.kg_recibidos, 'kg recibidos', { min: 0, def: 0 }); }
    if (!(b.montadas || []).length) { mont = num(b.piezas_montadas, 'piezas montadas', { min: 0, int: true, def: 0 }); kgMont = num(b.kg_montados, 'kg montados', { min: 0, def: 0 }); }
    const { rows: [upd] } = await db.query(
      'UPDATE partes_montaje SET piezas_recibidas=$1, kg_recibidos=$2, piezas_montadas=$3, kg_montados=$4, horas_totales=$5 WHERE id=$6 RETURNING *',
      [recib, kgRecib, mont, kgMont, horasTot, p.id]);
    await audit(db, { entidad: 'parte_montaje', entidadId: p.id, obraId, accion: 'crear',
      detalle: `Parte de montaje ${fecha}: ${mont} ud montadas (${kgMont} kg), ${recib} recibidas, ${horasTot} h`, usuarioId: req.user.id });
    return upd;
  });
  res.status(201).json({ parte, mensaje: `Parte guardado: ${parte.piezas_montadas} pieza(s) montada(s), ${nes(parte.kg_montados / 1000)} t.` });
}));

r.put('/partes/:id', requirePerm('partes.montaje'), wrap(async (req, res) => {
  const p = await one('UPDATE partes_montaje SET incidencias=$1, observaciones=$2, clima=$3, piezas_descargadas=$4 WHERE id=$5 RETURNING *',
    [str(req.body.incidencias, 'incidencias', { max: 5000 }), str(req.body.observaciones, 'observaciones', { max: 5000 }), str(req.body.clima, 'clima'),
      num(req.body.piezas_descargadas, 'piezas descargadas', { min: 0, int: true, def: 0 }), req.params.id]);
  if (!p) throw notFound();
  res.json(p);
}));

r.get('/resumen', requirePerm('obras.ver'), wrap(async (req, res) => res.json(await comparativaFabMontaje())));

// Fabricado frente a montado, pieza a pieza
r.get('/comparativa/:obraId', requirePerm('obras.ver'), wrap(async (req, res) => {
  const piezas = await piezasConEstado({ query: q }, 'p.obra_id=$1', [Number(req.params.obraId)]);
  const out = piezas.map((p) => {
    const g = (c) => p.avance.find((a) => a.clave === c)?.completadas ?? 0;
    const fab = g('calidad') || g('armado');
    return { id: p.id, marca: p.marca, elemento: p.elemento, cantidad: p.cantidad, peso_unitario_kg: p.peso_unitario_kg,
      fabricadas: fab, expedidas: g('expedicion'), montadas: g('montaje'),
      kg_fabricados: fab * p.peso_unitario_kg, kg_expedidos: g('expedicion') * p.peso_unitario_kg, kg_montados: g('montaje') * p.peso_unitario_kg,
      fase_actual_nombre: p.fase_actual_nombre, estado: p.estado };
  });
  res.json(out);
}));

export default r;
