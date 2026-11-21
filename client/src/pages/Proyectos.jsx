import { useState } from 'react';
import { useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Status, toneOf } from '../components/ui.jsx';
import { FasesObra } from '../components/Fases.jsx';
import * as f from '../lib/format.js';

function Gantt({ items, desde, hasta }) {
  const d0 = new Date(desde).getTime(); const d1 = new Date(hasta).getTime(); const span = Math.max(1, d1 - d0);
  const x = (d) => `${Math.max(0, Math.min(100, ((new Date(d).getTime() - d0) / span) * 100))}%`;
  const hoy = f.hoyISO();
  const meses = [];
  for (let d = new Date(desde.slice(0, 7) + '-01T12:00:00Z'); d.getTime() <= d1; d.setUTCMonth(d.getUTCMonth() + 1)) meses.push(d.toISOString().slice(0, 10));
  return (
    <div className="gantt">
      <div className="gantt-row hide-m"><div /><div style={{ position: 'relative', height: 18 }}>
        {meses.map((m) => new Date(m).getTime() >= d0 && <span key={m} className="xs muted" style={{ position: 'absolute', left: x(m) }}>{new Date(m).toLocaleDateString('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</span>)}
      </div></div>
      {items.map((it) => {
        const tone = toneOf(it.estado);
        return (
          <div key={it.k} className="gantt-row">
            <div className="row" style={{ gap: 8, minWidth: 0 }}><span className={`phase-n ${tone}`}>{it.n}</span><div style={{ minWidth: 0 }}><div className="small strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div><div className="xs muted">{f.fecha(it.ini)} → {f.fecha(it.fin)} · {f.pct(it.pct)}</div></div></div>
            <div className="gantt-track" title={`${it.nombre}: ${f.pct(it.pct)}`}>
              {it.ini && it.fin && (
                <div className={`gantt-plan ${tone === 'idle' ? '' : tone}`} style={{ left: x(it.ini), width: `calc(${x(it.fin)} - ${x(it.ini)} + 4px)` }}>
                  <span style={{ width: `${it.pct}%` }} />
                </div>
              )}
              {hoy >= desde && hoy <= hasta && <div className="gantt-today" style={{ left: x(hoy) }} title="Hoy" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Proyectos() {
  const { data, error, loading, reload } = useData('/obras?activas=1');
  const [sel, setSel] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const obra = data.find((o) => o.id === Number(sel)) || null;
  const fechas = data.flatMap((o) => [o.fecha_inicio, o.fecha_entrega]).filter(Boolean).sort();
  return (
    <>
      <div className="page-head">
        <div><h1>Gestión de proyectos</h1><p>Calendario previsto de cada obra y fase frente al avance real. La línea roja marca el día de hoy.</p></div>
        <div className="page-actions">
          <select className="input" style={{ minWidth: 260 }} value={sel || ''} onChange={(e) => setSel(e.target.value || null)} aria-label="Obra">
            <option value="">Vista general de obras</option>{data.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>)}
          </select>
        </div>
      </div>
      {!obra ? (
        <div className="card">
          <div className="card-head"><h2>Obras activas</h2><div className="legend" style={{ marginTop: 0 }}>{['terminado', 'en_curso', 'retrasado'].map((e) => <Status key={e} estado={e} small />)}</div></div>
          {fechas.length ? <Gantt desde={fechas[0]} hasta={fechas[fechas.length - 1]} items={data.map((o) => ({ k: o.id, n: '•', nombre: `${o.codigo} · ${o.nombre}`, ini: o.fecha_inicio, fin: o.fecha_entrega, pct: o.resumen.avance_global, estado: o.resumen.retrasada ? 'retrasado' : o.resumen.avance_global >= 100 ? 'terminado' : 'en_curso' }))} /> : <div className="muted">Las obras no tienen fechas.</div>}
          <div className="hint mt">Selecciona una obra para ver y editar el calendario de sus fases.</div>
        </div>
      ) : (
        <div className="stack">
          <div className="card">
            <div className="card-head"><div><span className="code">{obra.codigo}</span><h2 className="mt-s">{obra.nombre}</h2><p>Entrega {f.fecha(obra.fecha_entrega)} · avance global {f.pct(obra.resumen.avance_global)} · {obra.resumen.fases_retrasadas} fase(s) retrasada(s)</p></div></div>
            {(() => {
              const fs = obra.resumen.fases; const ds = fs.flatMap((x) => [x.fecha_inicio_prevista, x.fecha_fin_prevista]).concat([obra.fecha_inicio, obra.fecha_entrega]).filter(Boolean).sort();
              return ds.length ? <Gantt desde={ds[0]} hasta={ds[ds.length - 1]} items={fs.map((x) => ({ k: x.id, n: x.orden, nombre: x.nombre, ini: x.fecha_inicio_prevista, fin: x.fecha_fin_prevista, pct: x.porcentaje, estado: x.estado }))} />
                : <div className="banner info">Las fases aún no tienen fechas previstas. Edítalas en la tabla de abajo.</div>;
            })()}
          </div>
          <FasesObra obra={obra} reload={reload} />
        </div>
      )}
    </>
  );
}
