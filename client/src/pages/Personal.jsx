import { useEffect, useState } from 'react';
import { Plus, Save, Search } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { get, post, put, qs } from '../lib/api.js';
import { Loading, ErrorBox, DataTable, Sheet, Field, Seg } from '../components/ui.jsx';
import * as f from '../lib/format.js';

const OPS = [['corte', 'Corte'], ['armado', 'Armado y soldadura'], ['calidad', 'Calidad'], ['pintura', 'Pintura'], ['expedicion', 'Expedición'], ['montaje', 'Montaje']];

function TrabajadorForm({ t, onClose, onSaved }) {
  const { toast, toastError, can } = useApp();
  const [equipos, setEquipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [d, setD] = useState(t ? { ...t } : { nombre: '', documento: '', telefono: '', seccion: 'armado', categoria: 'Oficial 1ª', coste_hora: '', equipo_id: '', usuario_id: '', operaciones: [], activo: true });
  useEffect(() => { get('/personal/equipos').then(setEquipos); if (can('usuarios.admin')) get('/usuarios').then(setUsuarios).catch(() => {}); }, [can]);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const guardar = async () => {
    try {
      const body = { ...d, coste_hora: f.parseNum(d.coste_hora) || 0 };
      if (t) await put(`/personal/trabajadores/${t.id}`, body); else await post('/personal/trabajadores', body);
      toast('Trabajador guardado.'); onSaved(); onClose();
    } catch (e) { toastError(e); }
  };
  const ops = new Set(d.operaciones || []);
  return (
    <Sheet title={t ? t.nombre : 'Nuevo trabajador'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}><Save size={18} />Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre y apellidos *" full><input className="input" value={d.nombre} onChange={s('nombre')} /></Field>
        <Field label="Sección"><select className="input" value={d.seccion} onChange={s('seccion')}>{Object.entries(f.SECCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Categoría"><input className="input" value={d.categoria} onChange={s('categoria')} /></Field>
        <Field label="Equipo"><select className="input" value={d.equipo_id || ''} onChange={s('equipo_id')}><option value="">—</option>{equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></Field>
        <Field label="Coste empresa (€/h)"><input className="input" inputMode="decimal" value={d.coste_hora ?? ''} onChange={s('coste_hora')} /></Field>
        <Field label="DNI / NIE"><input className="input" value={d.documento || ''} onChange={s('documento')} /></Field>
        <Field label="Teléfono"><input className="input" inputMode="tel" value={d.telefono || ''} onChange={s('telefono')} /></Field>
        {can('usuarios.admin') && <Field label="Usuario de la app" hint="Para que registre sus propios avances y horas" full><select className="input" value={d.usuario_id || ''} onChange={s('usuario_id')}><option value="">— Sin usuario —</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>)}</select></Field>}
        <div className="field full"><label>Operaciones asignadas</label>
          <div className="chips">{OPS.map(([k, v]) => <button type="button" key={k} className={`chip ${ops.has(k) ? 'on' : ''}`} onClick={() => { ops.has(k) ? ops.delete(k) : ops.add(k); setD({ ...d, operaciones: [...ops] }); }}>{v}</button>)}</div></div>
        <label className="check"><input type="checkbox" checked={d.activo} onChange={s('activo')} />Activo</label>
      </div>
    </Sheet>
  );
}

export default function Personal() {
  const { can } = useApp();
  const [periodo, setPeriodo] = useState('mes');
  const [seccion, setSeccion] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const { data, error, loading, reload } = useData('/personal/trabajadores?todos=1');
  const hasta = f.hoyISO(); const desde = f.sumarDias(hasta, periodo === 'dia' ? 0 : periodo === 'semana' ? -6 : -29);
  const rend = useData(`/informes/rendimientos${qs({ desde, hasta })}`, [periodo]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const rmap = new Map((rend.data?.trabajadores || []).map((r) => [r.id, r]));
  const lista = data.filter((t) => (!seccion || t.seccion === seccion) && (!q || t.nombre.toLowerCase().includes(q.toLowerCase())));
  const verCoste = can('costes.ver');
  return (
    <>
      <div className="page-head">
        <div><h1>Personal</h1><p>Trabajadores, operaciones asignadas, horas, toneladas procesadas y coste de mano de obra.</p></div>
        <div className="page-actions">{can('personal.editar') && <button className="btn primary" onClick={() => setEdit({})}><Plus />Nuevo trabajador</button>}</div>
      </div>
      <div className="row wrap mb">
        <div className="search" style={{ maxWidth: 280 }}><Search size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona" aria-label="Buscar persona" /></div>
        <select className="input" style={{ width: 'auto' }} value={seccion} onChange={(e) => setSeccion(e.target.value)} aria-label="Sección"><option value="">Todas las secciones</option>{Object.entries(f.SECCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="grow" />
        <Seg value={periodo} onChange={setPeriodo} options={[['dia', 'Hoy'], ['semana', '7 días'], ['mes', '30 días']]} />
      </div>
      <div className="card pad0">
        <DataTable rows={lista} onRow={can('personal.editar') ? (t) => setEdit(t) : undefined}
          columns={[
            { key: 'nombre', label: 'Trabajador', render: (t) => <><b style={{ opacity: t.activo ? 1 : .5 }}>{t.nombre}</b>{!t.activo && <span className="badge outline" style={{ marginLeft: 6 }}>Baja</span>}<div className="xs muted">{t.categoria}</div></> },
            { key: 'seccion', label: 'Sección', render: (t) => f.SECCIONES[t.seccion] },
            { key: 'equipo', label: 'Equipo', render: (t) => t.equipo || '—' },
            { key: 'ops', label: 'Operaciones', render: (t) => <span className="small">{t.operaciones.map((o) => OPS.find((x) => x[0] === o)?.[1] || o).join(', ') || '—'}</span> },
            { key: 'horas', label: 'Horas', num: true, render: (t) => f.horas(rmap.get(t.id)?.horas || 0) },
            { key: 'kg', label: 'Procesado', num: true, render: (t) => <b>{f.t(rmap.get(t.id)?.kg || 0)}</b> },
            { key: 'kgh', label: 'kg/h', num: true, render: (t) => f.num(rmap.get(t.id)?.kg_hora || 0) },
            verCoste && { key: 'coste', label: 'Coste M.O.', num: true, render: (t) => f.eur0(rmap.get(t.id)?.coste || 0) },
            verCoste && { key: 'ch', label: '€/h', num: true, render: (t) => f.eur(t.coste_hora) },
          ].filter(Boolean)}
          card={(t) => { const r = rmap.get(t.id) || {}; return <><div className="row between"><b>{t.nombre}</b><span className="badge outline">{f.SECCIONES[t.seccion]}</span></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}><div className="small">Horas<br /><b>{f.horas(r.horas || 0)}</b></div><div className="small">Procesado<br /><b>{f.t(r.kg || 0)}</b></div><div className="small">kg/h<br /><b>{f.num(r.kg_hora || 0)}</b></div></div></>; }} />
      </div>
      {edit && <TrabajadorForm t={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { reload(); rend.reload(); }} />}
    </>
  );
}
