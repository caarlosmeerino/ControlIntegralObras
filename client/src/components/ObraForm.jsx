import { useState } from 'react';
import { useApp } from '../lib/app.jsx';
import { post, put } from '../lib/api.js';
import { Sheet, Field, Selector } from './ui.jsx';
import * as f from '../lib/format.js';
import ClientePicker from './ClientePicker.jsx';
import CiudadPicker from './CiudadPicker.jsx';

const toKg = (v) => { const n = f.parseNum(v); return n == null ? 0 : n * 1000; };
const toT = (kg) => (kg ? String(Number(kg) / 1000).replace('.', ',') : '');

/** Alta y edición de proyecto: solo lo esencial. El código se genera solo si se deja vacío. */
export default function ObraForm({ obra, clientes = [], cliente = '', onClose, onSaved }) {
  const { toast, toastError, can } = useApp();
  const [d, setD] = useState(() => obra
    ? { ...obra, toneladas: toT(obra.kg_previstos_fab), presupuesto: obra.presupuesto ? String(obra.presupuesto).replace('.', ',') : '' }
    : { codigo: '', nombre: '', cliente, ciudad: '', provincia: '', direccion: '', fecha_inicio: f.hoyISO(), fecha_entrega: '', toneladas: '', presupuesto: '', estado: 'en_curso', observaciones: '' });
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async (e) => {
    e?.preventDefault();
    if (!d.nombre.trim() || !d.cliente.trim()) return toastError(new Error('Indica al menos el nombre del proyecto y el cliente.'));
    setBusy(true);
    try {
      const kg = toKg(d.toneladas);
      const body = { ...d, kg_contratados: obra?.kg_contratados || kg, kg_previstos_fab: kg, kg_previstos_montaje: kg, presupuesto: f.parseNum(d.presupuesto) || 0 };
      const r = obra ? await put(`/obras/${obra.id}`, body) : await post('/obras', body);
      toast(obra ? 'Proyecto actualizado.' : `Proyecto ${r.codigo} creado.`);
      onSaved?.(r); onClose();
    } catch (er) { toastError(er); } finally { setBusy(false); }
  };
  return (
    <Sheet title={obra ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>{obra ? 'Guardar' : 'Crear proyecto'}</button></>}>
      <form className="form-grid" onSubmit={guardar}>
        <Field label="Nombre del proyecto" full><input className="input" value={d.nombre} onChange={s('nombre')} placeholder="Ej.: Nave industrial Plaza" autoFocus={!obra} /></Field>
        <Field label="Cliente"><ClientePicker value={d.cliente} onChange={(c) => setD({ ...d, cliente: c })} /></Field>
        <Field label="Ciudad"><CiudadPicker value={{ ciudad: d.ciudad, provincia: d.provincia }} onChange={(c) => setD({ ...d, ...c })} /></Field>
        <Field label="Dirección de montaje" full><input className="input" value={d.direccion} onChange={s('direccion')} /></Field>
        <Field label="Inicio"><input type="date" className="input" value={d.fecha_inicio || ''} onChange={s('fecha_inicio')} /></Field>
        <Field label="Entrega"><input type="date" className="input" value={d.fecha_entrega || ''} onChange={s('fecha_entrega')} /></Field>
        <Field label="Toneladas previstas"><input className="input" inputMode="decimal" value={d.toneladas} onChange={s('toneladas')} placeholder="Ej.: 120,5" /></Field>
        {can('costes.ver') && <Field label="Presupuesto (€)"><input className="input" inputMode="decimal" value={d.presupuesto} onChange={s('presupuesto')} /></Field>}
        {obra && <>
          <Field label="Estado"><Selector titulo="Estado del proyecto" value={d.estado} onChange={(v) => setD({ ...d, estado: v })} options={Object.entries(f.ESTADOS_OBRA).map(([k, v]) => [k, v.label])} /></Field>
          <Field label="Código"><input className="input mono" value={d.codigo} onChange={s('codigo')} /></Field>
        </>}
        <Field label="Notas" full><textarea className="input" value={d.observaciones || ''} onChange={s('observaciones')} /></Field>
      </form>
    </Sheet>
  );
}
