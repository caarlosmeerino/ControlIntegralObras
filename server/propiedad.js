// Datos separados por usuario: cada proyecto, empleado y pieza propia pertenece a quien lo crea.
// Estas comprobaciones responden «no encontrado» si el dato es de otro usuario.
import { one, many } from './db.js';
import { notFound } from './http.js';

export async function obraPropia(req, id) {
  const o = await one('SELECT * FROM obras WHERE id=$1 AND propietario_id=$2', [Number(id) || 0, req.user.id]);
  if (!o) throw notFound('No se ha encontrado el proyecto.');
  return o;
}

export async function idsObrasPropias(req) {
  return (await many('SELECT id FROM obras WHERE propietario_id=$1', [req.user.id])).map((x) => x.id);
}

export async function etapaPropia(req, id) {
  const e = await one('SELECT e.* FROM etapas e JOIN obras o ON o.id=e.obra_id WHERE e.id=$1 AND o.propietario_id=$2', [Number(id) || 0, req.user.id]);
  if (!e) throw notFound('No se ha encontrado la fase.');
  return e;
}

export async function tareaPropia(req, id) {
  const t = await one(`SELECT t.* FROM etapa_tareas t JOIN etapas e ON e.id=t.etapa_id JOIN obras o ON o.id=e.obra_id
    WHERE t.id=$1 AND o.propietario_id=$2`, [Number(id) || 0, req.user.id]);
  if (!t) throw notFound('No se ha encontrado la tarea.');
  return t;
}

export async function piezaPropia(req, id) {
  const p = await one('SELECT p.* FROM piezas p JOIN obras o ON o.id=p.obra_id WHERE p.id=$1 AND o.propietario_id=$2', [Number(id) || 0, req.user.id]);
  if (!p) throw notFound('No se ha encontrado la pieza.');
  return p;
}

export async function trabajadorPropio(req, id) {
  const t = await one('SELECT * FROM trabajadores WHERE id=$1 AND propietario_id=$2', [Number(id) || 0, req.user.id]);
  if (!t) throw notFound('No se ha encontrado el empleado.');
  return t;
}

/** Al arrancar: los datos que no tengan dueño (anteriores a la separación o datos de ejemplo) pasan al primer administrador */
export async function asignarSinDueño(pool) {
  const { rows: [a] } = await pool.query("SELECT id FROM usuarios WHERE rol='admin' ORDER BY id LIMIT 1");
  if (!a) return;
  await pool.query('UPDATE obras SET propietario_id=$1 WHERE propietario_id IS NULL', [a.id]);
  await pool.query('UPDATE trabajadores SET propietario_id=$1 WHERE propietario_id IS NULL', [a.id]);
  await pool.query('UPDATE catalogo_piezas SET propietario_id=$1 WHERE personalizada AND propietario_id IS NULL', [a.id]);
}
