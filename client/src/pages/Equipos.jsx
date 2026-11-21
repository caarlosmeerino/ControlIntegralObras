import { useState } from 'react';
import { Plus, Save, UsersRound, Construction } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, qs } from '../lib/api.js';
import { Loading, DataTable, Sheet, Field, Seg } from '../components/ui.jsx';
import * as f from '../lib/format.js';

const TIPOS = { grua: 'Grúa', camion_grua: 'Camión grúa', plataforma: 'Plataforma elevadora', carretilla: 'Carretilla', otro: 'Otro' };

export default function Equipos() {
  const { can, toast, toastError } = useApp();
  const [periodo, setPeriodo] = useState('mes');
  const eq = useData('/personal/equipos');
  const md = useData('/personal/medios');
  const hasta = f.hoyISO(); const desde = f.sumarDias(hasta, periodo === 'semana' ? -6 : -29);
  const rend = useData(`/informes/rendimientos${qs({ desde, hasta })}`, [periodo]);
  const [eEdit, setEEdit] = useState(null);
  const [mEdit, setMEdit] = useState(null);
  if (!eq.data || !md.data) return <Loading />;
  const rmap = new Map((rend.data?.equipos || []).map((r) => [r.equipo_id, r]));
  const guardarE = async () => { try { eEdit.id ? await put(`/personal/equipos/${eEdit.id}`, eEdit) : await post('/personal/equipos', eEdit); toast('Equipo guardado.'); setEEdit(null); eq.reload(); } catch (e) { toastError(e); } };
  const guardarM = async () => { try { const b = { ...mEdit, coste_hora: f.parseNum(mEdit.coste_hora) || 0 }; mEdit.id ? await put(`/personal/medios/${mEdit.id}`, b) : await post('/personal/medios', b); toast('Medio guardado.'); setMEdit(null); md.reload(); } catch (e) { toastError(e); } };
  return (
    <>
      <div className="page-head">
        <div><h1>Operarios y equipos</h1><p>Equipos de trabajo, su rendimiento, y medios de elevación.</p></div>
        <div className="page-actions"><Seg value={periodo} onChange={setPeriodo} options={[['semana', '7 días'], ['mes', '30 días']]} /></div>
      </div>
      <div className="card pad0 mb">
        <div className="card-head" style={{ padding: '16px 18px 0' }}><h2><UsersRound size={20} style={{ verticalAlign: -3 }} /> Equipos</h2>{can('personal.editar') && <button className="btn" onClick={() => setEEdit({ nombre: '', seccion: 'armado', activo: true })}><Plus size={18} />Nuevo equipo</button>}</div>
        <DataTable rows={eq.data} onRow={can('personal.editar') ? setEEdit : undefined}
          columns={[{ key: 'nombre', label: 'Equipo', render: (e) => <b>{e.nombre}</b> }, { key: 'seccion', label: 'Sección', render: (e) => f.SECCIONES[e.seccion] },
            { key: 'personas', label: 'Personas', num: true }, { key: 'horas', label: 'Horas', num: true, render: (e) => f.horas(rmap.get(e.id)?.horas || 0) },
            { key: 'kg', label: 'Procesado', num: true, render: (e) => <b>{f.t(rmap.get(e.id)?.kg || 0)}</b> }, { key: 'kgh', label: 'kg/h', num: true, render: (e) => f.num(rmap.get(e.id)?.kg_hora || 0) },
            can('costes.ver') && { key: 'ct', label: '€/t', num: true, render: (e) => f.eur0(rmap.get(e.id)?.coste_tonelada) }].filter(Boolean)} />
      </div>
      <div className="card pad0">
        <div className="card-head" style={{ padding: '16px 18px 0' }}><h2><Construction size={20} style={{ verticalAlign: -3 }} /> Medios de elevación y maquinaria</h2>{can('personal.editar') && <button className="btn" onClick={() => setMEdit({ nombre: '', tipo: 'grua', matricula: '', coste_hora: '', propio: true, activo: true })}><Plus size={18} />Nuevo medio</button>}</div>
        <DataTable rows={md.data} onRow={can('personal.editar') ? setMEdit : undefined}
          columns={[{ key: 'nombre', label: 'Medio', render: (m) => <b>{m.nombre}</b> }, { key: 'tipo', label: 'Tipo', render: (m) => TIPOS[m.tipo] || m.tipo }, { key: 'matricula', label: 'Matrícula' },
            { key: 'propio', label: 'Propiedad', render: (m) => (m.propio ? 'Propio' : 'Alquiler') }, can('costes.ver') && { key: 'coste_hora', label: '€/h', num: true, render: (m) => f.eur(m.coste_hora) },
            { key: 'activo', label: 'Estado', render: (m) => <span className={`badge ${m.activo ? 'ok' : ''}`}>{m.activo ? 'Disponible' : 'Inactivo'}</span> }].filter(Boolean)} />
      </div>
      {eEdit && <Sheet title={eEdit.id ? eEdit.nombre : 'Nuevo equipo'} onClose={() => setEEdit(null)} footer={<><button className="btn" onClick={() => setEEdit(null)}>Cancelar</button><button className="btn primary" onClick={guardarE}><Save size={18} />Guardar</button></>}>
        <div className="form-grid"><Field label="Nombre"><input className="input" value={eEdit.nombre} onChange={(e) => setEEdit({ ...eEdit, nombre: e.target.value })} /></Field>
          <Field label="Sección"><select className="input" value={eEdit.seccion} onChange={(e) => setEEdit({ ...eEdit, seccion: e.target.value })}>{Object.entries(f.SECCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <label className="check"><input type="checkbox" checked={eEdit.activo !== false} onChange={(e) => setEEdit({ ...eEdit, activo: e.target.checked })} />Activo</label></div></Sheet>}
      {mEdit && <Sheet title={mEdit.id ? mEdit.nombre : 'Nuevo medio'} onClose={() => setMEdit(null)} footer={<><button className="btn" onClick={() => setMEdit(null)}>Cancelar</button><button className="btn primary" onClick={guardarM}><Save size={18} />Guardar</button></>}>
        <div className="form-grid"><Field label="Nombre" full><input className="input" value={mEdit.nombre} onChange={(e) => setMEdit({ ...mEdit, nombre: e.target.value })} /></Field>
          <Field label="Tipo"><select className="input" value={mEdit.tipo} onChange={(e) => setMEdit({ ...mEdit, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Matrícula / nº serie"><input className="input" value={mEdit.matricula} onChange={(e) => setMEdit({ ...mEdit, matricula: e.target.value })} /></Field>
          <Field label="Coste (€/h)"><input className="input" inputMode="decimal" value={mEdit.coste_hora ?? ''} onChange={(e) => setMEdit({ ...mEdit, coste_hora: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={mEdit.propio} onChange={(e) => setMEdit({ ...mEdit, propio: e.target.checked })} />Propio (no alquilado)</label>
          <label className="check"><input type="checkbox" checked={mEdit.activo} onChange={(e) => setMEdit({ ...mEdit, activo: e.target.checked })} />Disponible</label></div></Sheet>}
    </>
  );
}
