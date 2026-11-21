// Restaura una copia de seguridad (backup-*.json.gz) sobre la base de datos de DATABASE_URL.
//   npm run restaurar -- ruta/backup.json.gz --confirmar
// ATENCIÓN: sustituye los datos actuales de todas las tablas por los de la copia.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';

const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!file || !process.argv.includes('--confirmar')) {
  console.log('Uso: npm run restaurar -- backup.json.gz --confirmar   (sustituye los datos actuales)');
  process.exit(1);
}
const datos = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
await migrate({ log: () => {} });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query("SET session_replication_role = 'replica'"); // sin comprobación de claves ajenas durante la carga
  const tablas = Object.keys(datos.tablas).filter((t) => t !== 'schema_migrations');
  await c.query(`TRUNCATE ${tablas.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  for (const t of tablas) {
    for (const row of datos.tablas[t]) {
      const cols = Object.keys(row);
      const vals = cols.map((k) => (row[k] !== null && typeof row[k] === 'object' && !Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k]));
      await c.query(`INSERT INTO "${t}" (${cols.map((k) => `"${k}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, vals);
    }
    const { rows } = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_default LIKE 'nextval%'`, [t]);
    for (const r of rows) await c.query(`SELECT setval(pg_get_serial_sequence($1,$2), COALESCE((SELECT MAX("${r.column_name}") FROM "${t}"),0)+1, false)`, [t, r.column_name]);
    console.log(`· ${t}: ${datos.tablas[t].length} filas`);
  }
  await c.query("SET session_replication_role = 'origin'");
  await c.query('COMMIT');
  console.log(`Copia del ${datos.creado} restaurada.`);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('Error; no se ha cambiado nada:', e.message);
  process.exitCode = 1;
} finally { c.release(); await pool.end(); }
