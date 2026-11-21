import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { post, put, del } from '../lib/api.js';
import { Sheet, Field, Selector } from './ui.jsx';
import * as f from '../lib/format.js';

export function PiezaForm({ obraId, pieza, onClose, onSaved }) {
  const { toast, toastError, can } = useApp();
  const [d, setD] = useState(pieza ? { ...pieza, peso_unitario_kg: String(pieza.peso_unitario_kg).replace('.', ','), m2_unitario: pieza.m2_unitario ? String(pieza.m2_unitario).replace('.', ',') : '', ml_unitario: pieza.ml_unitario ? String(pieza.ml_unitario).replace('.', ',') : '' } : { marca: '', elemento: 'pilar', perfil: '', plano: '', peso_unitario_kg: '', cantidad: 1, observaciones: '' });
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const peso = f.parseNum(d.peso_unitario_kg) || 0;
  const guardar = async () => {
    setBusy(true);
    try {
      const body = { ...d, obra_id: obraId, peso_unitario_kg: f.parseNum(d.peso_unitario_kg), m2_unitario: f.parseNum(d.m2_unitario) || 0, ml_unitario: f.parseNum(d.ml_unitario) || 0, cantidad: Number(d.cantidad) };
      const r = pieza ? await put(`/piezas/${pieza.id}`, body) : await post('/piezas', body);
      toast(pieza ? `Pieza ${r.marca} actualizada.` : `Pieza ${r.marca} creada: ${f.kg(r.peso_total_kg)}.`);
      onSaved?.(r); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar la pieza ${pieza.marca}? Esta acción no se puede deshacer.`)) return;
    try { await del(`/piezas/${pieza.id}`); toast(`Pieza ${pieza.marca} eliminada.`); onSaved?.(null); onClose(); } catch (e) { toastError(e); }
  };
  return (
    <Sheet title={pieza ? `Editar ${pieza.marca}` : 'Nueva pieza'} onClose={onClose}
      footer={<>{pieza && can('piezas.editar') && <button className="btn danger" onClick={borrar}>Eliminar</button>}<span className="grow hide-m" /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Marca / referencia *"><input className="input mono" value={d.marca} onChange={s('marca')} placeholder="P-01" autoFocus={!pieza} /></Field>
        <Field label="Elemento"><Selector titulo="Tipo de elemento" value={d.elemento} onChange={(v) => setD({ ...d, elemento: v })} options={Object.entries(f.ELEMENTOS)} /></Field>
        <Field label="Perfil"><input className="input" value={d.perfil} onChange={s('perfil')} placeholder="HEB-300" /></Field>
        <Field label="Plano asociado"><input className="input" value={d.plano} onChange={s('plano')} placeholder="E-101" /></Field>
        <Field label="Peso unitario (kg) *"><input className="input" inputMode="decimal" value={d.peso_unitario_kg} onChange={s('peso_unitario_kg')} placeholder="1.250" /></Field>
        <Field label="Cantidad *"><input className="input" inputMode="numeric" type="number" min="1" value={d.cantidad} onChange={s('cantidad')} /></Field>
        <Field label="Superficie por unidad (m²)"><input className="input" inputMode="decimal" value={d.m2_unitario ?? ''} onChange={s('m2_unitario')} placeholder="0" /></Field>
        <Field label="Longitud por unidad (ml)"><input className="input" inputMode="decimal" value={d.ml_unitario ?? ''} onChange={s('ml_unitario')} placeholder="0" /></Field>
        <div className="full banner info">Total de la marca: <b className="num">{f.kg(peso * (Number(d.cantidad) || 0))}</b> · <b className="num">{f.m2((f.parseNum(d.m2_unitario) || 0) * (Number(d.cantidad) || 0))}</b> · <b className="num">{f.ml((f.parseNum(d.ml_unitario) || 0) * (Number(d.cantidad) || 0))}</b></div>
        {pieza && <>
          <Field label="Fecha de fabricación"><input type="date" className="input" value={d.fecha_fabricacion || ''} onChange={s('fecha_fabricacion')} /></Field>
          <Field label="Fecha de expedición"><input type="date" className="input" value={d.fecha_expedicion || ''} onChange={s('fecha_expedicion')} /></Field>
          <Field label="Fecha de montaje"><input type="date" className="input" value={d.fecha_montaje || ''} onChange={s('fecha_montaje')} /></Field>
          <label className="check"><input type="checkbox" checked={!!d.incidencia} onChange={s('incidencia')} />Marcar con incidencia</label>
        </>}
        <Field label="Observaciones" full><textarea className="input" value={d.observaciones} onChange={s('observaciones')} /></Field>
      </div>
    </Sheet>
  );
}

export function ImportSheet({ obraId, onClose, onDone }) {
  const { toast, toastError } = useApp();
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState([]);
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    setBusy(true); setErrores([]);
    try { const r = await post('/piezas/importar', { obra_id: obraId, texto }); toast(`Importación correcta: ${r.creadas} nuevas, ${r.actualizadas} actualizadas (${f.kg(r.kg)}).`); onDone(); onClose(); }
    catch (e) { setErrores(e.data?.errores || []); toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Importar listado de piezas" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !texto.trim()} onClick={enviar}><Upload />Importar</button></>}>
      <p className="muted">Copia las filas desde Excel o del listado de despiece y pégalas aquí. Columnas, en este orden:</p>
      <div className="code mb" style={{ display: 'block', padding: 10 }}>marca · elemento · perfil · plano · peso por unidad (kg) · cantidad · m² por unidad · ml por unidad · observaciones</div>
      <textarea className="input mono" style={{ minHeight: 220 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'P-01\tpilar\tHEB-300\tE-101\t1250\t4\t9,6\t8\nV-01\tviga\tIPE-400\tE-102\t1100\t6\t12,4\t16'} />
      <div className="hint mt-s">Si una marca ya existe se actualizan sus datos. Separadores admitidos: tabulador, punto y coma o coma.</div>
      {errores.length > 0 && <div className="banner bad mt" style={{ display: 'block' }}>{errores.slice(0, 12).map((e) => <div key={e}>{e}</div>)}</div>}
    </Sheet>
  );
}
