import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, Construction, Users, Truck, AlertTriangle, Camera, Save, CheckCircle2, Circle, Sun, CloudRain, Wind, Cloud } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { get, post, api } from '../lib/api.js';
import { Loading, Field, Stepper, Seg, Empty } from '../components/ui.jsx';
import * as f from '../lib/format.js';

const LS = 'cio-ultima-obra';

function SelectorPiezas({ piezas, sel, setSel, vacio }) {
  if (!piezas.length) return <Empty title={vacio} />;
  const total = piezas.reduce((s, p) => s + p.unidades_disponibles * p.peso_unitario_kg, 0);
  const todas = piezas.every((p) => sel[p.id] === p.unidades_disponibles);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSel(todas ? {} : Object.fromEntries(piezas.map((p) => [p.id, p.unidades_disponibles])))}>
        {todas ? 'Quitar todas' : `Marcar todas (${f.t(total)})`}</button>
      {piezas.map((p) => {
        const n = sel[p.id] || 0;
        return (
          <div key={p.id} className={`item-card ${n ? 'sel' : ''}`} style={{ padding: 10 }}>
            <button className="row" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minHeight: 48, cursor: 'pointer', width: '100%' }}
              onClick={() => setSel({ ...sel, [p.id]: n ? 0 : p.unidades_disponibles })}>
              {n ? <CheckCircle2 size={30} style={{ color: 'var(--ok)', flex: 'none' }} /> : <Circle size={30} style={{ color: 'var(--idle)', flex: 'none' }} />}
              <div className="grow"><span className="marca">{p.marca}</span> <span className="small muted">{f.ELEMENTOS[p.elemento]} {p.perfil}</span>
                <div className="small muted">{p.unidades_disponibles} ud disponibles · {f.kg(p.peso_unitario_kg)}/ud</div></div>
              {n > 0 && <b className="num">{f.t(n * p.peso_unitario_kg)}</b>}
            </button>
            {n > 0 && p.unidades_disponibles > 1 && <div className="mt-s"><Stepper value={n} min={1} max={p.unidades_disponibles} onChange={(v) => setSel({ ...sel, [p.id]: v })} /></div>}
          </div>
        );
      })}
    </div>
  );
}

function Bloque({ icon: I, titulo, resumen, children, abierto, onToggle }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <button onClick={onToggle} className="row" style={{ width: '100%', background: 'none', border: 0, padding: 16, minHeight: 64, cursor: 'pointer', textAlign: 'left' }}>
        <span className="kpi-icon" style={{ width: 42, height: 42 }}><I size={22} /></span>
        <div className="grow"><div className="strong">{titulo}</div><div className="small muted">{resumen}</div></div>
        <span className="muted">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

export default function ControlObra() {
  const { user, toast, toastError } = useApp();
  const nav = useNavigate();
  const [obras, setObras] = useState(null);
  const [obra, setObra] = useState(() => { try { return localStorage.getItem(LS) || ''; } catch { return ''; } });
  const [piezas, setPiezas] = useState(null);
  const [trab, setTrab] = useState([]);
  const [medios, setMedios] = useState([]);
  const [recib, setRecib] = useState({});
  const [mont, setMont] = useState({});
  const [descargadas, setDescargadas] = useState(0);
  const [horas, setHoras] = useState({});
  const [hh, setHh] = useState(8);
  const [med, setMed] = useState({});
  const [clima, setClima] = useState('Soleado');
  const [inc, setInc] = useState('');
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState([]);
  const [fecha, setFecha] = useState(f.hoyISO());
  const [abierto, setAbierto] = useState('montadas');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/obras?activas=1').then(setObras).catch(toastError);
    get('/personal/trabajadores').then((t) => { const m = t.filter((x) => x.seccion === 'montaje'); setTrab(m); }).catch(() => {});
    get('/personal/medios').then((m) => setMedios(m.filter((x) => x.activo))).catch(() => {});
  }, [toastError]);
  useEffect(() => {
    if (!obra) return;
    try { localStorage.setItem(LS, obra); } catch { /* */ }
    setPiezas(null); setRecib({}); setMont({});
    get(`/piezas?obra_id=${obra}`).then(setPiezas).catch(toastError);
  }, [obra, toastError]);

  // Unidades disponibles en una fase = completadas en la anterior − completadas en ella (aunque la pieza tenga otras unidades más atrás)
  const disponibles = (clave) => (piezas || []).map((p) => {
    const i = p.avance.findIndex((a) => a.clave === clave);
    if (i < 0) return null;
    const prev = i === 0 ? p.cantidad : p.avance[i - 1].completadas;
    return { ...p, unidades_disponibles: prev - p.avance[i].completadas };
  }).filter((p) => p && p.unidades_disponibles > 0);
  const pRecib = useMemo(() => disponibles('expedicion'), [piezas]);
  const pMont = useMemo(() => disponibles('montaje'), [piezas]);
  const kgSel = (sel) => Object.entries(sel).reduce((s, [id, n]) => s + n * (piezas.find((p) => p.id === Number(id))?.peso_unitario_kg || 0), 0);
  const udSel = (sel) => Object.values(sel).reduce((s, n) => s + n, 0);
  const presentes = Object.keys(horas).filter((k) => horas[k]);

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await post('/montaje/partes', {
        obra_id: Number(obra), fecha, piezas_descargadas: descargadas, clima, incidencias: inc, observaciones: obs,
        recibidas: Object.entries(recib).filter(([, n]) => n > 0).map(([id, n]) => ({ pieza_id: Number(id), cantidad: n })),
        montadas: Object.entries(mont).filter(([, n]) => n > 0).map(([id, n]) => ({ pieza_id: Number(id), cantidad: n })),
        horas: presentes.map((id) => ({ trabajador_id: Number(id), horas: horas[id] })),
        medios: Object.entries(med).filter(([, v]) => v).map(([id, v]) => ({ medio_id: Number(id), horas: v })),
      });
      if (fotos.length) {
        const fd = new FormData(); fd.append('entidad', 'parte_montaje'); fd.append('entidad_id', r.parte.id);
        fotos.forEach((x) => fd.append('archivos', x));
        await api('/archivos', { method: 'POST', form: fd }).catch((e) => toastError(new Error(`El parte se guardó, pero las fotos no: ${e.message}`)));
      }
      toast(r.mensaje);
      nav(`/partes/${r.parte.id}`);
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  if (!obras) return <Loading />;
  const tb = (k) => () => setAbierto(abierto === k ? null : k);
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-head"><div><h1>Parte diario de montaje</h1><p>{user.nombre} · rellena solo lo que haya pasado hoy</p></div></div>
      <div className="card mb">
        <div className="form-grid">
          <Field label="Obra"><select className="input" value={obra} onChange={(e) => setObra(e.target.value)}><option value="">Elige la obra…</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}</select></Field>
          <Field label="Fecha"><input type="date" className="input" value={fecha} max={f.hoyISO()} onChange={(e) => setFecha(e.target.value)} /></Field>
        </div>
      </div>
      {!obra ? <Empty title="Elige una obra para empezar" /> : !piezas ? <Loading /> : (
        <div className="stack" style={{ gap: 12 }}>
          <Bloque icon={Construction} titulo="Piezas montadas" abierto={abierto === 'montadas'} onToggle={tb('montadas')}
            resumen={udSel(mont) ? `${udSel(mont)} ud · ${f.t(kgSel(mont))}` : `${pMont.length} marca(s) en obra pendientes de montar`}>
            <SelectorPiezas piezas={pMont} sel={mont} setSel={setMont} vacio="No hay piezas recibidas pendientes de montar." />
          </Bloque>
          <Bloque icon={PackageCheck} titulo="Piezas recibidas en obra" abierto={abierto === 'recibidas'} onToggle={tb('recibidas')}
            resumen={udSel(recib) ? `${udSel(recib)} ud · ${f.t(kgSel(recib))}` : `${pRecib.length} marca(s) listas para expedir/recibir`}>
            <SelectorPiezas piezas={pRecib} sel={recib} setSel={setRecib} vacio="No hay piezas pendientes de recibir." />
            <div className="hint mt-s">Al recibir una pieza queda registrada su expedición y pasa a estar disponible para montar mañana (o en este mismo parte tras guardarlo).</div>
          </Bloque>
          <Bloque icon={Truck} titulo="Piezas descargadas" abierto={abierto === 'descargadas'} onToggle={tb('descargadas')} resumen={`${descargadas} pieza(s)`}>
            <Stepper value={descargadas} min={0} max={999} onChange={setDescargadas} />
          </Bloque>
          <Bloque icon={Users} titulo="Personal presente y horas" abierto={abierto === 'personal'} onToggle={tb('personal')}
            resumen={presentes.length ? `${presentes.length} persona(s) · ${f.horas(presentes.reduce((s, id) => s + horas[id], 0))}` : 'Toca a cada persona presente'}>
            <Field label="Horas por persona"><Seg value={hh} onChange={(v) => { setHh(v); setHoras(Object.fromEntries(Object.entries(horas).map(([k, x]) => [k, x ? v : 0]))); }} options={[[4, '4 h'], [6, '6 h'], [8, '8 h'], [9, '9 h'], [10, '10 h']]} /></Field>
            <div className="chips mt">
              {trab.map((t) => <button key={t.id} className={`chip ${horas[t.id] ? 'on' : ''}`} style={{ minHeight: 52 }} onClick={() => setHoras({ ...horas, [t.id]: horas[t.id] ? 0 : hh })}>{t.nombre}{horas[t.id] ? ` · ${horas[t.id]} h` : ''}</button>)}
              {!trab.length && <span className="muted small">No hay trabajadores de montaje dados de alta.</span>}
            </div>
          </Bloque>
          <Bloque icon={Construction} titulo="Medios de elevación utilizados" abierto={abierto === 'medios'} onToggle={tb('medios')}
            resumen={Object.values(med).filter(Boolean).length ? medios.filter((m) => med[m.id]).map((m) => m.nombre).join(', ') : 'Ninguno'}>
            <div className="stack" style={{ gap: 8 }}>
              {medios.map((m) => (
                <div key={m.id} className="row wrap">
                  <button className={`chip ${med[m.id] ? 'on' : ''}`} style={{ minHeight: 48 }} onClick={() => setMed({ ...med, [m.id]: med[m.id] ? 0 : 8 })}>{m.nombre}</button>
                  {med[m.id] > 0 && <Seg value={med[m.id]} onChange={(v) => setMed({ ...med, [m.id]: v })} options={[[2, '2 h'], [4, '4 h'], [6, '6 h'], [8, '8 h']]} />}
                </div>
              ))}
            </div>
          </Bloque>
          <Bloque icon={AlertTriangle} titulo="Incidencias, clima y observaciones" abierto={abierto === 'inc'} onToggle={tb('inc')} resumen={inc ? inc.slice(0, 60) : `Sin incidencias · ${clima}`}>
            <div className="stack">
              <div className="chips">{[['Soleado', Sun], ['Nublado', Cloud], ['Lluvia', CloudRain], ['Viento', Wind]].map(([c, I]) => <button key={c} className={`chip ${clima === c ? 'on' : ''}`} onClick={() => setClima(c)}><I size={18} />{c}</button>)}</div>
              <Field label="Incidencias"><textarea className="input" value={inc} onChange={(e) => setInc(e.target.value)} placeholder="Ej.: pieza V-03 llegó con un taladro desplazado" /></Field>
              <Field label="Observaciones"><textarea className="input" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
            </div>
          </Bloque>
          <Bloque icon={Camera} titulo="Fotografías" abierto={abierto === 'fotos'} onToggle={tb('fotos')} resumen={fotos.length ? `${fotos.length} foto(s)` : 'Opcional'}>
            <label className="btn big block"><Camera />Hacer o elegir fotos<input type="file" hidden accept="image/*" capture="environment" multiple onChange={(e) => setFotos([...fotos, ...e.target.files])} /></label>
            {fotos.length > 0 && <div className="photos mt">{fotos.map((x, i) => <div key={i} className="photo"><img src={URL.createObjectURL(x)} alt="" /></div>)}</div>}
          </Bloque>
          <div className="card" style={{ position: 'sticky', bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 5, boxShadow: 'var(--shadow-lg)' }}>
            <div className="row between mb small"><span>Montado hoy: <b>{udSel(mont)} ud · {f.t(kgSel(mont))}</b></span><span>Recibido: <b>{f.t(kgSel(recib))}</b></span></div>
            <button className="btn ok xl" disabled={busy} onClick={guardar}><Save />{busy ? 'Guardando…' : 'Guardar parte'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
