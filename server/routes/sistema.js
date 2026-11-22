import { Router } from 'express';
import { many, one } from '../db.js';
import { wrap } from '../http.js';
import { requirePerm } from '../auth.js';
import { crearBackup } from '../services/tareas.js';
import { config } from '../config.js';
import { probarGoogle } from './direcciones.js';

const r = Router();
r.use(requirePerm('sistema.admin'));

r.get('/estado', wrap(async (req, res) => {
  const [db, backups, cuentas, google] = await Promise.all([
    one(`SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano, version() AS version`),
    many(`SELECT id, nombre, tamano, creado_en FROM archivos WHERE entidad='backup' ORDER BY creado_en DESC`),
    one(`SELECT (SELECT COUNT(*) FROM obras)::int obras, (SELECT COUNT(*) FROM piezas)::int piezas, (SELECT COUNT(*) FROM movimientos)::int movimientos,
                (SELECT COUNT(*) FROM archivos WHERE entidad NOT IN ('backup','informe'))::int archivos, (SELECT COUNT(*) FROM usuarios)::int usuarios`),
    probarGoogle(),
  ]);
  res.json({ google, db, backups, cuentas, almacenamiento: config.storage.driver, backup_cron: config.backups.enabled ? config.backups.cron : null, conservar: config.backups.keep });
}));

r.post('/backup', wrap(async (req, res) => {
  const a = await crearBackup(req.user.id);
  res.json({ backup: a, mensaje: 'Copia de seguridad creada correctamente.' });
}));

r.get('/historial', wrap(async (req, res) => {
  res.json(await many(`SELECT h.*, u.nombre AS usuario, o.codigo AS obra FROM historial h LEFT JOIN usuarios u ON u.id=h.usuario_id
    LEFT JOIN obras o ON o.id=h.obra_id ORDER BY h.fecha DESC LIMIT 300`));
}));

export default r;
