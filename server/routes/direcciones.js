// Buscador de direcciones: Google Maps (Places API) si hay GOOGLE_MAPS_API_KEY;
// si no, CartoCiudad (Instituto Geográfico Nacional).
// El servidor hace de intermediario: el navegador solo habla con la propia app.
import { Router } from 'express';
import { wrap, bad, HttpError } from '../http.js';
import { porCodigo, resolverCiudad } from '../municipios.js';

const r = Router();
const BASE = 'https://www.cartociudad.es/geocoder/api/geocoder';
const cache = new Map(); // caché pequeña en memoria para no repetir consultas
const PEQ = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'en']);
const ROMANO = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xx)$/i;

/** «CALLE ALFONSO I» → «Calle Alfonso I» */
function tituloEs(s) {
  return String(s || '').toLowerCase().split(/(\s+|-|\/|\(|\))/).map((w, i) => {
    if (!w.trim() || /^[\s\-/()]$/.test(w)) return w;
    if (ROMANO.test(w) || /^[a-zñ]$/.test(w) && !PEQ.has(w)) return w.toUpperCase();
    if (i > 0 && PEQ.has(w)) return w;
    // d'Alfons, l'Hospitalet
    const m = w.match(/^([dl])["'](.+)$/);
    if (m) return `${m[1]}'${m[2].charAt(0).toUpperCase()}${m[2].slice(1)}`;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('').replace(/"/g, "'");
}

async function pedir(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(`${BASE}${ruta}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`CartoCiudad ${res.status}`);
    const data = await res.json();
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(ruta, data);
    return data;
  } catch {
    throw new HttpError(503, 'El buscador de direcciones no responde ahora mismo. Puedes escribir la dirección a mano.');
  } finally { clearTimeout(t); }
}

function convertir(c) {
  const muni = porCodigo(c.muniCode) || (() => { try { return resolverCiudad(c.muni, c.province); } catch { return null; } })();
  const tipo = String(c.type || '').toLowerCase();
  let calle = '';
  if (tipo === 'portal' || tipo === 'callejero' || tipo === 'carretera') {
    calle = String(c.address || '').split(',')[0];
    if (tipo === 'portal' && c.portalNumber != null) calle = calle.replace(new RegExp(`\\s+${c.portalNumber}(\\s+${String(c.extension || '').replace(/[^\w]/g, '')})?$`), '');
    calle = tituloEs(calle) + (tipo === 'portal' && c.portalNumber != null ? `, ${c.portalNumber}${c.extension ? ` ${c.extension}` : ''}` : '');
    if (c.poblacion && muni && c.poblacion !== muni.ciudad && c.poblacion !== c.muni) calle += `, ${c.poblacion}`;
  } else if (tipo === 'poblacion' && c.poblacion && c.poblacion !== c.muni) {
    calle = c.poblacion;
  } else if (tipo === 'toponimo') {
    // Empresas, naves y lugares: «NOMBRE [DIRECCIÓN], Municipio»
    const dentro = String(c.address || '').match(/\[([^\]]+)\]/);
    calle = tituloEs(dentro ? dentro[1] : String(c.address || '').split(',')[0]);
  }
  const tieneCoord = Number(c.lat) !== 0 && Number(c.lng) !== 0 && c.lat != null;
  return {
    id: c.id, tipo, portal: c.portalNumber ?? null,
    direccion: calle,
    texto: tipo === 'toponimo' ? tituloEs(String(c.address || '').split('[')[0].trim()) : (tituloEs(String(c.address || '').split(',')[0]) || c.muni),
    ciudad: muni?.ciudad || c.muni || '', provincia: muni?.provincia || '',
    codigo_postal: c.postalCode || '',
    lat: tieneCoord ? Number(c.lat) : null, lng: tieneCoord ? Number(c.lng) : null,
    ref_catastral: c.refCatastral || '',
  };
}

// ---------- Google Maps (Places API) ----------
// Si existe GOOGLE_MAPS_API_KEY, las sugerencias salen de Google Maps.
const GKEY = process.env.GOOGLE_MAPS_API_KEY || '';
export const usaGoogle = () => !!GKEY;

async function google(ruta, { body, campos, sesion } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const url = `https://places.googleapis.com/v1/${ruta}${!body && sesion ? `${ruta.includes('?') ? '&' : '?'}sessionToken=${encodeURIComponent(sesion)}` : ''}`;
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET', signal: ctrl.signal,
      headers: { 'X-Goog-Api-Key': GKEY, 'Content-Type': 'application/json', ...(campos ? { 'X-Goog-FieldMask': campos } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[google]', res.status, data?.error?.message || '');
      throw new Error(`Google ${res.status}`);
    }
    return data;
  } catch {
    throw new HttpError(503, 'Google Maps no responde ahora mismo. Puedes escribir la dirección a mano.');
  } finally { clearTimeout(t); }
}

async function sugerenciasGoogle(q, sesion) {
  const data = await google('places:autocomplete', {
    sesion,
    body: { input: q, languageCode: 'es', regionCode: 'es', includedRegionCodes: ['es'], ...(sesion ? { sessionToken: sesion } : {}) },
  });
  return (data.suggestions || []).map((x) => x.placePrediction).filter(Boolean).map((pp) => ({
    id: pp.placeId, tipo: (pp.types || []).includes('street_address') || (pp.types || []).includes('premise') ? 'portal' : (pp.types || []).includes('route') ? 'callejero' : (pp.types || []).includes('locality') ? 'municipio' : 'toponimo',
    proveedor: 'google',
    texto: pp.structuredFormat?.mainText?.text || pp.text?.text || '',
    direccion: pp.structuredFormat?.mainText?.text || pp.text?.text || '',
    secundario: pp.structuredFormat?.secondaryText?.text || '',
    ciudad: '', provincia: '', codigo_postal: '', lat: null, lng: null,
  }));
}

async function detalleGoogle(id, sesion) {
  const p = await google(`places/${encodeURIComponent(id)}?languageCode=es&regionCode=es`, {
    sesion, campos: 'id,displayName,formattedAddress,addressComponents,location,types',
  });
  const comp = (tipo) => (p.addressComponents || []).find((c) => (c.types || []).includes(tipo));
  const calle = comp('route')?.longText || '';
  const numero = comp('street_number')?.longText || '';
  const localidad = comp('locality')?.longText || comp('administrative_area_level_4')?.longText || comp('administrative_area_level_3')?.longText || comp('postal_town')?.longText || '';
  const prov = comp('administrative_area_level_2')?.longText || '';
  let ciudad = localidad; let provincia = prov;
  try { const m = resolverCiudad(localidad, prov); ciudad = m.ciudad; provincia = m.provincia; } catch { /* se deja el nombre de Google */ }
  const esLugar = !(p.types || []).some((t) => ['street_address', 'route', 'premise', 'subpremise', 'locality', 'political'].includes(t));
  let direccion = calle ? `${calle}${numero ? `, ${numero}` : ''}` : '';
  if (esLugar && p.displayName?.text) direccion = direccion ? `${p.displayName.text} · ${direccion}` : p.displayName.text;
  if (!direccion && !(p.types || []).includes('locality')) direccion = String(p.formattedAddress || '').split(',')[0];
  return {
    direccion, ciudad, provincia, codigo_postal: comp('postal_code')?.longText || '',
    lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
  };
}

// Sugerencias mientras se escribe
r.get('/', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  if (q.length > 200) throw bad('La búsqueda es demasiado larga.');
  if (usaGoogle()) return res.json((await sugerenciasGoogle(q, String(req.query.sesion || '').slice(0, 64))).slice(0, 8));
  const data = await pedir(`/candidates?q=${encodeURIComponent(q)}&limit=12`);
  const vistos = new Set();
  const out = [];
  for (const c of Array.isArray(data) ? data : []) {
    if (!['portal', 'callejero', 'carretera', 'municipio', 'poblacion', 'toponimo'].includes(String(c.type).toLowerCase())) continue;
    const x = convertir(c);
    const k = `${x.direccion}|${x.ciudad}|${x.tipo}`;
    if (vistos.has(k)) continue;
    vistos.add(k); out.push(x);
  }
  res.json(out.slice(0, 8));
}));

// Coordenadas exactas de una sugerencia (las calles sin número no las traen)
r.get('/detalle', wrap(async (req, res) => {
  const { id, tipo, portal } = req.query;
  if (!id || !tipo) throw bad('Falta la dirección elegida.');
  if (req.query.proveedor === 'google') {
    if (!usaGoogle()) throw bad('Google Maps no está configurado.');
    return res.json(await detalleGoogle(String(id), String(req.query.sesion || '').slice(0, 64)));
  }
  const ruta = `/find?id=${encodeURIComponent(id)}&type=${encodeURIComponent(tipo)}${portal ? `&portal=${encodeURIComponent(portal)}` : ''}`;
  const c = await pedir(ruta);
  let lat = Number(c?.lat) || null; let lng = Number(c?.lng) || null;
  if ((!lat || !lng) && typeof c?.geom === 'string') {
    // Calles: la geometría es una línea; se toma su punto central
    const pts = [...c.geom.matchAll(/(-?\d+\.\d+)\s+(-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (pts.length) { const p = pts[Math.floor(pts.length / 2)]; lng = p[0]; lat = p[1]; }
  }
  res.json({ lat, lng, codigo_postal: c?.postalCode || '' });
}));

export default r;
