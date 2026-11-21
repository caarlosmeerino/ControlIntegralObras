import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Pencil, LayoutDashboard, Package, ListOrdered, FolderOpen, HardHat, Euro, History, MapPin, Calendar, User, ArrowLeft } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Tabs, Ring, Status, PhaseList, UbicacionBar, Kpi, Empty, DataTable, LineaProduccion } from '../components/ui.jsx';
import { PiezasTabla } from '../components/Piezas.jsx';
import { FasesObra } from '../components/Fases.jsx';
import { ArchivosObra } from '../components/Archivos.jsx';
import CostesObra from '../components/CostesObra.jsx';
import ObraForm from '../components/ObraForm.jsx';
import * as f from '../lib/format.js';

const INDICADORES = [['previstas', 'Previstas'], ['recibidas', 'Recibidas'], ['cortadas', 'Cortadas'], ['armadas', 'Armadas y soldadas'], ['inspeccionadas', 'Inspeccionadas'], ['pintadas', 'Pintadas'], ['expedidas', 'Expedidas'], ['montadas', 'Montadas']];

function Historial({ obraId }) {
  const { data: h } = useData(`/obras/${obraId}/historial`);
  const { data: m } = useData(`/obras/${obraId}/movimientos?limit=150`);
  return (
    <div className="grid g2">
      <div className="card"><h2 className="mb">Movimientos de piezas</h2>
        {!m ? <Loading /> : !m.length ? <Empty title="Sin movimientos" /> : (
          <ul className="timeline">{m.map((x) => (
            <li key={x.id}><span className="dot" style={{ background: x.cantidad < 0 ? 'var(--bad)' : 'var(--ok)' }} />
              <div><div className="small"><Link to={`/piezas/${x.pieza_id}`} className="marca">{x.marca}</Link> · {x.cantidad < 0 ? 'corrección en' : 'completa'} <b>{x.fase}</b> · {Math.abs(x.cantidad)} ud · {f.kg(x.kg)}</div>
                <div className="xs muted">{f.fechaHora(x.fecha)} · {x.usuario || 'Sistema'}{x.trabajador ? ` · realizado por ${x.trabajador}` : ''}{x.nota ? ` · «${x.nota}»` : ''}</div></div></li>
          ))}</ul>
        )}
      </div>
      <div className="card"><h2 className="mb">Cambios en la obra</h2>
        {!h ? <Loading /> : !h.length ? <Empty title="Sin cambios registrados" /> : (
          <ul className="timeline">{h.map((x) => (
            <li key={x.id}><span className="dot" style={{ background: 'var(--primary)' }} />
              <div><div className="small strong">{x.detalle}</div><div className="xs muted">{f.fechaHora(x.fecha)} · {x.usuario || 'Sistema'} · {x.entidad} / {x.accion}</div></div></li>
          ))}</ul>
        )}
      </div>
    </div>
  );
}

function PartesObra({ obraId }) {
  const { data } = useData(`/montaje/partes?obra_id=${obraId}`);
  const nav = useNavigate();
  if (!data) return <Loading />;
  return (
    <div className="card pad0">
      <DataTable rows={data} empty="Todavía no hay partes de montaje." onRow={(p) => nav(`/partes/${p.id}`)}
        columns={[{ key: 'fecha', label: 'Fecha', render: (p) => f.fecha(p.fecha) }, { key: 'enc', label: 'Encargado', render: (p) => p.encargado },
          { key: 'rec', label: 'Recibidas', num: true, render: (p) => p.piezas_recibidas }, { key: 'mon', label: 'Montadas', num: true, render: (p) => p.piezas_montadas },
          { key: 'kg', label: 't montadas', num: true, render: (p) => <b>{f.t(p.kg_montados)}</b> }, { key: 'h', label: 'Horas', num: true, render: (p) => f.horas(p.horas_totales) },
          { key: 'per', label: 'Personal', num: true, render: (p) => p.personas }, { key: 'med', label: 'Medios', render: (p) => <span className="small">{p.medios}</span> },
          { key: 'inc', label: 'Incidencias', render: (p) => <span className="small" style={{ color: p.incidencias ? 'var(--bad)' : undefined }}>{p.incidencias || '—'}</span> }]} />
    </div>
  );
}

export default function ObraDetalle() {
  const { id } = useParams();
  const { can } = useApp();
  const [tab, setTab] = useState('resumen');
  const [edit, setEdit] = useState(false);
  const { data: o, error, loading, reload } = useData(`/obras/${id}`);
  const piezas = useData(tab === 'piezas' ? `/piezas?obra_id=${id}` : null, [tab]);
  if (loading && !o) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const r = o.resumen;
  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard }, { id: 'piezas', label: `Piezas (${r.n_piezas})`, icon: Package },
    { id: 'fases', label: 'Fases', icon: ListOrdered }, { id: 'docs', label: 'Planos y documentos', icon: FolderOpen },
    { id: 'montaje', label: 'Partes de montaje', icon: HardHat }, can('costes.ver') && { id: 'costes', label: 'Costes', icon: Euro },
    { id: 'historial', label: 'Historial', icon: History },
  ].filter(Boolean);
  return (
    <>
      <Link to="/obras" className="btn ghost sm mb"><ArrowLeft size={18} />Obras</Link>
      <div className="card mb">
        <div className="row wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
          <Ring value={r.avance_global} size={96} label="avance" tone={r.retrasada ? 'bad' : undefined} />
          <div className="grow" style={{ minWidth: 240 }}>
            <div className="row wrap" style={{ gap: 8 }}><span className="code">{o.codigo}</span><Status estado={o.estado} map={f.ESTADOS_OBRA} small />{r.retrasada && <Status estado="retrasado" small />}</div>
            <h1 className="mt-s">{o.nombre}</h1>
            <div className="row wrap small muted mt-s" style={{ gap: 16 }}>
              <span className="row" style={{ gap: 6 }}><User size={16} />{o.cliente || '—'}</span>
              <span className="row" style={{ gap: 6 }}><MapPin size={16} />{o.direccion || '—'}</span>
              <span className="row" style={{ gap: 6 }}><Calendar size={16} />{f.fecha(o.fecha_inicio)} → {f.fecha(o.fecha_entrega)}</span>
            </div>
          </div>
          {can('obras.editar') && <button className="btn" onClick={() => setEdit(true)}><Pencil size={18} />Editar</button>}
        </div>
        <div className="divider" />
        <LineaProduccion fases={r.fases} />
        <div className="divider" />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 }}>
          {INDICADORES.map(([k, l]) => (
            <div key={k} style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
              <div className="xs muted">{l}</div>
              <div className="strong num" style={{ fontSize: '1.12rem' }}>{r.toneladas[k] == null ? '—' : f.t(r.toneladas[k])}</div>
            </div>
          ))}
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'resumen' && (
        <div className="stack">
          <div className="grid g4">
            <Kpi label="Toneladas únicas" value={f.tNum(r.kg_unicos)} unit="t" sub={`${r.n_piezas} marcas · ${r.n_unidades} unidades`} />
            <Kpi label="Pendiente de fabricar" value={f.tNum(r.kg_pendiente_fabricar)} unit="t" tone="warn" sub={`Previstas: ${f.t(r.kg_previstos_fab)}`} />
            <Kpi label="Pendiente de montar" value={f.tNum(r.kg_pendiente_montar)} unit="t" tone="warn" sub={`Previstas: ${f.t(r.kg_previstos_montaje)}`} />
            <Kpi label="Producción acumulada" value={f.tNum(r.produccion_acumulada_kg)} unit="t" tone="idle" sub="Σ de fases (no es tonelaje)" />
          </div>
          <div className="grid g3">
            <div className="card span2"><div className="card-head"><div><h2>Avance por fase</h2><p>Cada % = toneladas completadas de la fase / previstas de la fase</p></div></div><PhaseList fases={r.fases} /></div>
            <div className="card">
              <h2 className="mb">¿Dónde está el material?</h2>
              <UbicacionBar fases={r.fases} totalKg={r.kg_unicos} />
              <div className="divider" />
              <dl className="kv">
                <dt>Contratadas</dt><dd>{f.t(r.kg_contratados)}</dd>
                <dt>Previstas fab.</dt><dd>{f.t(r.kg_previstos_fab)}</dd>
                <dt>Registradas</dt><dd>{f.t(r.kg_unicos)}{r.kg_previstos_fab && Math.abs(r.kg_unicos - r.kg_previstos_fab) > 1 ? <span className="muted"> ({f.pct((r.kg_unicos / r.kg_previstos_fab) * 100)} de lo previsto)</span> : null}</dd>
                <dt>Responsable</dt><dd>{o.responsable_nombre || '—'}</dd>
                {can('costes.ver') && <><dt>Presupuesto</dt><dd>{f.eur(o.presupuesto)}</dd></>}
                {o.observaciones && <><dt>Notas</dt><dd>{o.observaciones}</dd></>}
              </dl>
            </div>
          </div>
        </div>
      )}
      {tab === 'piezas' && (piezas.loading && !piezas.data ? <Loading /> : <PiezasTabla piezas={piezas.data || []} obraId={o.id} reload={() => { piezas.reload(); reload(); }} />)}
      {tab === 'fases' && <FasesObra obra={o} reload={reload} />}
      {tab === 'docs' && <ArchivosObra obraId={o.id} />}
      {tab === 'montaje' && <PartesObra obraId={o.id} />}
      {tab === 'costes' && <CostesObra obraId={o.id} />}
      {tab === 'historial' && <Historial obraId={o.id} />}
      {edit && <ObraForm obra={o} onClose={() => setEdit(false)} onSaved={reload} />}
    </>
  );
}
