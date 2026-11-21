import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { many, one, q } from '../db.js';
import { wrap, bad, notFound, str, oneOf } from '../http.js';
import { requirePerm } from '../auth.js';
import { ROLES } from '../permissions.js';
import { audit } from '../audit.js';

const r = Router();
const roles = Object.keys(ROLES);

// Lista mínima (para selectores de responsable) — cualquier usuario autenticado
r.get('/lista', wrap(async (req, res) => {
  res.json(await many("SELECT id, nombre, rol FROM usuarios WHERE activo ORDER BY nombre"));
}));

r.use(requirePerm('usuarios.admin'));

r.get('/', wrap(async (req, res) => {
  res.json(await many('SELECT id, username, nombre, email, rol, activo, ultimo_acceso, creado_en FROM usuarios ORDER BY nombre'));
}));

r.post('/', wrap(async (req, res) => {
  const b = req.body;
  const password = str(b.password, 'contraseña', { required: true });
  if (password.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres.');
  const u = await one(
    `INSERT INTO usuarios (username, password_hash, nombre, email, rol) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, username, nombre, email, rol, activo`,
    [str(b.username, 'usuario', { required: true, max: 60 }).toLowerCase(), await bcrypt.hash(password, 10),
      str(b.nombre, 'nombre', { required: true }), str(b.email, 'email'), oneOf(b.rol, 'perfil', roles)]);
  await audit({ query: q }, { entidad: 'usuario', entidadId: u.id, accion: 'crear', detalle: `Usuario ${u.username} (${ROLES[u.rol]})`, usuarioId: req.user.id });
  res.status(201).json(u);
}));

r.put('/:id', wrap(async (req, res) => {
  const b = req.body; const id = Number(req.params.id);
  const cur = await one('SELECT * FROM usuarios WHERE id=$1', [id]);
  if (!cur) throw notFound('No se ha encontrado el usuario.');
  if (id === req.user.id && (b.activo === false || (b.rol && b.rol !== 'admin'))) throw bad('No puedes desactivarte ni quitarte el perfil de administrador a ti mismo.');
  let hash = cur.password_hash;
  if (b.password) {
    if (String(b.password).length < 8) throw bad('La contraseña debe tener al menos 8 caracteres.');
    hash = await bcrypt.hash(String(b.password), 10);
  }
  const u = await one(
    `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4, password_hash=$5 WHERE id=$6
     RETURNING id, username, nombre, email, rol, activo`,
    [str(b.nombre, 'nombre', { required: true }), str(b.email, 'email'), oneOf(b.rol, 'perfil', roles, cur.rol),
      b.activo === undefined ? cur.activo : !!b.activo, hash, id]);
  await audit({ query: q }, { entidad: 'usuario', entidadId: id, accion: 'editar', detalle: `Usuario ${u.username}${b.password ? ' (contraseña cambiada)' : ''}`, usuarioId: req.user.id });
  res.json(u);
}));

export default r;
