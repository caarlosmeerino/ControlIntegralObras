import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HardHat, Phone } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put } from '../lib/api.js';
import { Loading, ErrorBox, Sheet, Field, BotonMas, Cabecera, IconoIniciales, Empty } from '../components/ui.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import { Lupa } from '../components/iconos.jsx';
import * as f from '../lib/format.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Alta y edición de un empleado (se usa aquí y desde el equipo de un proyecto) */
export function EmpleadoForm({ inicial = {}, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [e, setE] = useState({ nombre: '', categoria: '', seccion: 'montaje', telefono: '', documento: '', activo: true, ...inicial });
  const [busy, setBusy] = useState(false);
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const guardar = async () => {
    setBusy(true);
    try {
      const r = e.id ? await put(`/empleados/${e.id}`, e) : await post('/empleados', e);
      toast(e.id ? 'Empleado actualizado.' : `${r.nombre} añadido a la plantilla.`); onSaved?.(r); onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet title={e.id ? e.nombre : 'Nuevo empleado'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>{e.id ? 'Guardar' : 'Añadir empleado'}</button></>}>
      <div className="form-grid">
        <Field label="Nombre y apellidos" full><input className="input" value={e.nombre} onChange={set('nombre')} autoFocus={!e.id} placeholder="Ej.: Juan Pérez Martín"
          onKeyDown={(ev) => { if (ev.key === 'Enter' && e.nombre.trim()) guardar(); }} /></Field>
        {e.id && <label className="check full"><input type="checkbox" checked={e.activo} onChange={set('activo')} />Sigue en la empresa</label>}
      </div>
      {e.obras?.length > 0 && (
        <div className="mt">
          <div className="field-label mb-s">Proyectos en los que está</div>
          <div className="lista lista-plana">
            {e.obras.map((o) => (
              <Link key={o.id} to={`/obras/${o.id}`} className="lista-fila" style={{ minHeight: 52, padding: '10px 4px' }}>
                <span className="grow"><span className="lista-titulo" style={{ display: 'block' }}>{o.nombre}</span>{o.funcion && <span className="lista-sub" style={{ display: 'block' }}>{o.funcion}</span>}</span>
                <ChevronRight size={18} className="muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}


export default function Empleados() {
  const { can } = useApp();
  const [todos, setTodos] = useState(false);
  const { data, error, loading, reload } = useData(`/empleados${todos ? '?todos=1' : ''}`);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const t = norm(q.trim());
  const lista = data.filter((e) => !t || [e.nombre, e.categoria, f.SECCIONES[e.seccion], e.telefono, ...e.obras.map((o) => o.nombre)].some((x) => norm(x).includes(t)));
  const activos = data.filter((e) => e.activo);
  const enObra = activos.filter((e) => e.obras.some((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado))).length;
  return (
    <>
      <Cabecera icono={<IconoIniciales icon={HardHat} color="linear-gradient(180deg,#ffb340,#ff9500)" />} titulo="Empleados"
        sub={`${f.plural(activos.length, 'empleado')} · ${enObra} en proyectos en curso`}
        acciones={can('personal.editar') && <BotonMas texto="Nuevo empleado" onClick={() => setEdit({})} />} />
      <div className="search busqueda-grande mb" style={{ maxWidth: 'none' }}><Lupa size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o proyecto" aria-label="Buscar empleado" type="search" />
      </div>
      {!lista.length ? <Empty icon={HardHat} title={t ? `Nadie coincide con «${q}»` : 'Todavía no hay empleados'}>{!t && 'Pulsa «Nuevo empleado» para crear la plantilla.'}</Empty> : (
        <div className="lista">
          {lista.map((e) => (
            <button key={e.id} type="button" className="lista-fila" onClick={() => can('personal.editar') && setEdit(e)} style={{ opacity: e.activo ? 1 : 0.5 }}>
              <AvatarCliente nombre={e.nombre} size={44} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="lista-titulo" style={{ display: 'block' }}>{e.nombre}</span>
                <span className="lista-sub" style={{ display: 'block' }}>{e.obras.length ? f.plural(e.obras.length, 'proyecto') : 'Sin proyecto asignado'}{!e.activo ? ' · ya no está' : ''}</span>
                {e.obras.length > 0 && <span className="lista-sub" style={{ display: 'block', color: 'var(--accent)' }}>{e.obras.map((o) => o.nombre).join(' · ')}</span>}
              </span>
              {e.telefono && <a className="btn ghost icon" href={`tel:${e.telefono.replace(/\s/g, '')}`} onClick={(ev) => ev.stopPropagation()} aria-label={`Llamar a ${e.nombre}`}><Phone size={19} /></a>}
              <ChevronRight size={18} className="muted" />
            </button>
          ))}
        </div>
      )}
      <div className="center mt"><button className="btn ghost sm" onClick={() => setTodos(!todos)}>{todos ? 'Ocultar los que ya no están' : 'Ver también los que ya no están'}</button></div>
      {edit && <EmpleadoForm inicial={edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
}
