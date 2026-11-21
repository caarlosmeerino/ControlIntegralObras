import { useState } from 'react';
import { Plus, Save, ShieldCheck } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put } from '../lib/api.js';
import { Loading, ErrorBox, DataTable, Sheet, Field, Selector } from '../components/ui.jsx';
import * as f from '../lib/format.js';

const DESC = {
  admin: 'Control total: usuarios, copias de seguridad y todos los datos.',
  director: 'Todas las obras y fases, costes e informes.',
  jefe_taller: 'Fabricación: piezas, avances de taller, horas y fases.',
  encargado_montaje: 'Montaje en obra: partes diarios, recepción y montaje de piezas.',
  operario: 'Registrar trabajos en taller y sus propias horas.',
  administracion: 'Costes, presupuestos, personal e informes.',
};

export default function Usuarios() {
  const { user, toast, toastError } = useApp();
  const { data, error, loading, reload } = useData('/usuarios');
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const guardar = async () => {
    try { edit.id ? await put(`/usuarios/${edit.id}`, edit) : await post('/usuarios', edit); toast('Usuario guardado.'); setEdit(null); reload(); } catch (e) { toastError(e); }
  };
  return (
    <>
      <div className="page-head"><div><h1>Usuarios y permisos</h1><p>El menú y las acciones de cada persona dependen de su perfil. Los permisos se comprueban en el servidor.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setEdit({ username: '', nombre: '', email: '', rol: 'operario', password: '', activo: true })}><Plus />Nuevo usuario</button></div></div>
      <div className="grid g3 mb">{Object.entries(f.ROLES).map(([k, v]) => <div key={k} className="card"><div className="row"><ShieldCheck size={20} style={{ color: 'var(--primary)' }} /><b>{v}</b></div><div className="small muted mt-s">{DESC[k]}</div><div className="xs mt-s">{data.filter((u) => u.rol === k && u.activo).length} usuario(s)</div></div>)}</div>
      <div className="card pad0">
        <DataTable rows={data} onRow={(u) => setEdit({ ...u, password: '' })}
          columns={[{ key: 'nombre', label: 'Nombre', render: (u) => <b style={{ opacity: u.activo ? 1 : .5 }}>{u.nombre}</b> }, { key: 'username', label: 'Usuario', render: (u) => <span className="mono">{u.username}</span> },
            { key: 'rol', label: 'Perfil', render: (u) => f.ROLES[u.rol] }, { key: 'activo', label: 'Estado', render: (u) => <span className={`badge ${u.activo ? 'ok' : ''}`}>{u.activo ? 'Activo' : 'Desactivado'}</span> },
            { key: 'acc', label: 'Último acceso', render: (u) => f.fechaHora(u.ultimo_acceso) }]} />
      </div>
      {edit && (
        <Sheet title={edit.id ? edit.nombre : 'Nuevo usuario'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={guardar}><Save size={18} />Guardar</button></>}>
          <div className="form-grid">
            <Field label="Nombre completo *"><input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Field>
            <Field label="Usuario *"><input className="input mono" value={edit.username} disabled={!!edit.id} autoCapitalize="none" onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></Field>
            <Field label="Correo electrónico"><input className="input" type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Perfil"><Selector titulo="Perfil del usuario" value={edit.rol} disabled={edit.id === user.id} onChange={(v) => setEdit({ ...edit, rol: v })} options={Object.entries(f.ROLES).map(([k, v]) => ({ value: k, label: v, sub: DESC[k] }))} /></Field>
            <Field label={edit.id ? 'Nueva contraseña (opcional)' : 'Contraseña *'} hint="Mínimo 8 caracteres" full><input className="input" type="password" autoComplete="new-password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            <div className="full small muted">{DESC[edit.rol]}</div>
            {edit.id !== user.id && <label className="check"><input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />Usuario activo</label>}
          </div>
        </Sheet>
      )}
    </>
  );
}
