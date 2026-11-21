import { useState } from 'react';
import { Soldadura as Clock, Bascula as Weight, Manometro as Gauge, Albaran as Euro } from '../components/iconos.jsx';
import { useApp, useData } from '../lib/app.jsx';
import { qs } from '../lib/api.js';
import { Loading, ErrorBox, Kpi, Seg, BarChart, DataTable, Bar, Field } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export default function Rendimientos() {
  const { can } = useApp();
  const [agrupar, setAgrupar] = useState('dia');
  const [dias, setDias] = useState(30);
  const [seccion, setSeccion] = useState('');
  const hasta = f.hoyISO(); const desde = f.sumarDias(hasta, -(dias - 1));
  const { data, error, loading, reload } = useData(`/informes/rendimientos${qs({ desde, hasta, agrupar, seccion })}`);
  const costes = useData(can('costes.ver') ? '/costes/resumen' : null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const horas = data.serie.reduce((s, x) => s + x.horas, 0); const kg = data.serie.reduce((s, x) => s + x.kg, 0); const coste = data.serie.reduce((s, x) => s + (x.coste || 0), 0);
  const maxKgH = Math.max(1, ...data.trabajadores.map((t) => t.kg_hora));
  const etiqueta = (d) => (agrupar === 'mes' ? new Date(d.periodo + 'T12:00:00Z').toLocaleDateString('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : agrupar === 'semana' ? `sem. ${f.diaCorto(d.periodo)}` : f.diaCorto(d.periodo));
  return (
    <>
      <div className="page-head">
        <div><h1>Toneladas y rendimientos</h1><p>Kilos procesados por trabajador, equipo y sección frente a las horas trabajadas.</p></div>
        <div className="page-actions">
          <Seg value={dias} onChange={setDias} options={[[7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '12 meses']]} />
        </div>
      </div>
      <div className="row wrap mb">
        <Field label="Agrupar por"><Seg value={agrupar} onChange={setAgrupar} options={[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]} /></Field>
        <Field label="Sección"><div className="chips">{[['', 'Todas'], ['corte', 'Corte'], ['armado', 'Armado'], ['soldadura', 'Soldadura'], ['pintura', 'Pintura'], ['montaje', 'Montaje']].map(([k, v]) => <button key={k} className={`chip ${seccion === k ? 'on' : ''}`} onClick={() => setSeccion(k)}>{v}</button>)}</div></Field>
      </div>
      <div className="grid g4 mb">
        <Kpi icon={Clock} label="Horas trabajadas" value={f.num(horas, 0)} unit="h" />
        <Kpi icon={Weight} label="Toneladas procesadas" value={f.tNum(kg, 1)} unit="t" tone="ok" sub="Firmadas por trabajadores" />
        <Kpi icon={Gauge} label="Rendimiento medio" value={horas ? f.num(kg / horas, 0) : '—'} unit="kg/h" tone="idle" />
        {can('costes.ver') ? <Kpi icon={Euro} label="Coste mano de obra" value={f.eur0(coste)} tone="warn" sub={kg ? `${f.eur0(coste / (kg / 1000))} por tonelada` : ''} /> : <Kpi label="Personas" value={data.trabajadores.filter((t) => t.horas > 0).length} tone="idle" />}
      </div>
      <div className="grid g3 mb">
        <div className="card span2">
          <h2 className="mb">Toneladas procesadas por {agrupar === 'dia' ? 'día' : agrupar}</h2>
          <BarChart data={data.serie} series={[{ key: 'kg', label: 'Procesado por el personal', color: '#0a84ff' }]} xLabel={etiqueta} />
        </div>
        <div className="card">
          <h2 className="mb">Por sección</h2>
          {data.secciones.filter((s) => s.horas || s.kg).map((s) => (
            <div key={s.seccion} className="mb">
              <div className="row between small"><b>{f.SECCIONES[s.seccion]}</b><span className="num">{f.t(s.kg, 1)} · {f.horas(s.horas)}</span></div>
              <div className="row mt-s" style={{ gap: 8 }}><div className="grow"><Bar value={(s.kg_hora / Math.max(1, ...data.secciones.map((x) => x.kg_hora))) * 100} /></div><span className="xs strong num" style={{ width: 70, textAlign: 'right' }}>{f.num(s.kg_hora)} kg/h</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card pad0 mb">
        <div style={{ padding: '16px 18px 4px' }}><h2>Rendimiento por trabajador</h2></div>
        <DataTable rows={data.trabajadores.filter((t) => t.horas || t.kg)} empty="Sin horas ni producción en el periodo."
          columns={[{ key: 'nombre', label: 'Trabajador', render: (t) => <b>{t.nombre}</b> }, { key: 'sec', label: 'Sección', render: (t) => f.SECCIONES[t.seccion] }, { key: 'equipo', label: 'Equipo', render: (t) => t.equipo || '—' },
            { key: 'horas', label: 'Horas', num: true, render: (t) => f.horas(t.horas) }, { key: 'op', label: 'Operaciones', num: true, render: (t) => t.operaciones },
            { key: 'kg', label: 'Procesado', num: true, render: (t) => <b>{f.t(t.kg)}</b> },
            { key: 'kgh', label: 'kg/h', width: 160, render: (t) => <div className="row" style={{ gap: 8 }}><div className="grow"><Bar value={(t.kg_hora / maxKgH) * 100} /></div><b className="num small">{f.num(t.kg_hora)}</b></div> },
            can('costes.ver') && { key: 'ct', label: '€/t', num: true, render: (t) => f.eur0(t.coste_tonelada) }].filter(Boolean)} />
      </div>
      <div className="card pad0 mb">
        <div style={{ padding: '16px 18px 4px' }}><h2>Rendimiento por equipo</h2></div>
        <DataTable rows={data.equipos} rowKey={(e) => e.equipo_id || 0}
          columns={[{ key: 'equipo', label: 'Equipo', render: (e) => <b>{e.equipo}</b> }, { key: 'personas', label: 'Personas', num: true }, { key: 'horas', label: 'Horas', num: true, render: (e) => f.horas(e.horas) },
            { key: 'kg', label: 'Procesado', num: true, render: (e) => <b>{f.t(e.kg)}</b> }, { key: 'kgh', label: 'kg/h', num: true, render: (e) => f.num(e.kg_hora) },
            can('costes.ver') && { key: 'coste', label: 'Coste', num: true, render: (e) => f.eur0(e.coste) }].filter(Boolean)} />
      </div>
      {costes.data && (
        <div className="card pad0">
          <div style={{ padding: '16px 18px 4px' }}><h2>Coste por tonelada por obra</h2></div>
          <DataTable rows={costes.data.obras} rowKey={(o) => o.obra_id}
            columns={[{ key: 'obra', label: 'Obra', render: (o) => <><span className="code">{o.codigo}</span> {o.nombre}</> }, { key: 'tf', label: 't fabricadas', num: true, render: (o) => f.num(o.t_fabricadas, 2) },
              { key: 'real', label: 'Coste real', num: true, render: (o) => f.eur0(o.real) }, { key: 'ctf', label: '€/t fabricada', num: true, render: (o) => <b>{f.eur0(o.coste_t_fabricada)}</b> },
              { key: 'ctp', label: '€/t previsto', num: true, render: (o) => f.eur0(o.coste_t_prevista) }, { key: 'pv', label: 'Venta €/t', num: true, render: (o) => f.eur0(o.precio_venta_t) },
              { key: 'cons', label: 'Consumido / avance', render: (o) => <span className={`badge ${o.consumido_pct > o.avance_global + 5 ? 'bad' : 'ok'}`}>{f.pct(o.consumido_pct)} / {f.pct(o.avance_global)}</span> }]} />
        </div>
      )}
    </>
  );
}
