import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { one, q } from '../db.js';
import { wrap, bad, HttpError, str } from '../http.js';
import { signSession, setSessionCookie, COOKIE, requireAuth, userPayload } from '../auth.js';
import { ROLES, PERMISOS } from '../permissions.js';

const r = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a probar.' } });

r.post('/login', limiter, wrap(async (req, res) => {
  const username = str(req.body.username, 'usuario', { required: true }).toLowerCase();
  const password = str(req.body.password, 'contraseña', { required: true });
  const u = await one('SELECT * FROM usuarios WHERE lower(username)=$1', [username]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  if (!u.activo) throw new HttpError(403, 'Este usuario está desactivado. Habla con el administrador.');
  await q('UPDATE usuarios SET ultimo_acceso=now() WHERE id=$1', [u.id]);
  setSessionCookie(res, signSession(u));
  res.json({ user: userPayload(u) });
}));

r.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

r.get('/me', requireAuth, wrap(async (req, res) => {
  const trabajador = await one('SELECT id, nombre, seccion FROM trabajadores WHERE usuario_id=$1', [req.user.id]);
  res.json({ user: { ...userPayload(req.user), trabajador }, roles: ROLES, permisos: PERMISOS });
}));

r.post('/password', requireAuth, wrap(async (req, res) => {
  const actual = str(req.body.actual, 'contraseña actual', { required: true });
  const nueva = str(req.body.nueva, 'contraseña nueva', { required: true });
  if (nueva.length < 8) throw bad('La contraseña nueva debe tener al menos 8 caracteres.');
  const u = await one('SELECT * FROM usuarios WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(actual, u.password_hash))) throw bad('La contraseña actual no es correcta.');
  await q('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(nueva, 10), u.id]);
  res.json({ ok: true, mensaje: 'Contraseña cambiada correctamente.' });
}));

export default r;
