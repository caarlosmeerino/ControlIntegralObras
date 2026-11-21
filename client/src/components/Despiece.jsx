import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, AlertTriangle } from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { DataTable, Bar, Kpi, Selector } from './ui.jsx';
import { Lupa } from './iconos.jsx';
import { AvanceSheet, BotonAvance } from './Avance.jsx';
import { PiezaForm, ImportSheet } from './Piezas.jsx';
import * as f from '../lib/format.js';

const FAB = ['oficina', 'taller'];
const OBRA = ['obra'];

/** Situación de una pieza en fabricación (fases de oficina y taller) */
function enFabricacion(p) {
  const fs = p.avance.filter((a) => a.ambito !== 'obra');
  const actual = fs.find((a) => a.completadas < p.cantidad);
  const hechas = fs.length ? fs[fs.length - 1].completadas : 0;
  const pct = fs.length ? (fs.reduce((s, a) => s + a.completadas, 0) / (fs.length * p.cantidad)) * 100 : 0;
  return { actual, hechas, pct, terminada: !actual, kg: hechas * p.peso_unitario_kg };
}
/** Situación en montaje: llegadas a obra (expedidas) frente a montadas */
function enMontaje(p) {
  const fab = p.avance.filter((a) => a.ambito !== 'obra');
  const mon = p.avance.filter((a) => a.ambito === 'obra');
  const enObra = fab.length ? fab[fab.length - 1].completadas : p.cantidad;
  const montadas = mon[0]?.completadas || 0;
  const estado = montadas >= p.cantidad ? ['ok', 'Montada'] : enObra > montadas ? ['warn', 'En obra'] : montadas > 0 ? ['warn', 'Parcial'] : ['idle', 'En taller'];
  return { enObra, montadas, estado, kgMontados: montadas * p.peso_unitario_kg, kgEnObra: (enObra - montadas) * p.peso_unitario_kg };
}

export default function Despiece({ modo, piezas, obraId, reload }) {
  const { can } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('pendientes');
  const [avance, setAvance] = useState(null);
  const [form, setForm] = useState(false);
  const [imp, setImp] = useState(false);
  const fab = modo === 'fabricacion';
  const ambitos = fab ? FAB : OBRA;
  const filas = piezas.map((p) => ({ ...p, fab: enFabricacion(p), mon: enMontaje(p) }));
  const total = filas.reduce((s, p) => s + p.peso_total_kg, 0);
  const lista = filas.filter((p) => (!q || `${p.marca} ${p.perfil} ${p.plano} ${p.elemento}`.toLowerCase().includes(q.toLowerCase()))
    && (filtro === 'todas' || (filtro === 'pendientes' ? (fab ? !p.fab.terminada : p.mon.montadas < p.cantidad) : (fab ? p.fab.terminada : p.mon.montadas >= p.cantidad))));
  const puede = can(...(fab ? ['avance.taller', 'avance.oficina'] : ['avance.obra']));

  const kgFab = filas.reduce((s, p) => s + p.fab.kg, 0);
  const kgMont = filas.reduce((s, p) => s + p.mon.kgMontados, 0);
  const kgEnObra = filas.reduce((s, p) => s + p.mon.kgEnObra, 0);

  const comunes = [
    { key: 'marca', label: 'Marca', render: (p) => <><span className="marca">{p.marca}</span>{p.incidencia && <AlertTriangle size={15} style={{ color: 'var(--bad)', marginLeft: 6, verticalAlign: -2 }} />}</> },
    { key: 'elemento', label: 'Elemento', render: (p) => <>{f.ELEMENTOS[p.elemento]}<div className="xs muted">{p.perfil}</div></> },
    { key: 'plano', label: 'Plano', render: (p) => p.plano || '—' },
    { key: 'cantidad', label: 'Ud', num: true },
    { key: 'peso', label: 'Peso', num: true, render: (p) => f.kg(p.peso_total_kg) },
  ];
  const cols = fab ? [...comunes,
    { key: 'fase', label: 'Fase', render: (p) => (p.fab.terminada ? <span className="badge ok">Fabricada</span> : <span className="small">{p.fab.actual.nombre}<div className="xs muted">{p.fab.actual.completadas}/{p.cantidad} ud</div></span>) },
    { key: 'prog', label: 'Avance', width: 140, render: (p) => <div className="row" style={{ gap: 8 }}><div className="grow"><Bar value={p.fab.pct} tone={p.fab.terminada ? 'ok' : ''} /></div><span className="xs num muted">{f.num(p.fab.pct)} %</span></div> },
  ] : [...comunes,
    { key: 'obra', label: 'En obra', num: true, render: (p) => `${p.mon.enObra}/${p.cantidad}` },
    { key: 'mont', label: 'Montadas', num: true, render: (p) => <b>{p.mon.montadas}/{p.cantidad}</b> },
    { key: 'est', label: 'Estado', render: (p) => <span className={`badge ${p.mon.estado[0]}`}>{p.mon.estado[1]}</span> },
  ];
  if (puede) cols.push({ key: 'acc', label: '', render: (p) => <BotonAvance pieza={p} onClick={setAvance} ambitos={ambitos} /> });

  return (
    <div className="stack">
      <div className="grid g3 kpi-fila">
        <Kpi label="Peso total" value={f.tNum(total)} unit="t" sub={`${f.plural(piezas.length, 'marca')} · ${f.num(piezas.reduce((s, p) => s + p.cantidad, 0))} unidades`} />
        {fab ? <>
          <Kpi label="Fabricado" value={f.tNum(kgFab)} unit="t" tone="ok" sub={total ? `${f.pct((kgFab / total) * 100)} ` : ''} />
          <Kpi label="Pendiente" value={f.tNum(total - kgFab)} unit="t" />
        </> : <>
          <Kpi label="Montado" value={f.tNum(kgMont)} unit="t" tone="ok" sub={total ? `${f.pct((kgMont / total) * 100)} del despiece` : ''} />
          <Kpi label="En obra" value={f.tNum(kgEnObra)} unit="t" sub={`Aún en taller: ${f.t(total - kgMont - kgEnObra)}`} />
        </>}
      </div>
      <div className="row wrap">
        <div className="search" style={{ maxWidth: 320 }}><Lupa size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marca, perfil o plano" aria-label="Buscar pieza" type="search" /></div>
        <Selector filtro titulo="Mostrar piezas" value={filtro} onChange={setFiltro} options={[['pendientes', 'Pendientes'], ['hechas', fab ? 'Fabricadas' : 'Montadas'], ['todas', 'Todas']]} />
        <span className="grow" />
        {fab && can('piezas.editar') && <>
          <button className="btn" onClick={() => setImp(true)}><Upload size={18} />Importar despiece</button>
          <button className="btn primary" onClick={() => setForm(true)}><Plus size={18} />Añadir pieza</button>
        </>}
      </div>
      <div className="card pad0">
        <DataTable columns={cols} rows={lista} empty={piezas.length ? 'No hay piezas en este filtro.' : 'Todavía no hay piezas. Añádelas o importa el despiece desde Excel.'} onRow={(p) => nav(`/piezas/${p.id}`)}
          card={(p) => (
            <>
              <div className="row">
                <div className="grow">
                  <span className="marca">{p.marca}</span> <span className="small muted">{f.ELEMENTOS[p.elemento]} {p.perfil}</span>
                  <div className="small muted">{p.cantidad} ud · {f.kg(p.peso_total_kg)}{p.plano ? ` · plano ${p.plano}` : ''}</div>
                </div>
                {fab ? (p.fab.terminada ? <span className="badge ok">Fabricada</span> : <span className="small strong">{f.num(p.fab.pct)} %</span>)
                  : <span className={`badge ${p.mon.estado[0]}`}>{p.mon.estado[1]} {p.mon.montadas}/{p.cantidad}</span>}
              </div>
              {fab && !p.fab.terminada && <div><div className="small muted mb" style={{ marginBottom: 6 }}>{p.fab.actual.nombre}</div><Bar value={p.fab.pct} /></div>}
              {puede && <BotonAvance pieza={p} onClick={setAvance} ambitos={ambitos} block />}
            </>
          )} />
      </div>
      {avance && <AvanceSheet pieza={avance} ambitos={ambitos} onClose={() => setAvance(null)} onDone={reload} />}
      {form && <PiezaForm obraId={obraId} onClose={() => setForm(false)} onSaved={reload} />}
      {imp && <ImportSheet obraId={obraId} onClose={() => setImp(false)} onDone={reload} />}
    </div>
  );
}
