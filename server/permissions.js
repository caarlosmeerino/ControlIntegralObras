// Permisos por perfil. El servidor es la autoridad: cada ruta exige uno.
export const ROLES = {
  admin: 'Administrador',
  director: 'Director de producción',
  jefe_taller: 'Jefe de taller',
  encargado_montaje: 'Encargado de montaje',
  operario: 'Operario',
  administracion: 'Administración',
};

const P = {
  'obras.ver': 'Ver obras',
  'obras.editar': 'Crear y editar obras',
  'fases.editar': 'Editar fases y calendario',
  'piezas.ver': 'Ver piezas',
  'piezas.editar': 'Crear, importar y editar piezas',
  'avance.oficina': 'Registrar avances de ingeniería y compras',
  'avance.taller': 'Registrar avances de taller',
  'avance.obra': 'Registrar avances de montaje',
  'avance.corregir': 'Corregir (retroceder) avances',
  'partes.taller': 'Registrar horas de taller',
  'partes.montaje': 'Partes diarios de montaje',
  'personal.ver': 'Ver personal y equipos',
  'personal.editar': 'Gestionar personal y equipos',
  'costes.ver': 'Ver costes',
  'costes.editar': 'Registrar costes y presupuestos',
  'informes.ver': 'Ver y exportar informes',
  'archivos.subir': 'Subir fotos y documentos',
  'usuarios.admin': 'Gestionar usuarios',
  'sistema.admin': 'Copias de seguridad y sistema',
};
export const PERMISOS = P;

const all = Object.keys(P);
export const ROLE_PERMS = {
  admin: all,
  director: all.filter((p) => !['usuarios.admin', 'sistema.admin'].includes(p)),
  jefe_taller: ['obras.ver', 'piezas.ver', 'piezas.editar', 'avance.oficina', 'avance.taller', 'avance.corregir',
    'partes.taller', 'personal.ver', 'informes.ver', 'archivos.subir', 'fases.editar'],
  encargado_montaje: ['obras.ver', 'piezas.ver', 'avance.obra', 'partes.montaje', 'personal.ver', 'archivos.subir'],
  operario: ['obras.ver', 'piezas.ver', 'avance.taller', 'partes.taller', 'archivos.subir'],
  administracion: ['obras.ver', 'piezas.ver', 'personal.ver', 'personal.editar', 'costes.ver', 'costes.editar',
    'informes.ver', 'obras.editar'],
};

export const can = (user, perm) => !!user && (ROLE_PERMS[user.rol] || []).includes(perm);

export function permisoAvance(ambito) {
  return { oficina: 'avance.oficina', taller: 'avance.taller', obra: 'avance.obra' }[ambito] || 'avance.taller';
}
