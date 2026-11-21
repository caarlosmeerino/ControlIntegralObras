import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Soldadura as Clock, Cuadrilla as Users } from '../components/iconos.jsx';
import { useApp, useData } from '../lib/app.jsx';
import { get, post, del, qs } from '../lib/api.js';
import { Loading, ErrorBox, Kpi, DataTable, Field, Seg } from '../components/ui.jsx';
import * as f from '../lib/format.js';

function RegistroHoras({ fecha, onDone }) {
  const { user, can, toast, toastError } = useApp();
  const [trab, setTrab] = useState([]);
  const [obras, setObras] = useState([]);
  const [seccion, setSeccion] = useState('');
  const [sel, setSel] = useState(new Set(user.trabajador ? [user.trabajador.id] : []));
  const [horas, setHoras] = useState(8);
  const [obra, setObra] = useState('');
  const [op, setOp] = useState('');
  const [busy, setBusy] = useState(false);
  const soloYo = !can('personal.ver');
  useEffect(() => {
    get('/personal/trabajadores').then((t) => setTrab(t.filter((x) => x.seccion !== 'montaje' && x.seccion !== 'oficina'))).catch(() => {});
    get('/obras?activas=1').then(setObras).catch(() => {});
  }, []);
  const visibles = soloYo ? trab.filter((t) => t.id === user.trabajador?.id) : trab.filter((t) => !seccion || t.seccion === seccion);
  const toggle = (id) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const enviar = async () => {
    setBusy(true);
    try {
      const r = await post('/personal/horas', { fecha, obra_id: obra || null, lineas: [...sel].map((id) => ({ trabajador_id: id, horas, operacion: op })) });
      toast(r.mensaje); setOp(''); onDone();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  if (soloYo && !user.trabajador) return <div className="banner">Tu usuario no está vinculado a ningún trabajador. Pide al jefe de taller que lo vincule en Personal.</div>;
  return (
    <div className="card">
      <div className="card-head"><div><h2><Clock size={20} style={{ verticalAlign: -3 }} /> Registrar horas · {f.fecha(fecha)}</h2><p>Selecciona trabajadores, horas y obra. Un toque por persona.</p></div></div>
      <div className="stack">
        {!soloYo && <div className="chips">{[['', 'Todas'], ...Object.entries(f.SECCIONES).filter(([k]) => !['montaje', 'oficina'].includes(k))].map(([k, v]) => <button key={k} className={`chip ${seccion === k ? 'on' : ''}`} onClick={() => setSeccion(k)}>{v}</button>)}</div>}
        <div className="chips">
          {visibles.map((t) => <button key={t.id} className={`chip ${sel.has(t.id) ? 'on' : ''}`} style={{ minHeight: 48 }} onClick={() => toggle(t.id)}>{t.nombre}<span className="xs" style={{ opacity: .75 }}>· {f.SECCIONES[t.seccion]}</span></button>)}
        </div>
        <div className="form-grid">
          <Field label="Horas"><Seg value={horas} onChange={setHoras} options={[[4, '4 h'], [6, '6 h'], [8, '8 h'], [9, '9 h'], [10, '10 h']]} /></Field>
          <Field label="Obra"><select className="input" value={obra} onChange={(e) => setObra(e.target.value)}><option value="">— Sin obra concreta —</option>{obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}</select></Field>
          <Field label="Operación (opcional)" full><input className="input" value={op} onChange={(e) => setOp(e.target.value)} placeholder="Ej.: armado de pilares HEB" /></Field>
        </div>
        <button className="btn ok big" disabled={busy || !sel.size} onClick={enviar}><Save />Guardar {sel.size} × {horas} h = {f.horas(sel.size * horas)}</button>
      </div>
    </div>
  );
}

export default function Taller() {
  const { can } = useApp();
  const [fecha, setFecha] = useState(f.hoyISO());
  const horas = useData(`/personal/horas${qs({ fecha })}`);
  const prod = useData(`/produccion${qs({ desde: fecha, hasta: fecha })}`);
  if (horas.loading && !horas.data) return <Loading />;
  if (horas.error) return <ErrorBox error={horas.error} retry={horas.reload} />;
  const p = prod.data?.[0] || {};
  const lista = horas.data.filter((h) => h.seccion !== 'montaje');
  const tot = lista.reduce((s, h) => s + Number(h.horas), 0);
  const kgTaller = ['corte', 'armado', 'calidad', 'pintura', 'expedicion'].reduce((s, k) => s + (p[k] || 0), 0);
  const borrar = async (h) => { if (!confirm(`¿Borrar ${h.horas} h de ${h.trabajador}?`)) return; await del(`/personal/horas/${h.id}`); horas.reload(); };
  return (
    <>
      <div className="page-head">
        <div><h1>Control del taller</h1><p>Horas trabajadas y producción del día en el taller.</p></div>
        <div className="page-actions"><input type="date" className="input" value={fecha} max={f.hoyISO()} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" /></div>
      </div>
      <div className="grid g4 mb">
        <Kpi icon={Users} label="Personas con parte" value={new Set(lista.map((h) => h.trabajador_id)).size} />
        <Kpi icon={Clock} label="Horas registradas" value={f.num(tot, 1)} unit="h" />
        <Kpi label="Procesado en taller" value={f.tNum(kgTaller, 1)} unit="t" tone="ok" sub="Σ kg de fases de taller (acumulado)" />
        <Kpi label="Rendimiento del día" value={tot ? f.num(kgTaller / tot, 0) : '—'} unit="kg/h" tone="idle" />
      </div>
      <div className="grid g2">
        {can('partes.taller') && <RegistroHoras fecha={fecha} onDone={horas.reload} />}
        <div className="card">
          <h2 className="mb">Producción del día por fase</h2>
          {[['corte', 'Corte'], ['armado', 'Armado y soldadura'], ['calidad', 'Control de calidad'], ['pintura', 'Pintura'], ['expedicion', 'Expedición']].map(([k, l]) => (
            <div key={k} className="file-row"><span className="grow">{l}</span><b className="num">{f.t(p[k] || 0)}</b></div>
          ))}
        </div>
      </div>
      <div className="card pad0 mt">
        <div style={{ padding: '16px 18px 4px' }}><h2>Partes de horas del {f.fecha(fecha)}</h2></div>
        <DataTable rows={lista} empty="No hay horas registradas en esta fecha."
          columns={[{ key: 'trabajador', label: 'Trabajador', render: (h) => <b>{h.trabajador}</b> }, { key: 'sec', label: 'Sección', render: (h) => f.SECCIONES[h.seccion] },
            { key: 'obra', label: 'Obra', render: (h) => h.obra_codigo ? <span className="code">{h.obra_codigo}</span> : '—' }, { key: 'operacion', label: 'Operación' },
            { key: 'horas', label: 'Horas', num: true, render: (h) => <b>{f.horas(h.horas)}</b> }, { key: 'por', label: 'Registrado por', render: (h) => <span className="small muted">{h.registrado_por}</span> },
            { key: 'x', label: '', render: (h) => <button className="btn ghost icon danger" onClick={() => borrar(h)} aria-label="Borrar"><Trash2 size={18} /></button> }]}
          footer={{ trabajador: 'Total', horas: f.horas(tot) }} />
      </div>
    </>
  );
}
