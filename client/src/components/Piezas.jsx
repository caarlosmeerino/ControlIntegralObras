import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, QrCode, CheckSquare, Square, Layers, AlertTriangle, Search, X } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { post, put, del } from '../lib/api.js';
import { DataTable, Status, Bar, Sheet, Field, toneOf } from './ui.jsx';
import { AvanceSheet, BotonAvance } from './Avance.jsx';
import * as f from '../lib/format.js';

export function PiezaForm({ obraId, pieza, onClose, onSaved }) {
  const { toast, toastError, can } = useApp();
  const [d, setD] = useState(pieza ? { ...pieza, peso_unitario_kg: String(pieza.peso_unitario_kg).replace('.', ',') } : { marca: '', elemento: 'pilar', perfil: '', plano: '', peso_unitario_kg: '', cantidad: 1, observaciones: '' });
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const peso = f.parseNum(d.peso_unitario_kg) || 0;
  const guardar = async () => {
    setBusy(true);
    try {
      const body = { ...d, obra_id: obraId, peso_unitario_kg: f.parseNum(d.peso_unitario_kg), cantidad: Number(d.cantidad) };
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
        <Field label="Elemento"><select className="input" value={d.elemento} onChange={s('elemento')}>{Object.entries(f.ELEMENTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Perfil"><input className="input" value={d.perfil} onChange={s('perfil')} placeholder="HEB-300" /></Field>
        <Field label="Plano asociado"><input className="input" value={d.plano} onChange={s('plano')} placeholder="E-101" /></Field>
        <Field label="Peso unitario (kg) *"><input className="input" inputMode="decimal" value={d.peso_unitario_kg} onChange={s('peso_unitario_kg')} placeholder="1.250" /></Field>
        <Field label="Cantidad *"><input className="input" inputMode="numeric" type="number" min="1" value={d.cantidad} onChange={s('cantidad')} /></Field>
        <div className="full banner info">Peso de la marca: <b className="num">{f.kg(peso * (Number(d.cantidad) || 0))}</b> ({f.t(peso * (Number(d.cantidad) || 0))})</div>
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
    try { const r = await post('/piezas/importar', { obra_id: obraId, texto }); toast(`Importación correcta: ${r.creadas} nuevas, ${r.actualizadas} actualizadas (${f.t(r.kg)}).`); onDone(); onClose(); }
    catch (e) { setErrores(e.data?.errores || []); toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Importar listado de piezas" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !texto.trim()} onClick={enviar}><Upload />Importar</button></>}>
      <p className="muted">Copia las filas desde Excel o del listado de despiece y pégalas aquí. Columnas, en este orden:</p>
      <div className="code mb" style={{ display: 'block', padding: 10 }}>marca · elemento · perfil · plano · peso unitario (kg) · cantidad · observaciones</div>
      <textarea className="input mono" style={{ minHeight: 220 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'P-01\tpilar\tHEB-300\tE-101\t1250\t4\nV-01\tviga\tIPE-400\tE-102\t1100\t6'} />
      <div className="hint mt-s">Si una marca ya existe se actualizan sus datos. Separadores admitidos: tabulador, punto y coma o coma.</div>
      {errores.length > 0 && <div className="banner bad mt" style={{ display: 'block' }}>{errores.slice(0, 12).map((e) => <div key={e}>{e}</div>)}</div>}
    </Sheet>
  );
}

function LoteSheet({ piezas, onClose, onDone }) {
  const { toast, toastError } = useApp();
  const obras = [...new Set(piezas.map((p) => p.obra_id))];
  const fases = piezas[0].avance;
  const [modo, setModo] = useState('siguiente');
  const [fase, setFase] = useState(fases[0]?.fase_id);
  const [busy, setBusy] = useState(false);
  const kg = piezas.reduce((s, p) => s + p.unidades_disponibles * p.peso_unitario_kg, 0);
  const enviar = async () => {
    setBusy(true);
    try {
      const r = await post('/piezas/lote/avance', { ids: piezas.map((p) => p.id), hasta_fase_id: modo === 'hasta' ? Number(fase) : undefined });
      toast(r.mensaje); onDone(); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title={`Avance en lote · ${piezas.length} pieza(s)`} onClose={onClose}
      footer={<><button className="btn big" onClick={onClose}>Cancelar</button><button className="btn big ok" disabled={busy} onClick={enviar}>Confirmar</button></>}>
      <div className="stack">
        <label className="check"><input type="radio" name="m" checked={modo === 'siguiente'} onChange={() => setModo('siguiente')} />
          <span>Completar la <b>fase actual</b> de cada pieza (todas sus unidades disponibles) · {f.t(kg)}</span></label>
        {obras.length === 1 && <label className="check"><input type="radio" name="m" checked={modo === 'hasta'} onChange={() => setModo('hasta')} /><span>Llevar todas las piezas <b>hasta</b> una fase (rellena las anteriores)</span></label>}
        {modo === 'hasta' && <Field label="Hasta la fase (incluida)"><select className="input" value={fase} onChange={(e) => setFase(e.target.value)}>{fases.map((a) => <option key={a.fase_id} value={a.fase_id}>{a.orden}. {a.nombre}</option>)}</select></Field>}
        <div className="small muted">{piezas.map((p) => p.marca).join(', ')}</div>
      </div>
    </Sheet>
  );
}

/** Lista de piezas con búsqueda, filtros, avance rápido, selección múltiple, alta e importación. */
export function PiezasTabla({ piezas, obraId, reload, mostrarObra, filtrosFase = true, initialQ = '' }) {
  const { can } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState(initialQ);
  const [estado, setEstado] = useState('');
  const [fase, setFase] = useState('');
  const [avance, setAvance] = useState(null);
  const [form, setForm] = useState(null);
  const [imp, setImp] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [lote, setLote] = useState(false);
  const fasesDisp = useMemo(() => {
    const m = new Map(); piezas.forEach((p) => p.avance.forEach((a) => m.set(a.nombre, a.orden))); return [...m.entries()].sort((a, b) => a[1] - b[1]);
  }, [piezas]);
  const lista = piezas.filter((p) => (!q || `${p.marca} ${p.perfil} ${p.plano} ${p.obra_codigo}`.toLowerCase().includes(q.toLowerCase()))
    && (!estado || p.estado === estado) && (!fase || (fase === '__fin' ? !p.fase_actual_id : p.fase_actual_nombre === fase)));
  const toggle = (id) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const totalKg = lista.reduce((s, p) => s + p.peso_total_kg, 0);
  const puedeAvanzar = can('avance.taller', 'avance.obra', 'avance.oficina');
  const cols = [
    puedeAvanzar && { key: 'sel', label: '', width: 44, render: (p) => <button className="btn ghost icon sm" onClick={(e) => { e.stopPropagation(); toggle(p.id); }} aria-label="Seleccionar">{sel.has(p.id) ? <CheckSquare style={{ color: 'var(--primary)' }} /> : <Square />}</button> },
    { key: 'marca', label: 'Marca', render: (p) => <><span className="marca">{p.marca}</span>{p.incidencia && <AlertTriangle size={16} style={{ color: 'var(--bad)', marginLeft: 6, verticalAlign: -2 }} />}</> },
    mostrarObra && { key: 'obra', label: 'Obra', render: (p) => <span className="code">{p.obra_codigo}</span> },
    { key: 'elemento', label: 'Elemento', render: (p) => <>{f.ELEMENTOS[p.elemento]}<div className="xs muted">{p.perfil}</div></> },
    { key: 'plano', label: 'Plano' },
    { key: 'cantidad', label: 'Ud', num: true },
    { key: 'peso', label: 'Peso ud', num: true, render: (p) => f.kg(p.peso_unitario_kg) },
    { key: 'total', label: 'Peso total', num: true, render: (p) => <b>{f.kg(p.peso_total_kg)}</b> },
    { key: 'fase', label: 'Fase actual', render: (p) => <><div className="small strong">{p.fase_actual_orden ? `${p.fase_actual_orden}. ` : ''}{p.fase_actual_nombre}</div>{p.fase_actual_id && <div className="xs muted">{p.unidades_completadas_fase}/{p.cantidad} ud completadas</div>}</> },
    { key: 'prog', label: 'Progreso', width: 120, render: (p) => <Bar value={p.progreso} tone={toneOf(p.estado) === 'idle' ? '' : toneOf(p.estado)} /> },
    { key: 'estado', label: 'Estado', render: (p) => <Status estado={p.estado} small /> },
    puedeAvanzar && { key: 'acc', label: '', render: (p) => <BotonAvance pieza={p} onClick={setAvance} /> },
  ].filter(Boolean);
  const actualizar = (np) => { reload?.(np); };
  return (
    <>
      <div className="row wrap mb">
        <div className="search" style={{ maxWidth: 320 }}><Search size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marca, perfil, plano…" aria-label="Filtrar piezas" /></div>
        <select className="input" style={{ width: 'auto' }} value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>{Object.entries(f.ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {filtrosFase && <select className="input" style={{ width: 'auto' }} value={fase} onChange={(e) => setFase(e.target.value)} aria-label="Fase actual">
          <option value="">Todas las fases</option>{fasesDisp.map(([n, o]) => <option key={n} value={n}>{o}. {n}</option>)}<option value="__fin">Terminadas</option>
        </select>}
        <span className="grow" />
        {obraId && can('piezas.editar') && <><button className="btn" onClick={() => setImp(true)}><Upload size={18} />Importar</button><button className="btn primary" onClick={() => setForm({})}><Plus size={18} />Nueva pieza</button></>}
        {obraId && <button className="btn" onClick={() => nav(`/obras/${obraId}/etiquetas${sel.size ? `?ids=${[...sel].join(',')}` : ''}`)}><QrCode size={18} />Etiquetas QR</button>}
      </div>
      {sel.size > 0 && (
        <div className="banner info row wrap">
          <Layers size={20} /><b>{sel.size} seleccionada(s)</b><span className="grow" />
          <button className="btn sm" onClick={() => setSel(new Set(lista.map((p) => p.id)))}>Seleccionar las {lista.length}</button>
          <button className="btn sm" onClick={() => setSel(new Set())}><X size={16} />Quitar</button>
          <button className="btn sm primary" onClick={() => setLote(true)}>Avance en lote</button>
        </div>
      )}
      <div className="small muted mb">{f.plural(lista.length, 'marca')} · {f.num(lista.reduce((s, p) => s + p.cantidad, 0))} unidades · <b>{f.kg(totalKg)}</b> ({f.t(totalKg)})</div>
      <div className="card pad0" style={{ border: 0, boxShadow: 'none', background: 'transparent' }}>
        <DataTable columns={cols} rows={lista} empty="No hay piezas con estos filtros." onRow={(p) => nav(`/piezas/${p.id}`)} selected={(p) => sel.has(p.id)}
          card={(p) => (
            <>
              <div className="row">
                {puedeAvanzar && <button className="btn ghost icon" onClick={(e) => { e.stopPropagation(); toggle(p.id); }} aria-label="Seleccionar">{sel.has(p.id) ? <CheckSquare style={{ color: 'var(--primary)' }} /> : <Square />}</button>}
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}><span className="marca">{p.marca}</span>{mostrarObra && <span className="code">{p.obra_codigo}</span>}{p.incidencia && <AlertTriangle size={16} style={{ color: 'var(--bad)' }} />}</div>
                  <div className="small muted">{f.ELEMENTOS[p.elemento]} {p.perfil} · {p.cantidad} ud · <b>{f.kg(p.peso_total_kg)}</b></div>
                </div>
                <Status estado={p.estado} small />
              </div>
              <div><div className="row between small"><span className="strong">{p.fase_actual_orden ? `${p.fase_actual_orden}. ` : ''}{p.fase_actual_nombre}</span><span className="muted">{p.fase_actual_id ? `${p.unidades_completadas_fase}/${p.cantidad} ud` : ''}</span></div>
                <div className="mt-s"><Bar value={p.progreso} tone={toneOf(p.estado) === 'idle' ? '' : toneOf(p.estado)} /></div></div>
              {puedeAvanzar && p.fase_actual_id && <BotonAvance pieza={p} onClick={setAvance} block />}
            </>
          )} />
      </div>
      {avance && <AvanceSheet pieza={avance} onClose={() => setAvance(null)} onDone={actualizar} />}
      {form && <PiezaForm obraId={obraId} pieza={form.id ? form : null} onClose={() => setForm(null)} onSaved={actualizar} />}
      {imp && <ImportSheet obraId={obraId} onClose={() => setImp(false)} onDone={() => reload?.()} />}
      {lote && <LoteSheet piezas={piezas.filter((p) => sel.has(p.id))} onClose={() => setLote(false)} onDone={() => { setSel(new Set()); reload?.(); }} />}
    </>
  );
}
