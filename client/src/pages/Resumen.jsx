import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, LayoutGrid, Rows3 } from 'lucide-react';
import { useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Seg, Status, Ring, UbicacionBar, PhaseList, toneOf, Kpi } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export default function Resumen() {
  const [filtro, setFiltro] = useState('1');
  const [vista, setVista] = useState('matriz');
  const { data, error, loading, reload } = useData(`/obras${filtro === '1' ? '?activas=1' : ''}`);
  const nav = useNavigate();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const fases = data[0]?.resumen.fases.map((x) => x.nombre) || [];
  const total = (k) => data.reduce((s, o) => s + (o.resumen[k] || 0), 0);
  return (
    <>
      <div className="page-head">
        <div><h1>Resumen de producción</h1><p>Avance de cada obra y fase. Cada porcentaje se calcula con las cantidades de su propia fase.</p></div>
        <div className="page-actions">
          <Seg value={filtro} onChange={setFiltro} options={[['1', 'Activas'], ['0', 'Todas']]} />
          <Seg value={vista} onChange={setVista} options={[['matriz', <LayoutGrid key="a" size={18} />], ['detalle', <Rows3 key="b" size={18} />]]} />
        </div>
      </div>
      <div className="grid g4 mb">
        <Kpi label="Toneladas únicas" value={f.tNum(total('kg_unicos'), 1)} unit="t" sub="Peso real de las piezas (una vez)" />
        <Kpi label="Fabricadas" value={f.tNum(total('kg_fabricados'), 1)} unit="t" tone="ok" sub="Liberadas por calidad" />
        <Kpi label="Montadas" value={f.tNum(total('kg_montados'), 1)} unit="t" tone="ok" />
        <Kpi label="Producción acumulada" value={f.tNum(total('produccion_acumulada_kg'), 1)} unit="t" tone="idle" sub="Σ de todas las fases · no es tonelaje" />
      </div>
      <div className="banner info small"><Info size={18} />La producción acumulada suma una misma tonelada en cada fase por la que pasa. Para saber cuánto pesa la obra usa siempre las toneladas únicas.</div>
      {vista === 'matriz' ? (
        <div className="card pad0">
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Obra</th><th className="num">t únicas</th><th className="num">Global</th>{fases.map((n, i) => <th key={i} className="num" title={n}>{i + 1}. {n.split(' ')[0]}</th>)}</tr></thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className="click" onClick={() => nav(`/obras/${o.id}`)}>
                    <td><span className="code">{o.codigo}</span><div className="small strong" style={{ maxWidth: 260 }}>{o.nombre}</div></td>
                    <td className="num strong">{f.tNum(o.resumen.kg_unicos, 1)}</td>
                    <td className="num"><b>{f.pct(o.resumen.avance_global)}</b></td>
                    {o.resumen.fases.map((x) => {
                      const tone = toneOf(x.estado);
                      return (
                        <td key={x.id} className="num" title={`${x.nombre}: ${f.t(x.kg_completados)} de ${f.t(x.kg_base)}`}
                          style={{ background: `color-mix(in srgb, var(--${tone === 'idle' ? 'surface' : tone + '-soft'}) ${tone === 'idle' ? 100 : 100}%, transparent)`, color: tone === 'idle' ? 'var(--text-3)' : `var(--${tone})`, fontWeight: 750 }}>
                          {f.num(x.porcentaje)} %<div className="xs" style={{ fontWeight: 500, color: 'var(--text-3)' }}>{f.tNum(x.kg_completados, 1)} t</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend" style={{ padding: '0 16px 14px' }}>
            {Object.entries(f.ESTADOS).map(([k, v]) => <span key={k}><Status estado={k} small /></span>)}
          </div>
        </div>
      ) : (
        <div className="stack">
          {data.map((o) => (
            <div key={o.id} className="card">
              <div className="card-head">
                <div className="row" style={{ gap: 14 }}>
                  <Ring value={o.resumen.avance_global} size={70} stroke={8} />
                  <div><span className="code">{o.codigo}</span> {o.resumen.retrasada && <Status estado="retrasado" small />}<h2 className="mt-s">{o.nombre}</h2><p>{f.t(o.resumen.kg_unicos)} únicas · entrega {f.fecha(o.fecha_entrega)}</p></div>
                </div>
                <button className="btn" onClick={() => nav(`/obras/${o.id}`)}>Abrir ficha</button>
              </div>
              <PhaseList fases={o.resumen.fases} />
              <div className="divider" />
              <div className="label mb">¿Dónde está el material?</div>
              <UbicacionBar fases={o.resumen.fases} totalKg={o.resumen.kg_unicos} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
