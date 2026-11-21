// Tareas automáticas: copias de seguridad diarias e informes programados
import zlib from 'node:zlib';
import { PassThrough } from 'node:stream';
import cron from 'node-cron';
import { q, many, one } from '../db.js';
import { storage } from '../storage.js';
import { config } from '../config.js';
import { CATALOGO } from './catalogo.js';
import { pdfInforme, xlsxInforme } from './exportar.js';
import { rango } from './informes.js';
import { hoy } from './produccion.js';

export async function crearBackup(usuarioId = null) {
  const tablas = (await many(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).map((t) => t.tablename);
  const datos = { version: 1, creado: new Date().toISOString(), tablas: {} };
  for (const t of tablas) datos.tablas[t] = (await q(`SELECT * FROM "${t}"`)).rows;
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(datos)));
  const nombre = `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json.gz`;
  const clave = `backups/${nombre}`;
  await storage.put(clave, buf, 'application/gzip');
  const a = await one(`INSERT INTO archivos (entidad, tipo, nombre, mime, tamano, clave, usuario_id) VALUES ('backup','backup',$1,'application/gzip',$2,$3,$4) RETURNING *`,
    [nombre, buf.length, clave, usuarioId]);
  // Rotación: conservar solo las N más recientes
  const viejos = await many(`SELECT * FROM archivos WHERE entidad='backup' ORDER BY creado_en DESC OFFSET $1`, [config.backups.keep]);
  for (const v of viejos) { await storage.remove(v.clave); await q('DELETE FROM archivos WHERE id=$1', [v.id]); }
  console.log(`[backup] ${nombre} (${Math.round(buf.length / 1024)} KB)`);
  return a;
}

const toBuffer = (fn) => new Promise((resolve, reject) => {
  const pt = new PassThrough(); const chunks = [];
  pt.on('data', (c) => chunks.push(c)); pt.on('end', () => resolve(Buffer.concat(chunks))); pt.on('error', reject);
  fn(pt);
});

export async function generarProgramado(prog, usuarioId = null) {
  const def = CATALOGO[prog.tipo];
  if (!def) throw new Error(`Tipo de informe desconocido: ${prog.tipo}`);
  const t = hoy(); const d = new Date(t + 'T12:00:00Z');
  const dias = { diaria: 1, semanal: 7, mensual: 30 }[prog.frecuencia];
  d.setUTCDate(d.getUTCDate() - (dias - 1));
  const inf = await def.generar(rango({ desde: d.toISOString().slice(0, 10), hasta: t, agrupar: prog.frecuencia === 'mensual' ? 'semana' : 'dia' }));
  const buf = prog.formato === 'xlsx' ? Buffer.from(await xlsxInforme(inf)) : await toBuffer((s) => pdfInforme(inf, s));
  const nombre = `${prog.nombre} ${t}.${prog.formato}`;
  const clave = `informes/${t}-${prog.id}-${Date.now()}.${prog.formato}`;
  const mime = prog.formato === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
  await storage.put(clave, buf, mime);
  const a = await one(`INSERT INTO archivos (entidad, entidad_id, tipo, nombre, mime, tamano, clave, usuario_id) VALUES ('informe',$1,'informe',$2,$3,$4,$5,$6) RETURNING id, nombre, mime, tamano, creado_en`,
    [prog.id, nombre, mime, buf.length, clave, usuarioId]);
  await q('UPDATE informes_programados SET ultimo_envio=now() WHERE id=$1', [prog.id]);
  return a;
}

async function informesDelDia() {
  const d = new Date(hoy() + 'T12:00:00Z');
  for (const p of await many('SELECT * FROM informes_programados WHERE activo')) {
    const toca = p.frecuencia === 'diaria' || (p.frecuencia === 'semanal' && d.getUTCDay() === 1) || (p.frecuencia === 'mensual' && d.getUTCDate() === 1);
    if (toca) await generarProgramado(p).catch((e) => console.error('[informes]', p.nombre, e.message));
  }
}

export function programarTareas() {
  if (config.backups.enabled) cron.schedule(config.backups.cron, () => crearBackup().catch((e) => console.error('[backup] error', e)), { timezone: config.timezone });
  cron.schedule(config.reportsCron, () => informesDelDia().catch((e) => console.error('[informes] error', e)), { timezone: config.timezone });
  console.log(`[tareas] copias: ${config.backups.enabled ? config.backups.cron : 'desactivadas'} · informes: ${config.reportsCron} (${config.timezone})`);
}
