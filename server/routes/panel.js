import { Router } from 'express';
import { many, q } from '../db.js';
import { wrap } from '../http.js';
import { requirePerm } from '../auth.js';
import { can } from '../permissions.js';
import { resumenObras, hoy } from '../services/produccion.js';
import { produccionPeriodo, rango } from '../services/informes.js';

const r = Router();
const r2 = (n) => Math.round(n * 100) / 100;

r.get('/panel', requirePerm('obras.ver'), wrap(async (req, res) => {
  const obras = (await resumenObras({ query: q })).filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado));
  const sum = (f) => r2(obras.reduce((s, o) => s + (f(o) || 0), 0));
  const t = hoy();
  const d14 = new Date(t + 'T12:00:00Z'); d14.setUTCDate(d14.getUTCDate() - 13);
  const serie = await produccionPeriodo({ desde: d14.toISOString().slice(0, 10), hasta: t, agrupar: 'dia', obraId: null });
  const deHoy = serie.find((s) => s.periodo === t) || {};
  const [ultimos, incidencias] = await Promise.all([
    many(`SELECT m.id, m.fecha, m.cantidad, m.kg, p.marca, p.id AS pieza_id, o.codigo, f.nombre AS fase, f.clave, u.nombre AS usuario
          FROM movimientos m JOIN piezas p ON p.id=m.pieza_id JOIN obras o ON o.id=m.obra_id JOIN obra_fases f ON f.id=m.obra_fase_id
          LEFT JOIN usuarios u ON u.id=m.usuario_id ORDER BY m.fecha DESC, m.id DESC LIMIT 8`),
    many(`SELECT p.id, p.marca, o.codigo, p.observaciones FROM piezas p JOIN obras o ON o.id=p.obra_id WHERE p.incidencia ORDER BY p.actualizado_en DESC LIMIT 10`),
  ]);
  const ocultarImportes = !can(req.user, 'costes.ver');
  res.json({
    hoy: t,
    kpis: {
      obras_activas: obras.length,
      obras_retrasadas: obras.filter((o) => o.resumen.retrasada).length,
      kg_unicos: sum((o) => o.resumen.kg_unicos),
      kg_previstos_fab: sum((o) => o.resumen.kg_previstos_fab || o.resumen.kg_unicos),
      kg_fabricados: sum((o) => o.resumen.kg_fabricados),
      kg_expedidos: sum((o) => o.resumen.toneladas.expedidas),
      kg_montados: sum((o) => o.resumen.kg_montados),
      kg_pendiente_fabricar: sum((o) => o.resumen.kg_pendiente_fabricar),
      kg_pendiente_montar: sum((o) => o.resumen.kg_pendiente_montar),
      hoy_cortados: deHoy.corte || 0, hoy_armados: deHoy.armado || 0, hoy_pintados: deHoy.pintura || 0, hoy_montados: deHoy.montaje || 0,
      hoy_acumulado: deHoy.total_acumulado || 0,
    },
    serie,
    obras: obras.map((o) => ({ id: o.id, codigo: o.codigo, nombre: o.nombre, cliente: o.cliente, estado: o.estado, fecha_entrega: o.fecha_entrega,
      presupuesto: ocultarImportes ? undefined : o.presupuesto,
      resumen: { ...o.resumen, fases: o.resumen.fases.map((f) => ({ id: f.id, orden: f.orden, clave: f.clave, nombre: f.nombre, porcentaje: f.porcentaje, estado: f.estado, kg_completados: f.kg_completados, kg_base: f.kg_base, kg_en_fase: f.kg_en_fase })) } })),
    ultimos, incidencias,
  });
}));

r.get('/produccion', requirePerm('obras.ver'), wrap(async (req, res) => {
  res.json(await produccionPeriodo(rango(req.query)));
}));

r.get('/buscar', requirePerm('obras.ver'), wrap(async (req, res) => {
  const t = String(req.query.q || '').trim();
  if (t.length < 1) return res.json({ obras: [], piezas: [] });
  const like = `%${t}%`;
  const [obras, piezas] = await Promise.all([
    many(`SELECT id, codigo, nombre, cliente, estado FROM obras WHERE codigo ILIKE $1 OR nombre ILIKE $1 OR cliente ILIKE $1 ORDER BY codigo LIMIT 8`, [like]),
    many(`SELECT p.id, p.marca, p.elemento, p.perfil, p.plano, p.cantidad, p.peso_unitario_kg, o.codigo AS obra_codigo
          FROM piezas p JOIN obras o ON o.id=p.obra_id WHERE p.marca ILIKE $1 OR p.plano ILIKE $1 OR p.perfil ILIKE $1 OR p.qr_token=$2
          ORDER BY (p.marca ILIKE $2) DESC, o.codigo, p.marca LIMIT 15`, [like, t]),
  ]);
  res.json({ obras, piezas });
}));

export default r;
