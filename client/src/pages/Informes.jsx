import { useState } from 'react';
import { FileSpreadsheet, FileDown, Play, CalendarClock } from 'lucide-react';
import { Albaran as FileText } from '../components/iconos.jsx';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, qs } from '../lib/api.js';
import { Loading, ErrorBox, Field, Seg, Empty } from '../components/ui.jsx';
import * as f from '../lib/format.js';

const FMT = { kg: f.kg, t: (v) => f.t(v), tt: (v) => (v == null ? '—' : `${f.num(v, 2)} t`), pct: f.pct, eur: f.eur, num: (v) => f.num(v, 2), date: f.fecha, text: (v) => v ?? '' };
const CON_RANGO = ['produccion', 'rendimiento', 'equipos'];

function Vista({ inf }) {
  const filas = inf.totales ? [...inf.filas, { ...inf.totales, __t: true }] : inf.filas;
  return (
    <div className="card pad0">
      <div style={{ padding: '16px 18px 8px' }}><h2>{inf.titulo}</h2><div className="small muted">{inf.subtitulo}</div></div>
      {inf.kpis && <div className="row wrap" style={{ padding: '0 18px 10px' }}>{inf.kpis.map((k) => <span key={k.label} className="badge info">{k.label}: {k.valor}</span>)}</div>}
      {!inf.filas.length ? <Empty title="No hay datos para el periodo seleccionado" /> : (
        <div className="table-wrap" style={{ maxHeight: '60vh' }}>
          <table className="t">
            <thead><tr>{inf.columnas.map((c) => <th key={c.key} className={c.fmt && !['text', 'date'].includes(c.fmt) ? 'num' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>{filas.map((r, i) => <tr key={i} style={r.__t ? { fontWeight: 800, background: 'var(--surface-2)' } : undefined}>{inf.columnas.map((c) => <td key={c.key} className={c.fmt && !['text', 'date'].includes(c.fmt) ? 'num' : ''}>{r[c.key] == null && r.__t ? '' : (FMT[c.fmt || 'text'] || FMT.text)(r[c.key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {inf.nota && <div className="small muted" style={{ padding: '10px 18px 16px' }}>{inf.nota}</div>}
    </div>
  );
}

export default function Informes() {
  const { toast, toastError } = useApp();
  const cat = useData('/informes/catalogo');
  const obras = useData('/obras');
  const prog = useData('/informes/programados');
  const [tipo, setTipo] = useState('obras');
  const [desde, setDesde] = useState(f.sumarDias(f.hoyISO(), -29));
  const [hasta, setHasta] = useState(f.hoyISO());
  const [agrupar, setAgrupar] = useState('dia');
  const [obra, setObra] = useState('');
  const [seccion, setSeccion] = useState('');
  const params = qs({ desde, hasta, agrupar, obra_id: obra, seccion });
  const inf = useData(`/informes/${tipo}${params}`);
  if (!cat.data) return <Loading />;
  const generar = async (p) => { try { const r = await post(`/informes/programados/${p.id}/generar`); toast(r.mensaje); prog.reload(); } catch (e) { toastError(e); } };
  const activar = async (p) => { try { await put(`/informes/programados/${p.id}`, { activo: !p.activo }); prog.reload(); } catch (e) { toastError(e); } };
  return (
    <>
      <div className="page-head"><div><h1>Informes</h1><p>Consulta en pantalla y exporta a PDF o Excel.</p></div></div>
      <div className="grid g4 mb" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {cat.data.map((c) => (
          <button key={c.clave} className="big-action" onClick={() => setTipo(c.clave)} style={{ minHeight: 76, fontSize: '1.05rem', outline: tipo === c.clave ? '3px solid var(--acento)' : undefined, outlineOffset: -3 }}>
            <span className="ico" style={{ width: 40, height: 40, background: tipo === c.clave ? 'var(--acento)' : '#30353a', color: tipo === c.clave ? '#191b1d' : '#c9c7c0' }}><FileText size={20} /></span>
            <span className="small">{c.nombre}</span>
          </button>
        ))}
      </div>
      <div className="card mb">
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          {CON_RANGO.includes(tipo) && <>
            <Field label="Desde"><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
            <Field label="Hasta"><input type="date" className="input" value={hasta} max={f.hoyISO()} onChange={(e) => setHasta(e.target.value)} /></Field>
          </>}
          {tipo === 'produccion' && <Field label="Agrupar por"><Seg value={agrupar} onChange={setAgrupar} options={[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]} /></Field>}
          {['produccion', 'obras', 'costes', 'rendimiento', 'equipos'].includes(tipo) && <Field label="Obra"><select className="input" value={obra} onChange={(e) => setObra(e.target.value)}><option value="">Todas</option>{(obras.data || []).map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}</select></Field>}
          {tipo === 'rendimiento' && <Field label="Sección"><select className="input" value={seccion} onChange={(e) => setSeccion(e.target.value)}><option value="">Todas</option>{Object.entries(f.SECCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
          <span className="grow" />
          <a className="btn" href={`/api/informes/${tipo}${params}${params ? '&' : '?'}formato=pdf`}><FileDown size={20} />PDF</a>
          <a className="btn" href={`/api/informes/${tipo}${params}${params ? '&' : '?'}formato=xlsx`}><FileSpreadsheet size={20} />Excel</a>
        </div>
      </div>
      {inf.error ? <ErrorBox error={inf.error} /> : !inf.data ? <Loading /> : <Vista inf={inf.data} />}
      <div className="card mt">
        <div className="card-head"><div><h2><CalendarClock size={20} style={{ verticalAlign: -3 }} /> Informes automáticos</h2><p>Se generan solos cada mañana (diarios), los lunes (semanales) y el día 1 (mensuales).</p></div></div>
        {!prog.data ? <Loading /> : <>
          {prog.data.programados.map((p) => (
            <div key={p.id} className="file-row">
              <label className="check" style={{ minHeight: 0 }}><input type="checkbox" checked={p.activo} onChange={() => activar(p)} aria-label={`Activar ${p.nombre}`} /></label>
              <div className="grow"><b>{p.nombre}</b><div className="xs muted">{p.frecuencia} · {p.formato.toUpperCase()} · último: {f.fechaHora(p.ultimo_envio)}</div></div>
              <button className="btn sm" onClick={() => generar(p)}><Play size={16} />Generar ahora</button>
            </div>
          ))}
          <h3 className="mt mb">Generados recientemente</h3>
          {prog.data.generados.length ? prog.data.generados.map((a) => (
            <div key={a.id} className="file-row">{a.mime.includes('pdf') ? <FileText size={20} /> : <FileSpreadsheet size={20} />}<a className="grow" href={`/api/archivos/${a.id}/contenido?descargar=1`}>{a.nombre}</a><span className="xs muted">{f.tamano(a.tamano)} · {f.fechaHora(a.creado_en)}</span></div>
          )) : <div className="muted small">Todavía no se ha generado ninguno.</div>}
        </>}
      </div>
    </>
  );
}
