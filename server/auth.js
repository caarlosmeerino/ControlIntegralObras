import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { one } from './db.js';
import { can, ROLE_PERMS } from './permissions.js';
import { HttpError, forbidden } from './http.js';

export const COOKIE = 'cio_sesion';

export function signSession(user) {
  return jwt.sign({ uid: user.id, rol: user.rol }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: config.sessionHours * 3600 * 1000, path: '/',
  });
}

// Carga el usuario en cada petición; el rol se lee SIEMPRE de la base de datos
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE] || (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return next();
  try {
    const p = jwt.verify(token, config.jwtSecret);
    const u = await one('SELECT id, username, nombre, rol, activo FROM usuarios WHERE id=$1', [p.uid]);
    if (u && u.activo) req.user = u;
  } catch { /* token caducado o inválido */ }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'));
  next();
}

export const requirePerm = (...perms) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'));
  if (!perms.some((p) => can(req.user, p))) return next(forbidden());
  next();
};

export const userPayload = (u) => ({ id: u.id, username: u.username, nombre: u.nombre, rol: u.rol, permisos: ROLE_PERMS[u.rol] || [] });
