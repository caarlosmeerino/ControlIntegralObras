import { Router } from 'express';
import { many, q } from '../db.js';
import { wrap, notFound, forbidden } from '../http.js';
import { requirePerm } from '../auth.js';
import { can } from '../permissions.js';
import { CATALOGO } from '../services/catalogo.js';
import { pdfInforme, xlsxInforme } from '../services/exportar.js';
import * as I from '../services/informes.js';
import { generarProgramado } from '../services/tareas.js';

const r = Router();

r.get('/catalogo', requirePerm('informes.ver', 'costes.ver'), (req, res) => {
  res.json(Object.entries(CATALOGO).filter(([, c]) => can(req.user, c.permiso)).map(([k, c]) => ({ clave: k, nombre: c.nombre })));
});

// Rendimientos (pantalla "Toneladas y rendimientos")
r.get('/rendimientos', requirePerm('informes.ver', 'personal.ver'), wrap(async (req, res) => {
  const p = I.rango(req.query);
  const [trabajadores, equipos, secciones, serie, produccion] = await Promise.all([
    I.rendimientoTrabajadores(p), I.rendimientoEquipos(p), I.rendimientoSecciones(p), I.rendimientoSerie(p), I.produccionPeriodo(p),
  ]);
  const ocultar = !can(req.user, 'costes.ver');
  const limpia = (a) => (ocultar ? a.map(({ coste, coste_tonelada, coste_hora, ...x }) => x) : a);
  res.json({ rango: p, trabajadores: limpia(trabajadores), equipos: limpia(equipos), secciones: limpia(secciones), serie: limpia(serie), produccion });
}));

r.get('/programados', requirePerm('informes.ver'), wrap(async (req, res) => {
  const [programados, generados] = await Promise.all([
    many('SELECT * FROM informes_programados ORDER BY id'),
    many("SELECT id, nombre, mime, tamano, creado_en FROM archivos WHERE entidad='informe' ORDER BY creado_en DESC LIMIT 30"),
  ]);
  res.json({ programados, generados });
}));

r.put('/programados/:id', requirePerm('informes.ver'), wrap(async (req, res) => {
  const row = (await q('UPDATE informes_programados SET activo=$1 WHERE id=$2 RETURNING *', [!!req.body.activo, req.params.id])).rows[0];
  if (!row) throw notFound(); res.json(row);
}));

r.post('/programados/:id/generar', requirePerm('informes.ver'), wrap(async (req, res) => {
  const row = (await q('SELECT * FROM informes_programados WHERE id=$1', [req.params.id])).rows[0];
  if (!row) throw notFound();
  const a = await generarProgramado(row, req.user.id);
  res.json({ archivo: a, mensaje: `Informe «${row.nombre}» generado.` });
}));

r.get('/:tipo', wrap(async (req, res) => {
  const def = CATALOGO[req.params.tipo];
  if (!def) throw notFound('Informe no disponible.');
  if (!can(req.user, def.permiso)) throw forbidden();
  const inf = await def.generar(I.rango(req.query));
  const nombre = `${req.params.tipo}-${new Date().toISOString().slice(0, 10)}`;
  if (req.query.formato === 'pdf') {
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    return pdfInforme(inf, res);
  }
  if (req.query.formato === 'xlsx') {
    const buf = await xlsxInforme(inf);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  res.json(inf);
}));

export default r;
