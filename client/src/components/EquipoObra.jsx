import { useEffect, useState } from 'react';
import { Plus, Phone, UserPlus, Check, X } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { get, post, put, del } from '../lib/api.js';
import { Loading, Sheet, Empty } from './ui.jsx';
import { AvatarCliente } from './ClientePicker.jsx';
import { Lupa } from './iconos.jsx';
import { EmpleadoForm } from '../pages/Empleados.jsx';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Hoja para elegir varios empleados de la plantilla (o crear uno nuevo) */
function ElegirEmpleados({ yaEstan, onClose, onAñadir }) {
  const { can } = useApp();
  const [todos, setTodos] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());
  const [nuevo, setNuevo] = useState(false);
  const cargar = () => get('/empleados').then(setTodos).catch(() => setTodos([]));
  useEffect(() => { cargar(); }, []);
  const t = norm(q.trim());
  const lista = (todos || []).filter((e) => !yaEstan.has(e.id) && (!t || [e.nombre, e.categoria, e.seccion].some((x) => norm(x).includes(t))));
  const toggle = (id) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  return (
    <Sheet title="Añadir al equipo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!sel.size} onClick={() => onAñadir([...sel])}>{sel.size ? `Añadir ${sel.size}` : 'Añadir'}</button></>}>
      <div className="search busqueda-grande mb" style={{ maxWidth: 'none' }}><Lupa size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empleado" aria-label="Buscar empleado" type="search" />
      </div>
      {can('personal.editar') && (
        <button type="button" className="picker-fila crear-pieza" onClick={() => setNuevo(true)}>
          <span className="avatar-cliente nuevo"><UserPlus size={20} /></span>
          <span className="grow"><span className="picker-nombre">Crear un empleado nuevo</span><span className="picker-sub">Se guarda en la plantilla de la empresa</span></span>
        </button>
      )}
      {todos === null ? <Loading /> : !lista.length ? <div className="empty small">{t ? `Nadie coincide con «${q}».` : 'Todos los empleados ya están en este proyecto.'}</div> : (
        <div className="lista lista-plana">
          {lista.map((e) => (
            <button key={e.id} type="button" className={`lista-fila elegible ${sel.has(e.id) ? 'on' : ''}`} onClick={() => toggle(e.id)} aria-pressed={sel.has(e.id)}>
              <AvatarCliente nombre={e.nombre} size={40} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="lista-titulo" style={{ display: 'block' }}>{e.nombre}</span>
                <span className="lista-sub" style={{ display: 'block' }}>{e.obras.length ? `En ${e.obras.length} proyecto(s)` : 'Sin proyecto asignado'}</span>
              </span>
              <span className="marcador">{sel.has(e.id) && <Check size={16} strokeWidth={3} />}</span>
            </button>
          ))}
        </div>
      )}
      {nuevo && <EmpleadoForm onClose={() => setNuevo(false)} onSaved={(r) => { cargar(); if (r) setSel(new Set([...sel, r.id])); }} />}
    </Sheet>
  );
}

/** Pestaña «Equipo» del proyecto */
export default function EquipoObra({ obraId }) {
  const { can, toast, toastError } = useApp();
  const { data, loading, reload } = useData(`/empleados/obra/${obraId}`);
  const [elegir, setElegir] = useState(false);
  const [edit, setEdit] = useState(null); // { empleado, funcion }
  const editar = can('obras.editar');
  if (loading && !data) return <Loading />;
  const equipo = data || [];
  const añadir = async (ids) => {
    try { await post(`/empleados/obra/${obraId}`, { ids }); toast(ids.length === 1 ? 'Empleado añadido al equipo.' : `${ids.length} empleados añadidos al equipo.`); setElegir(false); reload(); } catch (e) { toastError(e); }
  };
  const guardarFuncion = async () => {
    try { await put(`/empleados/obra/${obraId}/${edit.e.id}`, { funcion: edit.funcion }); setEdit(null); reload(); } catch (e) { toastError(e); }
  };
  const quitar = async (e) => {
    if (!confirm(`¿Quitar a ${e.nombre} del equipo de este proyecto?`)) return;
    try { await del(`/empleados/obra/${obraId}/${e.id}`); toast(`${e.nombre} ya no está en el equipo.`); setEdit(null); reload(); } catch (err) { toastError(err); }
  };
  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Equipo del proyecto</h2><p>{equipo.length ? `${equipo.length} ${equipo.length === 1 ? 'persona' : 'personas'}` : 'Nadie asignado todavía'}</p></div>
        {editar && <button className="btn primary" onClick={() => setElegir(true)}><Plus size={18} />Añadir</button>}
      </div>
      {!equipo.length ? <Empty title="Sin empleados en este proyecto">Añade a las personas que trabajan en él desde la plantilla.</Empty> : (
        <div className="lista lista-plana">
          {equipo.map((e) => (
            <button key={e.id} type="button" className="lista-fila" onClick={() => editar && setEdit({ e, funcion: e.funcion || '' })}>
              <AvatarCliente nombre={e.nombre} size={42} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="lista-titulo" style={{ display: 'block' }}>{e.nombre}</span>
                <span className="lista-sub" style={{ display: 'block' }}>{e.funcion || (editar ? 'Toca para indicar su función' : '')}</span>
              </span>
              {e.telefono && <a className="btn ghost icon" href={`tel:${e.telefono.replace(/\s/g, '')}`} onClick={(ev) => ev.stopPropagation()} aria-label={`Llamar a ${e.nombre}`}><Phone size={19} /></a>}
            </button>
          ))}
        </div>
      )}
      {elegir && <ElegirEmpleados yaEstan={new Set(equipo.map((e) => e.id))} onClose={() => setElegir(false)} onAñadir={añadir} />}
      {edit && (
        <Sheet title={edit.e.nombre} onClose={() => setEdit(null)}
          footer={<><button className="btn danger" onClick={() => quitar(edit.e)}><X size={18} />Quitar del equipo</button><button className="btn primary" onClick={guardarFuncion}>Guardar</button></>}>
          <div className="field">
            <label>Función en este proyecto</label>
            <input className="input" value={edit.funcion} onChange={(ev) => setEdit({ ...edit, funcion: ev.target.value })} placeholder="Jefe de obra, montador, soldador…" autoFocus />
          </div>
          <div className="chips-sugeridas mt-s">
            {['Jefe de obra', 'Encargado', 'Montador', 'Soldador', 'Gruista', 'Ayudante'].map((s) => <button key={s} type="button" className="chip" onClick={() => setEdit({ ...edit, funcion: s })}>{s}</button>)}
          </div>
        </Sheet>
      )}
    </div>
  );
}
