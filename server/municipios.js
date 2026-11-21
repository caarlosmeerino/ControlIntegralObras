// Listado oficial de municipios de España (INE). Se usa para comprobar que la
// ciudad de una obra existe y para guardar su nombre oficial y su provincia.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bad } from './http.js';

const archivo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'municipios.json');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();

let indice = null;
function cargar() {
  if (indice) return indice;
  const d = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  indice = new Map();
  for (const [nombre, p, alias] of d.municipios) {
    const item = { ciudad: nombre, provincia: d.provincias[p][0] };
    for (const clave of [nombre, alias].filter(Boolean)) {
      const k = norm(clave);
      (indice.get(k) || indice.set(k, []).get(k)).push(item);
    }
  }
  return indice;
}

/** Devuelve { ciudad, provincia } oficiales o lanza un error claro si no existe. Vacío = sin ciudad. */
export function resolverCiudad(ciudad, provincia = '') {
  if (!ciudad || !String(ciudad).trim()) return { ciudad: '', provincia: '' };
  const hits = cargar().get(norm(ciudad)) || [];
  if (!hits.length) throw bad(`No encuentro el municipio «${String(ciudad).trim()}». Elígelo de la lista de ciudades.`);
  const p = norm(provincia);
  const hit = (p && hits.find((h) => norm(h.provincia) === p)) || hits[0];
  return { ciudad: hit.ciudad, provincia: hit.provincia };
}

/** Completa la provincia de obras antiguas que solo tienen ciudad */
export async function rellenarProvincias(pool) {
  const { rows } = await pool.query("SELECT id, ciudad FROM obras WHERE ciudad <> '' AND provincia = ''");
  for (const r of rows) {
    try { const x = resolverCiudad(r.ciudad); await pool.query('UPDATE obras SET ciudad=$1, provincia=$2 WHERE id=$3', [x.ciudad, x.provincia, r.id]); } catch { /* ciudad no oficial: se deja */ }
  }
}
