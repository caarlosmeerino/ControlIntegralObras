import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Seg } from '../components/ui.jsx';
import { PiezasTabla } from '../components/Piezas.jsx';
import * as f from '../lib/format.js';

/** Fabricación: piezas que están en fases de oficina o taller, agrupadas por fase */
export default function Fabricacion() {
  const [sp] = useSearchParams();
  const [obra, setObra] = useState('');
  const [fase, setFase] = useState(null);
  const [ambito, setAmbito] = useState('taller');
  const { data, error, loading, reload } = useData('/piezas?activas=1');
  const obras = useMemo(() => [...new Map((data || []).map((p) => [p.obra_id, `${p.obra_codigo} · ${p.obra_nombre}`])).entries()], [data]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const base = data.filter((p) => (!obra || p.obra_id === Number(obra)) && (ambito === 'todas' || (ambito === 'taller' ? ['taller', 'oficina'].includes(p.fase_actual_ambito) : p.fase_actual_ambito === 'obra')));
  const porFase = new Map();
  for (const p of base) {
    if (!p.fase_actual_id) continue;
    const k = `${p.fase_actual_orden}. ${p.fase_actual_nombre}`;
    const e = porFase.get(k) || { k, orden: p.fase_actual_orden, piezas: 0, kg: 0 };
    e.piezas++; e.kg += p.unidades_disponibles * p.peso_unitario_kg; porFase.set(k, e);
  }
  const chips = [...porFase.values()].sort((a, b) => a.orden - b.orden);
  const lista = fase ? base.filter((p) => `${p.fase_actual_orden}. ${p.fase_actual_nombre}` === fase) : base;
  return (
    <>
      <div className="page-head">
        <div><h1>Fabricación</h1><p>Piezas pendientes en cada fase. Pulsa «Avanzar» para registrar el trabajo terminado.</p></div>
        <div className="page-actions">
          <select className="input" style={{ width: 'auto', minWidth: 220 }} value={obra} onChange={(e) => { setObra(e.target.value); setFase(null); }} aria-label="Obra">
            <option value="">Todas las obras activas</option>{obras.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <Seg value={ambito} onChange={(v) => { setAmbito(v); setFase(null); }} options={[['taller', 'Taller'], ['obra', 'Obra'], ['todas', 'Todas']]} />
        </div>
      </div>
      <div className="grid mb" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {chips.map((c) => (
          <button key={c.k} className="card" onClick={() => setFase(fase === c.k ? null : c.k)}
            style={{ textAlign: 'left', cursor: 'pointer', padding: 14, borderColor: fase === c.k ? 'var(--primary)' : undefined, boxShadow: fase === c.k ? '0 0 0 2px var(--primary-soft)' : undefined }}>
            <div className="small strong">{c.k}</div>
            <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{f.tNum(c.kg, 1)}<small>t</small></div>
            <div className="xs muted">{f.plural(c.piezas, 'marca')} esperando</div>
          </button>
        ))}
        {!chips.length && <div className="muted">No hay piezas pendientes en este ámbito.</div>}
      </div>
      <PiezasTabla key={sp.get('q') || ''} piezas={lista} mostrarObra={!obra} obraId={obra ? Number(obra) : null} reload={reload} filtrosFase={!fase} initialQ={sp.get('q') || ''} />
    </>
  );
}
