import { useEffect, useState } from 'react';
import { useApp } from '../lib/app.jsx';
import { get, post, put } from '../lib/api.js';
import { Sheet, Field } from './ui.jsx';
import * as f from '../lib/format.js';

const toKg = (v) => { const n = f.parseNum(v); return n == null ? 0 : n * 1000; };
const toT = (kg) => (kg ? String(Number(kg) / 1000).replace('.', ',') : '');

export default function ObraForm({ obra, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [usuarios, setUsuarios] = useState([]);
  const [d, setD] = useState(() => obra ? { ...obra, t_contratadas: toT(obra.kg_contratados), t_fab: toT(obra.kg_previstos_fab), t_mont: toT(obra.kg_previstos_montaje), presupuesto: String(obra.presupuesto || '').replace('.', ',') }
    : { codigo: '', nombre: '', cliente: '', direccion: '', responsable_id: '', fecha_inicio: f.hoyISO(), fecha_entrega: '', t_contratadas: '', t_fab: '', t_mont: '', presupuesto: '', estado: 'planificada', observaciones: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { get('/usuarios/lista').then(setUsuarios).catch(() => {}); }, []);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    setBusy(true);
    try {
      const body = { ...d, kg_contratados: toKg(d.t_contratadas), kg_previstos_fab: toKg(d.t_fab), kg_previstos_montaje: toKg(d.t_mont || d.t_fab), presupuesto: f.parseNum(d.presupuesto) || 0 };
      const r = obra ? await put(`/obras/${obra.id}`, body) : await post('/obras', body);
      toast(obra ? 'Obra actualizada.' : `Obra ${r.codigo} creada con las 9 fases por defecto.`);
      onSaved?.(r); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title={obra ? `Editar ${obra.codigo}` : 'Nueva obra'} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>Guardar obra</button></>}>
      <div className="form-grid">
        <Field label="Código *"><input className="input mono" value={d.codigo} onChange={s('codigo')} placeholder="OB-2026-030" /></Field>
        <Field label="Nombre *"><input className="input" value={d.nombre} onChange={s('nombre')} placeholder="Nave industrial…" /></Field>
        <Field label="Cliente"><input className="input" value={d.cliente} onChange={s('cliente')} /></Field>
        <Field label="Responsable"><select className="input" value={d.responsable_id || ''} onChange={s('responsable_id')}><option value="">—</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Field>
        <Field label="Dirección de montaje" full><input className="input" value={d.direccion} onChange={s('direccion')} /></Field>
        <Field label="Fecha de inicio"><input type="date" className="input" value={d.fecha_inicio || ''} onChange={s('fecha_inicio')} /></Field>
        <Field label="Fecha de entrega"><input type="date" className="input" value={d.fecha_entrega || ''} onChange={s('fecha_entrega')} /></Field>
        <Field label="Toneladas contratadas (t)"><input className="input" inputMode="decimal" value={d.t_contratadas} onChange={s('t_contratadas')} placeholder="120,5" /></Field>
        <Field label="Toneladas previstas de fabricación (t)" hint="Base para el % de las fases de taller"><input className="input" inputMode="decimal" value={d.t_fab} onChange={s('t_fab')} /></Field>
        <Field label="Toneladas previstas de montaje (t)" hint="Si se deja vacío, igual que fabricación"><input className="input" inputMode="decimal" value={d.t_mont} onChange={s('t_mont')} /></Field>
        <Field label="Presupuesto (€)"><input className="input" inputMode="decimal" value={d.presupuesto} onChange={s('presupuesto')} /></Field>
        <Field label="Estado"><select className="input" value={d.estado} onChange={s('estado')}>{Object.entries(f.ESTADOS_OBRA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Observaciones" full><textarea className="input" value={d.observaciones || ''} onChange={s('observaciones')} /></Field>
      </div>
    </Sheet>
  );
}
