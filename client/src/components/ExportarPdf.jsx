import { useState } from 'react';
import { FileDown, Check } from 'lucide-react';
import { Sheet, Field, Selector } from './ui.jsx';
import { qs } from '../lib/api.js';
import * as f from '../lib/format.js';

const TIPOS = [
  { id: 'fabricar', label: 'Fabricar', sub: 'Orden de fabricación' },
  { id: 'material', label: 'Material', sub: 'Pendiente de recibir' },
  { id: 'montar', label: 'Montar', sub: 'Piezas por montar' },
  { id: 'tareas', label: 'Tareas', sub: 'Checklist de las fases' },
];

/**
 * Tarjeta para elegir qué va en el PDF antes de descargarlo.
 * rango(cuando) devuelve { desde, hasta, txt } para las opciones rápidas.
 */
export default function ExportarPdf({ inicial, obras, empleados, rango, onClose }) {
  const [tipos, setTipos] = useState(new Set([inicial.tipo === 'tareas' ? 'tareas' : inicial.tipo || 'fabricar']));
  const [cuando, setCuando] = useState(inicial.cuando || 'semana');
  const R0 = rango(inicial.cuando || 'semana');
  const [desde, setDesde] = useState(R0.desde || f.hoyISO());
  const [hasta, setHasta] = useState(R0.hasta || f.hoyISO());
  const [sel, setSel] = useState(new Set(inicial.obra ? [String(inicial.obra)] : [])); // vacío = todas
  const [emp, setEmp] = useState(inicial.empleado || '');

  const toggle = (set, setter, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n); };
  const R = cuando === 'fechas'
    ? { desde, hasta, txt: desde && hasta ? `Del ${f.fecha(desde)} al ${f.fecha(hasta)}` : '' }
    : rango(cuando);
  const empSel = (empleados || []).find((x) => String(x.id) === emp);
  const fechasMal = cuando === 'fechas' && (!desde || !hasta || desde > hasta);
  const orden = TIPOS.map((t) => t.id).filter((t) => tipos.has(t));
  const href = `/api/pendiente/pdf${qs({
    tipos: orden.join(','), desde: R.desde, hasta: R.hasta, periodo: R.txt,
    obra_ids: sel.size ? [...sel].join(',') : '', empleado_id: emp, empleado_nombre: empSel?.nombre,
  })}`;
  const activas = (obras || []).filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado));

  return (
    <Sheet title="Exportar PDF" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button>
        {orden.length && !fechasMal
          ? <a className="btn primary" href={href} target="_blank" rel="noopener" onClick={() => setTimeout(onClose, 300)}><FileDown size={18} />Descargar PDF</a>
          : <button className="btn primary" disabled><FileDown size={18} />Descargar PDF</button>}</>}>
      <div className="stack" style={{ gap: 20 }}>
        <div>
          <div className="field-label mb-s">¿Qué quieres incluir?</div>
          <div className="pasos-pieza">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" className={`paso-pieza ${tipos.has(t.id) ? 'on' : ''}`} onClick={() => toggle(tipos, setTipos, t.id)} aria-pressed={tipos.has(t.id)}>
                <span className="paso-check">{tipos.has(t.id) ? <Check size={14} strokeWidth={3} /> : ''}</span>
                <span><b>{t.label}</b><small>{t.sub}</small></span>
              </button>
            ))}
          </div>
          {!orden.length && <div className="xs mt-s" style={{ color: 'var(--bad-txt)' }}>Elige al menos una lista.</div>}
        </div>

        <div className="form-grid">
          <Field label="Fechas" full>
            <Selector titulo="Fechas" value={cuando} onChange={setCuando} options={[
              { value: 'semana', label: 'Esta semana' }, { value: 'proxima', label: 'Próxima semana' }, { value: 'dos', label: 'Esta semana y la próxima' },
              { value: 'mes', label: 'Este mes' }, { value: 'fechas', label: 'Elegir fechas…', sub: 'Desde un día hasta otro' },
              { value: 'todo', label: 'Todo lo pendiente', sub: 'Sin tener en cuenta las fechas' }]} />
          </Field>
          {cuando === 'fechas' && <>
            <Field label="Desde"><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
            <Field label="Hasta"><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
          </>}
          {fechasMal && <div className="full xs" style={{ color: 'var(--bad-txt)' }}>La fecha «hasta» tiene que ser igual o posterior a «desde».</div>}
          {empleados && (
            <Field label="Empleado" full>
              <Selector titulo="Empleado" value={emp} onChange={setEmp} placeholder="Todos los empleados"
                options={[{ value: '', label: 'Todos los empleados' }, ...empleados.filter((x) => x.activo).map((x) => ({ value: String(x.id), label: x.nombre }))]} />
            </Field>
          )}
        </div>

        <div>
          <div className="row between mb-s"><span className="field-label">Obras</span>
            <span className="xs muted">{sel.size ? `${sel.size} elegida(s)` : 'Todas'}</span></div>
          <div className="lista lista-obras-pdf">
            <button type="button" className={`lista-fila elegible ${!sel.size ? 'on' : ''}`} onClick={() => setSel(new Set())} aria-pressed={!sel.size}>
              <span className="grow"><b>Todas las obras en curso</b></span>
              <span className="marcador">{!sel.size && <Check size={16} strokeWidth={3} />}</span>
            </button>
            {activas.map((o) => (
              <button key={o.id} type="button" className={`lista-fila elegible ${sel.has(String(o.id)) ? 'on' : ''}`} onClick={() => toggle(sel, setSel, String(o.id))} aria-pressed={sel.has(String(o.id))}>
                <span className="grow" style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{o.nombre}</b><small className="muted">{[o.cliente, o.ciudad].filter(Boolean).join(' · ')}</small></span>
                <span className="marcador">{sel.has(String(o.id)) && <Check size={16} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="small muted">El PDF saldrá con: {orden.map((t) => TIPOS.find((x) => x.id === t).label.toLowerCase()).join(', ') || '—'} · {R.txt || '—'}{empSel ? ` · ${empSel.nombre}` : ''}.</div>
      </div>
    </Sheet>
  );
}
