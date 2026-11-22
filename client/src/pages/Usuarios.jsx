import { useState } from 'react';
import { ChevronRight, Users, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put } from '../lib/api.js';
import { Loading, ErrorBox, Sheet, Field, BotonMas, Cabecera, IconoIniciales, Empty } from '../components/ui.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import * as f from '../lib/format.js';

/** Perfiles que se ofrecen al crear usuarios (los antiguos siguen funcionando) */
export const PERFILES = [
  { value: 'admin', label: 'Administrador', sub: 'Todo, incluido crear usuarios y copias de seguridad.' },
  { value: 'director', label: 'Gestor', sub: 'Crea y edita proyectos, fases, piezas y documentos.' },
  { value: 'jefe_taller', label: 'Encargado', sub: 'Ve todo, marca checklists, confirma fases y sube documentos.' },
  { value: 'operario', label: 'Solo consulta', sub: 'Ve proyectos, planning y piezas sin modificar nada.' },
];

const generar = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(12); crypto.getRandomValues(a);
  return [...a].map((n) => c[n % c.length]).join('');
};

function FormUsuario({ inicial, yo, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [u, setU] = useState(inicial);
  const [ver, setVer] = useState(!inicial.id);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setU({ ...u, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const guardar = async () => {
    setBusy(true);
    try {
      const body = { ...u }; if (!body.password) delete body.password;
      if (u.id) await put(`/usuarios/${u.id}`, body); else await post('/usuarios', body);
      toast(u.id ? 'Usuario actualizado.' : `Usuario «${u.username}» creado.`); onSaved(); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title={u.id ? u.nombre : 'Nuevo usuario'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>{u.id ? 'Guardar' : 'Crear usuario'}</button></>}>
      <div className="stack">
        <div className="form-grid">
          <Field label="Nombre y apellidos" full><input className="input" value={u.nombre} onChange={set('nombre')} autoFocus={!u.id} placeholder="Ej.: Laura Gómez" /></Field>
          <Field label="Usuario para entrar"><input className="input mono" value={u.username} disabled={!!u.id} autoCapitalize="none" autoCorrect="off" onChange={(e) => setU({ ...u, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="lgomez" /></Field>
          <Field label="Correo (opcional)"><input className="input" type="email" value={u.email || ''} onChange={set('email')} /></Field>
          <Field label={u.id ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña'} hint="Mínimo 8 caracteres" full>
            <div className="pass-fila">
              <input className="input mono grow" type={ver ? 'text' : 'password'} autoComplete="new-password" value={u.password} onChange={set('password')} />
              <button type="button" className="btn icon" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar' : 'Mostrar'}>{ver ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              <button type="button" className="btn icon" onClick={() => { setU({ ...u, password: generar() }); setVer(true); }} aria-label="Generar contraseña" title="Generar contraseña"><RefreshCw size={19} /></button>
            </div>
          </Field>
        </div>
        <div>
          <div className="field-label mb-s">Perfil</div>
          <div className="perfiles">
            {PERFILES.map((p) => (
              <button key={p.value} type="button" className={`perfil-op ${u.rol === p.value ? 'on' : ''}`} disabled={u.id === yo}
                onClick={() => setU({ ...u, rol: p.value })} aria-pressed={u.rol === p.value}>
                <span className="perfil-radio" /><span className="grow"><b>{p.label}</b><small>{p.sub}</small></span>
              </button>
            ))}
          </div>
        </div>
        {u.id && u.id !== yo && <label className="check"><input type="checkbox" checked={u.activo} onChange={set('activo')} />Puede entrar en la aplicación</label>}
      </div>
    </Sheet>
  );
}

export default function Usuarios() {
  const { user } = useApp();
  const { data, error, loading, reload } = useData('/usuarios');
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const activos = data.filter((u) => u.activo).length;
  return (
    <>
      <Cabecera icono={<IconoIniciales icon={Users} color="linear-gradient(180deg,#7a78ff,#5856d6)" />} titulo="Usuarios"
        sub={`${f.plural(activos, 'usuario activo', 'usuarios activos')}${data.length > activos ? ` · ${data.length - activos} desactivado(s)` : ''}`}
        acciones={<BotonMas texto="Nuevo usuario" onClick={() => setEdit({ username: '', nombre: '', email: '', rol: 'director', password: generar(), activo: true })} />} />
      {!data.length ? <Empty title="No hay usuarios" /> : (
        <div className="lista">
          {data.map((u) => (
            <button key={u.id} type="button" className="lista-fila" onClick={() => setEdit({ ...u, password: '' })} style={{ opacity: u.activo ? 1 : 0.5 }}>
              <AvatarCliente nombre={u.nombre} size={44} />
              <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <span className="lista-titulo" style={{ display: 'block' }}>{u.nombre}{u.id === user.id ? <span className="muted"> · tú</span> : ''}</span>
                <span className="lista-sub" style={{ display: 'block' }}>{f.ROLES[u.rol]} · {u.username}{!u.activo ? ' · desactivado' : u.ultimo_acceso ? ` · último acceso ${f.fecha(u.ultimo_acceso)}` : ' · nunca ha entrado'}</span>
              </span>
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
        </div>
      )}
      {edit && <FormUsuario inicial={edit} yo={user.id} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
}
