import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate({ log = console.log } = {}) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (nombre text PRIMARY KEY, aplicada_en timestamptz DEFAULT now())`);
  const done = new Set((await pool.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [f]);
      await c.query('COMMIT');
      log(`[migrate] aplicada ${f}`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`Error en migración ${f}: ${e.message}`);
    } finally {
      c.release();
    }
  }
  // Administrador inicial (solo si no hay ningún usuario)
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuarios');
  if (rows[0].n === 0) {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await pool.query(`INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1,$2,$3,'admin')`,
      [config.admin.username, hash, config.admin.nombre]);
    log(`[migrate] creado usuario administrador "${config.admin.username}"`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
