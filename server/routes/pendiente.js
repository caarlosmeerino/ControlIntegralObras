// Lo que queda por hacer: tareas de checklist, piezas por fabricar y material por recibir.
// Filtros: rango de fechas (semana), proyecto y empleado. Solo datos del usuario.
import { Router } from 'express';
import { many } from '../db.js';
import { wrap, date } from '../http.js';
import { requirePerm } from '../auth.js';
import { pdfPendiente, TITULOS } from '../services/pdfPendiente.js';

const r = Router();

async function cargar(req) {
  const desde = req.query.desde ? date(req.query.desde, 'desde') : null;
  const hasta = req.query.hasta ? date(req.query.hasta, 'hasta') : null;
  const p = [req.user.id];
  const cond = [`o.propietario_id=$1`, `o.estado IN ('planificada','en_curso','pausada')`];
  if (req.query.obra_id) { p.push(Number(req.query.obra_id)); cond.push(`o.id=$${p.length}`); }
  if (req.query.obra_ids) { p.push(String(req.query.obra_ids).split(',').map(Number).filter(Boolean)); cond.push(`o.id = ANY($${p.length})`); }
  if (req.query.empleado_id) { p.push(Number(req.query.empleado_id)); cond.push(`EXISTS (SELECT 1 FROM obra_empleados oe WHERE oe.obra_id=o.id AND oe.trabajador_id=$${p.length})`); }
  // Fases dentro del rango (o atrasadas sin terminar si el rango incluye hoy o el futuro)
  let rango = 'TRUE';
  if (desde && hasta) {
    p.push(desde, hasta);
    const d = `$${p.length - 1}`; const h = `$${p.length}`;
    rango = `((COALESCE(e.fecha_inicio, e.fecha_fin) <= ${h} AND COALESCE(e.fecha_fin, e.fecha_inicio) >= ${d})
      OR (e.fecha_fin < ${d} AND ${h}::date >= CURRENT_DATE))`;
  }

  const etapas = await many(`SELECT e.id, e.nombre, e.orden, e.fecha_inicio, e.fecha_fin, e.completada, o.id AS obra_id, o.nombre AS obra_nombre, o.cliente, o.codigo, o.direccion, o.ciudad
    FROM etapas e JOIN obras o ON o.id=e.obra_id
    WHERE ${cond.join(' AND ')} AND NOT e.completada AND ${rango}
    ORDER BY o.nombre, e.orden`, p);
  const tareas = etapas.length ? await many('SELECT id, etapa_id, texto FROM etapa_tareas WHERE etapa_id = ANY($1) AND NOT hecha ORDER BY orden, id', [etapas.map((e) => e.id)]) : [];

  // Piezas: con fecha → las de fases del rango; sin fecha → todas las pendientes
  const condPiezas = desde && hasta ? `p.etapa_id IS NOT NULL AND ${rango}` : 'TRUE';
  const piezas = await many(`SELECT p.id, p.marca, p.cantidad, p.perfil, p.peso_unitario_kg, (p.peso_unitario_kg * p.cantidad)::float AS kg, p.ml_unitario, p.m2_unitario,
      p.material_recibido, p.fecha_fabricacion, p.fecha_expedicion, p.fecha_montaje,
      o.id AS obra_id, o.nombre AS obra_nombre, o.cliente, o.codigo, o.direccion, o.ciudad, e.id AS etapa_id, e.nombre AS etapa_nombre, e.fecha_inicio, e.fecha_fin,
      cp.designacion AS catalogo_nombre, cp.familia
    FROM piezas p JOIN obras o ON o.id=p.obra_id LEFT JOIN etapas e ON e.id=p.etapa_id LEFT JOIN catalogo_piezas cp ON cp.id=p.catalogo_id
    WHERE ${cond.join(' AND ')} AND p.fecha_montaje IS NULL AND ${condPiezas}
    ORDER BY o.nombre, e.orden NULLS LAST, p.marca`, p);

  return {
    etapas: etapas.map((e) => ({ ...e, pendientes: tareas.filter((t) => t.etapa_id === e.id) })),
    piezas,
  };
}

r.get('/', requirePerm('obras.ver'), wrap(async (req, res) => res.json(await cargar(req))));

// PDF para el taller / la obra: una o varias listas (tareas, material, fabricar, montar), agrupadas por obra
r.get('/pdf', requirePerm('obras.ver'), wrap(async (req, res) => {
  const tipos = String(req.query.tipos || req.query.ver || 'fabricar').split(',').filter((t) => TITULOS[t]);
  if (!tipos.length) tipos.push('fabricar');
  const { etapas, piezas } = await cargar(req);
  const secciones = tipos.map((tipo) => {
    const lista = tipo === 'material' ? piezas.filter((p) => !p.material_recibido && !p.fecha_fabricacion)
      : tipo === 'fabricar' ? piezas.filter((p) => !p.fecha_fabricacion)
        : tipo === 'montar' ? piezas.filter((p) => p.fecha_fabricacion && !p.fecha_montaje) : etapas;
    const grupos = [];
    for (const x of lista) {
      let g = grupos.find((y) => y.obra.id === x.obra_id);
      if (!g) grupos.push(g = { obra: { id: x.obra_id, nombre: x.obra_nombre, cliente: x.cliente, codigo: x.codigo, direccion: x.direccion, ciudad: x.ciudad }, piezas: [], etapas: [], limite: null });
      (tipo === 'tareas' ? g.etapas : g.piezas).push(x);
      const fin = x.fecha_fin ? String(x.fecha_fin).slice(0, 10) : null;
      if (fin && (!g.limite || fin < g.limite)) g.limite = fin;
    }
    return { tipo, grupos };
  });
  const limpio = (v) => String(v || '').replace(/[\r\n]/g, ' ').slice(0, 160);
  const filtros = [];
  const nombresObras = [...new Map([...etapas, ...piezas].map((x) => [x.obra_id, x.obra_nombre])).values()];
  if ((req.query.obra_id || req.query.obra_ids) && nombresObras.length) filtros.push([nombresObras.length === 1 ? 'Obra' : 'Obras', nombresObras.join(', ')]);
  if (req.query.empleado_nombre) filtros.push(['Empleado', limpio(req.query.empleado_nombre)]);
  const periodo = limpio(req.query.periodo) || 'Todo lo pendiente';
  const generado = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date());
  const titulo = tipos.length === 1 ? TITULOS[tipos[0]] : 'Pendiente de obra';
  const nombre = `${titulo} - ${periodo}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename="${nombre}.pdf"`);
  pdfPendiente(res, { secciones, periodo, filtros, generado });
}));

export default r;
