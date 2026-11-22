import { useState } from 'react';
import { KeyRound, Moon, Sun, MonitorSmartphone, Download } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { post } from '../lib/api.js';
import { Field, Selector, Cabecera, IconoIniciales } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export default function Perfil() {
  const { user, tema, setTema, toast, toastError } = useApp();
  const [d, setD] = useState({ actual: '', nueva: '', repetir: '' });
  const cambiar = async (e) => {
    e.preventDefault();
    if (d.nueva !== d.repetir) return toastError(new Error('Las contraseñas nuevas no coinciden.'));
    try { const r = await post('/auth/password', d); toast(r.mensaje); setD({ actual: '', nueva: '', repetir: '' }); } catch (er) { toastError(er); }
  };
  return (
    <div style={{ maxWidth: 640 }}>
      <Cabecera icono={<IconoIniciales texto={user.nombre} color="linear-gradient(180deg,#a1a1a6,#7c7c80)" />} titulo={user.nombre} sub={`${f.ROLES[user.rol]} · ${user.username}`} />
      <div className="card mb"><h2 className="mb">Apariencia</h2>
        <Selector titulo="Apariencia" value={tema} onChange={setTema} options={[{ value: 'light', label: 'Claro', icon: Sun }, { value: 'dark', label: 'Oscuro', icon: Moon }, { value: 'auto', label: 'Igual que el sistema', icon: MonitorSmartphone }]} />
        <div className="hint mt">El modo oscuro reduce reflejos y deslumbramiento en el taller.</div>
      </div>
      <div className="card mb"><h2 className="mb"><Download size={20} style={{ verticalAlign: -3 }} /> Instalar en el móvil</h2>
        <div className="small">Android (Chrome): menú ⋮ → «Instalar aplicación». iPhone (Safari): botón Compartir → «Añadir a pantalla de inicio». Se abrirá a pantalla completa como una app.</div>
      </div>
      <form className="card stack" onSubmit={cambiar}><h2><KeyRound size={20} style={{ verticalAlign: -3 }} /> Cambiar contraseña</h2>
        <Field label="Contraseña actual"><input className="input" type="password" autoComplete="current-password" value={d.actual} onChange={(e) => setD({ ...d, actual: e.target.value })} required /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres"><input className="input" type="password" autoComplete="new-password" value={d.nueva} onChange={(e) => setD({ ...d, nueva: e.target.value })} required /></Field>
        <Field label="Repite la nueva contraseña"><input className="input" type="password" autoComplete="new-password" value={d.repetir} onChange={(e) => setD({ ...d, repetir: e.target.value })} required /></Field>
        <button className="btn primary">Guardar contraseña</button>
      </form>
    </div>
  );
}
