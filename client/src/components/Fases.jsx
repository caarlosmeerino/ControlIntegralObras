import { useState } from 'react';
import { Pencil, Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { post, put, del } from '../lib/api.js';
import { Sheet, Field, Status, toneOf } from './ui.jsx';
import * as f from '../lib/format.js';

export function FaseForm({ obraId, fase, total, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [d, setD] = useState(fase ? { ...fase, t_prev: fase.kg_previstos ? String(fase.kg_previstos / 1000).replace('.', ',') : '' }
    : { nombre: '', descripcion: '', ambito: 'taller', indicador: 'completadas', peso_ponderacion: 5, t_prev: '', fecha_inicio_prevista: '', fecha_fin_prevista: '', posicion: total + 1 });
  const s = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    try {
      const body = { ...d, kg_previstos: d.t_prev === '' ? null : f.parseNum(d.t_prev) * 1000, peso_ponderacion: f.parseNum(d.peso_ponderacion) };
      if (fase) await put(`/fases/${fase.id}`, body); else await post(`/fases/obra/${obraId}`, body);
      toast(fase ? 'Fase actualizada.' : 'Fase añadida.'); onSaved(); onClose();
    } catch (e) { toastError(e); }
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar la fase «${fase.nombre}»?`)) return;
    try { await del(`/fases/${fase.id}`); toast('Fase eliminada.'); onSaved(); onClose(); } catch (e) { toastError(e); }
  };
  return (
    <Sheet title={fase ? `Fase ${fase.orden}: ${fase.nombre}` : 'Añadir fase'} onClose={onClose}
      footer={<>{fase && <button className="btn danger" onClick={borrar}><Trash2 size={18} />Eliminar</button>}<span className="grow hide-m" /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}><Save size={18} />Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre *" full><input className="input" value={d.nombre} onChange={s('nombre')} /></Field>
        <Field label="Descripción" full><textarea className="input" value={d.descripcion} onChange={s('descripcion')} /></Field>
        <Field label="Ámbito" hint="Define qué perfiles pueden registrar avances"><select className="input" value={d.ambito} onChange={s('ambito')}>{Object.entries(f.AMBITOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Indicador (verbo)" hint="Ej.: cortadas, pintadas, montadas"><input className="input" value={d.indicador} onChange={s('indicador')} /></Field>
        <Field label="Inicio previsto"><input type="date" className="input" value={d.fecha_inicio_prevista || ''} onChange={s('fecha_inicio_prevista')} /></Field>
        <Field label="Fin previsto" hint="Si se supera sin terminar, la fase aparece como retrasada"><input type="date" className="input" value={d.fecha_fin_prevista || ''} onChange={s('fecha_fin_prevista')} /></Field>
        <Field label="Toneladas previstas en esta fase (t)" hint="Vacío = las previstas de la obra"><input className="input" inputMode="decimal" value={d.t_prev} onChange={s('t_prev')} /></Field>
        <Field label="Ponderación en el avance global (%)"><input className="input" inputMode="decimal" value={d.peso_ponderacion} onChange={s('peso_ponderacion')} /></Field>
        {!fase && <Field label="Posición"><input className="input" type="number" min="1" max={total + 1} value={d.posicion} onChange={s('posicion')} /></Field>}
      </div>
    </Sheet>
  );
}

/** Tabla editable de fases de una obra (con resumen de toneladas) */
export function FasesObra({ obra, reload }) {
  const { can } = useApp();
  const [edit, setEdit] = useState(null);
  const fases = obra.resumen.fases;
  const sumW = fases.reduce((s, x) => s + x.peso_ponderacion, 0);
  return (
    <div className="card pad0">
      <div className="card-head" style={{ padding: '16px 18px 0' }}>
        <div><h2>Fases de la obra</h2><p>Editables por proyecto. El avance global pondera cada fase (suma de ponderaciones: {f.num(sumW, 1)} %).</p></div>
        {can('fases.editar') && <button className="btn" onClick={() => setEdit({})}><Plus size={18} />Añadir fase</button>}
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>#</th><th>Fase</th><th>Ámbito</th><th className="num">Previsto</th><th className="num">Completado</th><th className="num">En la fase</th><th className="num">%</th><th>Calendario</th><th>Estado</th><th className="num">Pond.</th>{can('fases.editar') && <th />}</tr></thead>
          <tbody>
            {fases.map((x) => (
              <tr key={x.id}>
                <td><span className={`phase-n ${toneOf(x.estado)}`}>{x.orden}</span></td>
                <td><div className="strong">{x.nombre}</div><div className="xs muted" style={{ maxWidth: 340 }}>{x.descripcion}</div></td>
                <td>{f.AMBITOS[x.ambito]}</td>
                <td className="num">{f.t(x.kg_base)}</td>
                <td className="num strong">{f.t(x.kg_completados)}</td>
                <td className="num">{f.t(x.kg_en_fase)}</td>
                <td className="num strong">{f.pct(x.porcentaje)}</td>
                <td className="small nowrap">{f.fecha(x.fecha_inicio_prevista)} → {f.fecha(x.fecha_fin_prevista)}</td>
                <td><Status estado={x.estado} small /></td>
                <td className="num">{f.num(x.peso_ponderacion, 1)} %</td>
                {can('fases.editar') && <td><button className="btn ghost icon" onClick={() => setEdit(x)} aria-label={`Editar ${x.nombre}`}><Pencil size={18} /></button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td /><td>Producción acumulada (Σ fases)</td><td /><td /><td className="num">{f.t(obra.resumen.produccion_acumulada_kg)}</td><td className="num">{f.t(obra.resumen.kg_unicos)}</td><td colSpan={can('fases.editar') ? 5 : 4} className="small muted" style={{ fontWeight: 500 }}>«En la fase» suma las toneladas únicas; la columna «Completado» no debe sumarse.</td></tr></tfoot>
        </table>
      </div>
      {edit && <FaseForm obraId={obra.id} fase={edit.id ? edit : null} total={fases.length} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
