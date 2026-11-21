import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Casco as HardHat } from '../components/iconos.jsx';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, DataTable, Bar, Kpi, Status } from '../components/ui.jsx';
import * as f from '../lib/format.js';

function Comparativa({ obraId }) {
  const { data } = useData(`/montaje/comparativa/${obraId}`);
  if (!data) return <Loading />;
  return (
    <DataTable rows={data} empty="Sin piezas."
      columns={[{ key: 'marca', label: 'Marca', render: (p) => <span className="marca">{p.marca}</span> }, { key: 'el', label: 'Elemento', render: (p) => f.ELEMENTOS[p.elemento] },
        { key: 'cantidad', label: 'Ud', num: true }, { key: 'fab', label: 'Fabricadas', num: true, render: (p) => `${p.fabricadas}/${p.cantidad}` },
        { key: 'exp', label: 'Expedidas', num: true, render: (p) => `${p.expedidas}/${p.cantidad}` }, { key: 'mon', label: 'Montadas', num: true, render: (p) => <b>{p.montadas}/{p.cantidad}</b> },
        { key: 'kgm', label: 'kg montados', num: true, render: (p) => f.kg(p.kg_montados) }, { key: 'fase', label: 'Fase actual', render: (p) => <span className="small">{p.fase_actual_nombre}</span> },
        { key: 'estado', label: 'Estado', render: (p) => <Status estado={p.estado} small /> }]}
      card={(p) => <><div className="row between"><span className="marca">{p.marca}</span><Status estado={p.estado} small /></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}><div className="small">Fab. <b>{p.fabricadas}/{p.cantidad}</b></div><div className="small">Exp. <b>{p.expedidas}/{p.cantidad}</b></div><div className="small">Mont. <b>{p.montadas}/{p.cantidad}</b></div></div></>} />
  );
}

export default function Montaje() {
  const { can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useData('/montaje/resumen');
  const partes = useData('/montaje/partes');
  const [sel, setSel] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const filas = data;
  const tot = (k) => filas.reduce((s, x) => s + x[k], 0);
  return (
    <>
      <div className="page-head">
        <div><h1>Montaje</h1><p>Lo fabricado frente a lo realmente montado en cada obra.</p></div>
        {can('partes.montaje') && <div className="page-actions"><button className="btn primary big" onClick={() => nav('/control-obra')}><HardHat />Nuevo parte de montaje</button></div>}
      </div>
      <div className="grid g4 mb">
        <Kpi label="Fabricado" value={f.tNum(tot('kg_fabricados'), 1)} unit="t" />
        <Kpi label="En taller sin expedir" value={f.tNum(tot('kg_fabricado_sin_expedir'), 1)} unit="t" tone="warn" />
        <Kpi label="En obra sin montar" value={f.tNum(tot('kg_en_obra_sin_montar'), 1)} unit="t" tone="warn" />
        <Kpi label="Montado" value={f.tNum(tot('kg_montados'), 1)} unit="t" tone="ok" />
      </div>
      <div className="stack">
        {filas.map((o) => (
          <div key={o.obra_id} className="card">
            <div className="card-head">
              <div><span className="code">{o.codigo}</span><h2 className="mt-s">{o.nombre}</h2><p>Montado sobre fabricado: <b>{f.pct(o.pct_montado_sobre_fabricado)}</b></p></div>
              <button className="btn" onClick={() => setSel(sel === o.obra_id ? null : o.obra_id)}>{sel === o.obra_id ? 'Ocultar piezas' : 'Ver pieza a pieza'}</button>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {[['Fabricado', o.kg_fabricados, ''], ['Expedido', o.kg_expedidos, 'warn'], ['Montado', o.kg_montados, 'ok']].map(([l, v, tone]) => (
                <div key={l} className="row" style={{ gap: 12 }}>
                  <span style={{ width: 90 }} className="small strong">{l}</span>
                  <div className="grow"><Bar value={o.kg_unicos ? (v / o.kg_unicos) * 100 : 0} tone={tone} thick /></div>
                  <span className="num strong" style={{ width: 92, textAlign: 'right' }}>{f.t(v, 1)}</span>
                </div>
              ))}
              <div className="xs muted">Sobre {f.t(o.kg_unicos)} únicas de la obra</div>
            </div>
            {sel === o.obra_id && <div className="mt"><Comparativa obraId={o.obra_id} /></div>}
          </div>
        ))}
      </div>
      <h2 className="mt mb">Últimos partes de montaje</h2>
      <div className="card pad0">
        {partes.data ? <DataTable rows={partes.data.slice(0, 30)} empty="Todavía no hay partes." onRow={(p) => nav(`/partes/${p.id}`)}
          columns={[{ key: 'fecha', label: 'Fecha', render: (p) => f.fecha(p.fecha) }, { key: 'obra', label: 'Obra', render: (p) => <span className="code">{p.obra_codigo}</span> },
            { key: 'enc', label: 'Encargado', render: (p) => p.encargado }, { key: 'mon', label: 'Montadas', num: true, render: (p) => p.piezas_montadas },
            { key: 'kg', label: 't montadas', num: true, render: (p) => <b>{f.t(p.kg_montados)}</b> }, { key: 'h', label: 'Horas', num: true, render: (p) => f.horas(p.horas_totales) },
            { key: 'inc', label: 'Incidencias', render: (p) => <span className="small" style={{ color: p.incidencias ? 'var(--bad)' : undefined }}>{p.incidencias || '—'}</span> }]}
          card={(p) => <><div className="row between"><b>{f.fecha(p.fecha)}</b><span className="code">{p.obra_codigo}</span></div><div className="small">{p.piezas_montadas} montadas · <b>{f.t(p.kg_montados)}</b> · {f.horas(p.horas_totales)} · {p.personas} personas</div>{p.incidencias && <div className="small" style={{ color: 'var(--bad)' }}>{p.incidencias}</div>}</>} />
          : <Loading />}
      </div>
    </>
  );
}
