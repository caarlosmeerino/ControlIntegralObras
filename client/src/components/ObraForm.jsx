import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { post, put } from '../lib/api.js';
import { Sheet, Field, Selector } from './ui.jsx';
import * as f from '../lib/format.js';
import ClientePicker from './ClientePicker.jsx';
import CiudadPicker from './CiudadPicker.jsx';
import DireccionPicker from './DireccionPicker.jsx';

const aTexto = (n) => (n ? String(n).replace('.', ',') : '');
const nuevaFase = (i) => ({ nombre: `Fase ${i}`, fecha_inicio: '', fecha_fin: '' });

/** Alta y edición de proyecto: datos, ubicación, medición (kg · m² · ml) y fases con sus fechas. */
export default function ObraForm({ obra, cliente = '', onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [d, setD] = useState(() => obra
    ? { ...obra, kg: aTexto(obra.kg_previstos_fab), m2: aTexto(obra.m2_previstos), ml: aTexto(obra.ml_previstos) }
    : { codigo: '', nombre: '', cliente, ciudad: '', provincia: '', direccion: '', codigo_postal: '', lat: null, lng: null, kg: '', m2: '', ml: '', estado: 'en_curso', observaciones: '' });
  const [fases, setFases] = useState(() => (obra?.etapas?.length ? obra.etapas.map((e) => ({ nombre: e.nombre, fecha_inicio: e.fecha_inicio || '', fecha_fin: e.fecha_fin || '' })) : [{ ...nuevaFase(1), fecha_inicio: f.hoyISO() }]));
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const fase = (i, k) => (e) => setFases(fases.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));

  const guardar = async (e) => {
    e?.preventDefault();
    if (!d.nombre.trim() || !d.cliente.trim()) return toastError(new Error('Indica al menos el nombre del proyecto y el cliente.'));
    const mala = fases.find((x) => x.fecha_inicio && x.fecha_fin && x.fecha_fin < x.fecha_inicio);
    if (mala) return toastError(new Error(`En «${mala.nombre}» la fecha de fin es anterior a la de inicio.`));
    setBusy(true);
    try {
      const kg = f.parseNum(d.kg) || 0;
      const { solo_texto: _manual, ...datos } = d;
      const body = { ...datos, kg_contratados: kg, kg_previstos_fab: kg, kg_previstos_montaje: kg, m2_previstos: f.parseNum(d.m2) || 0, ml_previstos: f.parseNum(d.ml) || 0,
        etapas: fases.map((x, i) => ({ ...x, nombre: x.nombre.trim() || `Fase ${i + 1}` })) };
      const r = obra ? await put(`/obras/${obra.id}`, body) : await post('/obras', body);
      toast(obra ? 'Proyecto actualizado.' : `Proyecto ${r.codigo} creado.`);
      onSaved?.(r); onClose();
    } catch (er) { toastError(er); } finally { setBusy(false); }
  };

  return (
    <Sheet title={obra ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={guardar}>{obra ? 'Guardar' : 'Crear proyecto'}</button></>}>
      <form className="form-grid" onSubmit={guardar}>
        <div className="form-seccion full" style={{ marginTop: 0 }}>Ubicación de la obra</div>
        <Field label="Dirección" full hint="Al elegirla se rellenan la ciudad, el código postal y la ubicación para Google Maps.">
          <DireccionPicker value={d} onChange={(v) => setD({ ...d, ...v })} />
        </Field>
        <Field label="Ciudad" full><CiudadPicker value={{ ciudad: d.ciudad, provincia: d.provincia }}
          onChange={(c) => setD({ ...d, ...c, ...(c.ciudad !== d.ciudad ? { lat: null, lng: null, codigo_postal: '' } : {}) })} /></Field>

        <div className="form-seccion full">Proyecto</div>
        <Field label="Nombre del proyecto" full><input className="input" value={d.nombre} onChange={s('nombre')} placeholder="Ej.: Nave industrial Plaza" /></Field>
        <Field label="Cliente" full><ClientePicker value={d.cliente} onChange={(c) => setD({ ...d, cliente: c })} /></Field>

        <div className="form-seccion full">Medición prevista</div>
        <div className="full medidas">
          <label className="medida"><span>Peso</span><input className="input" inputMode="decimal" value={d.kg} onChange={s('kg')} placeholder="0" /><em>kg</em></label>
          <label className="medida"><span>Superficie</span><input className="input" inputMode="decimal" value={d.m2} onChange={s('m2')} placeholder="0" /><em>m²</em></label>
          <label className="medida"><span>Longitud</span><input className="input" inputMode="decimal" value={d.ml} onChange={s('ml')} placeholder="0" /><em>ml</em></label>
        </div>

        <div className="form-seccion full">Fases y fechas</div>
        <div className="full fases-editor">
          {fases.map((x, i) => (
            <div key={i} className="fase-item">
              <div className="row" style={{ gap: 8 }}>
                <span className="fase-num">{i + 1}</span>
                <input className="input fase-nombre" value={x.nombre} onChange={fase(i, 'nombre')} placeholder={`Fase ${i + 1}`} aria-label={`Nombre de la fase ${i + 1}`} />
                {fases.length > 1 && <button type="button" className="btn ghost icon danger" onClick={() => setFases(fases.filter((_, j) => j !== i))} aria-label={`Quitar ${x.nombre}`}><Trash2 size={18} /></button>}
              </div>
              <div className="fase-fechas">
                <label><span>Inicio</span><input type="date" className="input" value={x.fecha_inicio} onChange={fase(i, 'fecha_inicio')} /></label>
                <label><span>Fin</span><input type="date" className="input" value={x.fecha_fin} min={x.fecha_inicio || undefined} onChange={fase(i, 'fecha_fin')} /></label>
              </div>
            </div>
          ))}
          <button type="button" className="btn añadir-fase" onClick={() => setFases([...fases, { ...nuevaFase(fases.length + 1), fecha_inicio: fases[fases.length - 1]?.fecha_fin || '' }])}><Plus size={18} />Añadir fase</button>
        </div>

        {obra && <>
          <div className="form-seccion full">Otros</div>
          <Field label="Estado"><Selector titulo="Estado del proyecto" value={d.estado} onChange={(v) => setD({ ...d, estado: v })} options={Object.entries(f.ESTADOS_OBRA).map(([k, v]) => [k, v.label])} /></Field>
          <Field label="Código"><input className="input mono" value={d.codigo} onChange={s('codigo')} /></Field>
        </>}
        <Field label="Notas" full><textarea className="input" value={d.observaciones || ''} onChange={s('observaciones')} /></Field>
      </form>
    </Sheet>
  );
}
