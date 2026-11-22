import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { get, post, put, del, qs } from '../lib/api.js';
import { Sheet, Field, Selector, Empty } from './ui.jsx';
import { Lupa } from './iconos.jsx';
import IconoPieza, { FAMILIAS, GRUPOS, UNIDAD } from './IconoPieza.jsx';
import * as f from '../lib/format.js';

export const pesoTxt = (p) => `${f.num(p.peso, p.peso < 10 ? 2 : 1)} ${UNIDAD[p.unidad]}`;

/** Buscador del registro: texto + familia, con iconos de sección */
export function ListaRegistro({ onElegir, accesorio, autoFocus, recargar = 0 }) {
  const [q, setQ] = useState('');
  const [familia, setFamilia] = useState('');
  const [items, setItems] = useState(null);
  const ref = useRef();
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 320); }, [autoFocus]);
  const [cuentas, setCuentas] = useState([]);
  const portada = !q.trim() && !familia;
  useEffect(() => { get('/catalogo/familias').then(setCuentas).catch(() => {}); }, [recargar]);
  useEffect(() => {
    if (portada) { setItems([]); return undefined; }
    setItems(null);
    const ac = new AbortController();
    const t = setTimeout(() => get(`/catalogo${qs({ q: q.trim(), ...(familia === 'propia' ? { propias: 1 } : { familia }), limite: 400 })}`, { signal: ac.signal }).then(setItems).catch(() => {}), 160);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, familia, recargar, portada]);
  const ORDEN = GRUPOS.flatMap(([, fs]) => fs);
  const grupos = useMemo(() => {
    const m = new Map();
    for (const p of items || []) { const k = p.personalizada ? 'propia' : p.familia; (m.get(k) || m.set(k, []).get(k)).push(p); }
    const pos = (k) => (k === 'propia' ? -1 : ORDEN.indexOf(k) === -1 ? 999 : ORDEN.indexOf(k));
    return [...m.entries()].sort((a, b) => pos(a[0]) - pos(b[0])).map(([k, ps]) => [k === 'propia' ? 'Mis piezas' : FAMILIAS[k] || k, ps]);
  }, [items]);
  const n = Object.fromEntries(cuentas.map((c) => [c.familia, c.n]));
  return (
    <>
      <div className="picker-buscar" style={{ margin: '0 0 10px' }}>
        <Lupa size={18} />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: IPE 300, tubo 100x100, chapa 10…" aria-label="Buscar pieza" type="search" />
      </div>
      <div className="familias">
        <button type="button" className={`chip ${!familia ? 'on' : ''}`} onClick={() => setFamilia('')}>Todas</button>
        {GRUPOS.flatMap(([, fs]) => fs).map((k) => (
          <button key={k} type="button" className={`chip chip-icono ${familia === k ? 'on' : ''}`} onClick={() => setFamilia(familia === k ? '' : k)}>
            <IconoPieza familia={k} size={22} />{FAMILIAS[k]}
          </button>
        ))}
      </div>
      {portada ? (
        <>
          {n.propia > 0 && <button type="button" className="ficha-familia propia" onClick={() => setFamilia('propia')}><IconoPieza familia="propia" size={44} /><b>Mis piezas</b><span>{n.propia}</span></button>}
          {GRUPOS.map(([g, fs]) => (
            <div key={g}>
              <div className="picker-letra">{g}</div>
              <div className="fichas-familia">
                {fs.filter((k) => n[k]).map((k) => (
                  <button key={k} type="button" className="ficha-familia" onClick={() => setFamilia(k)}>
                    <IconoPieza familia={k} size={44} /><b>{FAMILIAS[k]}</b><span>{n[k]} piezas</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : !items ? <div className="spinner" /> : !items.length ? <Empty title="No hay piezas con esa búsqueda" /> : grupos.map(([g, ps]) => (
        <div key={g}>
          <div className="picker-letra">{g}</div>
          <div className="picker-grupo">
            {ps.map((p) => (
              <button key={p.id} type="button" className="picker-fila" onClick={() => onElegir?.(p)}>
                <IconoPieza familia={p.familia} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="picker-nombre">{p.designacion}</span>
                  <span className="picker-sub">{[pesoTxt(p), p.dimensiones, p.norma].filter(Boolean).join(' · ')}</span>
                </span>
                {accesorio ? accesorio(p) : <ChevronRight size={18} className="muted" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Alta / edición de una pieza propia del registro */
export function PiezaPropiaForm({ pieza, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [d, setD] = useState(pieza ? { ...pieza, peso: String(pieza.peso).replace('.', ',') } : { designacion: '', familia: 'propia', unidad: 'ud', peso: '', dimensiones: '' });
  const guardar = async () => {
    try {
      const body = { ...d, peso: f.parseNum(d.peso) };
      const r = pieza ? await put(`/catalogo/${pieza.id}`, body) : await post('/catalogo', body);
      toast(pieza ? 'Pieza actualizada.' : `«${r.designacion}» añadida al registro.`); onSaved?.(r); onClose();
    } catch (e) { toastError(e); }
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar «${pieza.designacion}» del registro?`)) return;
    try { await del(`/catalogo/${pieza.id}`); toast('Pieza eliminada del registro.'); onSaved?.(null); onClose(); } catch (e) { toastError(e); }
  };
  return (
    <Sheet title={pieza ? 'Editar pieza' : 'Nueva pieza'} onClose={onClose}
      footer={<>{pieza && <button className="btn danger" onClick={borrar}>Eliminar</button>}<span className="grow hide-m" /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <div className="full row" style={{ gap: 14 }}><IconoPieza familia={d.familia} size={56} /><div className="muted small">Se guardará en el registro para usarla en cualquier proyecto.</div></div>
        <Field label="Nombre de la pieza" full><input className="input" value={d.designacion} onChange={(e) => setD({ ...d, designacion: e.target.value })} placeholder="Ej.: Placa base pilar P-01, Cartela 200x200x10" autoFocus /></Field>
        <Field label="Tipo"><Selector titulo="Tipo de pieza" value={d.familia} onChange={(v) => setD({ ...d, familia: v })} options={Object.entries(FAMILIAS).map(([k, v]) => ({ value: k, label: v }))} /></Field>
        <Field label="Se mide por"><Selector titulo="Unidad de medida" value={d.unidad} onChange={(v) => setD({ ...d, unidad: v })} options={[{ value: 'ud', label: 'Unidad', sub: 'Peso de cada pieza' }, { value: 'm', label: 'Metro lineal', sub: 'Peso por metro (perfiles, tubos)' }, { value: 'm2', label: 'Metro cuadrado', sub: 'Peso por m² (chapas, rejillas)' }]} /></Field>
        <Field label={`Peso (${UNIDAD[d.unidad]})`}><input className="input" inputMode="decimal" value={d.peso} onChange={(e) => setD({ ...d, peso: e.target.value })} placeholder="0" /></Field>
        <Field label="Dimensiones (opcional)"><input className="input" value={d.dimensiones} onChange={(e) => setD({ ...d, dimensiones: e.target.value })} placeholder="300 × 300 × 20 mm" /></Field>
      </div>
    </Sheet>
  );
}

/** Pantalla «Registro de piezas» */
export default function Registro() {
  const { can } = useApp();
  const [form, setForm] = useState(null);
  const [n, setN] = useState(0);
  return (
    <>
      <div className="page-head">
        <div><h1>Registro de piezas</h1><p>Perfiles normalizados con su peso y tus piezas propias. Úsalas en cualquier proyecto.</p></div>
        {can('piezas.editar') && <button className="btn primary big" onClick={() => setForm({})}><Plus size={22} />Nueva pieza</button>}
      </div>
      <ListaRegistro recargar={n} onElegir={(p) => (p.personalizada && can('piezas.editar') ? setForm(p) : null)}
        accesorio={(p) => (p.personalizada ? <span className="badge info">Propia</span> : <span className="muted xs">{p.norma}</span>)} />
      {form && <PiezaPropiaForm pieza={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => setN((x) => x + 1)} />}
    </>
  );
}
