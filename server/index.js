import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { rellenarProvincias } from './municipios.js';
import { loadUser, requireAuth } from './auth.js';
import { errorHandler } from './http.js';
import { programarTareas } from './services/tareas.js';
import authR from './routes/auth.js';
import usuariosR from './routes/usuarios.js';
import obrasR from './routes/obras.js';
import fasesR from './routes/fases.js';
import piezasR from './routes/piezas.js';
import panelR from './routes/panel.js';
import personalR from './routes/personal.js';
import montajeR from './routes/montaje.js';
import archivosR from './routes/archivos.js';
import costesR from './routes/costes.js';
import informesR from './routes/informes.js';
import sistemaR from './routes/sistema.js';
import direccionesR from './routes/direcciones.js';
import enlacesR from './routes/enlaces.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], connectSrc: ["'self'"], workerSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/salud', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api/auth', authR);
app.use('/api', requireAuth);
app.use('/api/usuarios', usuariosR);
app.use('/api/obras', obrasR);
app.use('/api/fases', fasesR);
app.use('/api/piezas', piezasR);
app.use('/api/personal', personalR);
app.use('/api/montaje', montajeR);
app.use('/api/archivos', archivosR);
app.use('/api/costes', costesR);
app.use('/api/informes', informesR);
app.use('/api/sistema', sistemaR);
app.use('/api/direcciones', direccionesR);
app.use('/api/enlaces', enlacesR);
app.use('/api', panelR);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(errorHandler);

// Interfaz (compilada con Vite en /dist)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders: (res, p) => {
      if (p.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
      else res.set('Cache-Control', 'no-cache');
    },
  }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

const start = async () => {
  await migrate();
  await rellenarProvincias(pool).catch((e) => console.warn('[municipios]', e.message));
  if (process.env.SEED_DEMO === 'true') {
    // Datos de ejemplo bajo demanda (solo añade; si ya existen no hace nada)
    const { sembrar } = await import('../scripts/seed.js');
    await sembrar({ log: (m) => console.log('[demo]', m) }).catch((e) => console.error('[demo] no se pudieron cargar:', e.message));
  }
  programarTareas();
  app.listen(config.port, () => console.log(`[servidor] escuchando en el puerto ${config.port}`));
};
start().catch((e) => { console.error('[servidor] no se pudo arrancar:', e); process.exit(1); });

export default app;
