import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { Bascula, PerfilH, Grua, Peligro, Escaner, Casco, Soldadura, Nave } from '../components/iconos.jsx';
import { useApp, useData } from '../lib/app.jsx';
import { Kpi, Loading, ErrorBox, Ring, Status, BarChart, SERIES_FASES, Empty, LineaProduccion } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export function ObraCard({ o }) {
  const nav = useNavigate();
  const r = o.resumen;
  return (
    <div className="card obra-card" onClick={() => nav(`/obras/${o.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/obras/${o.id}`)}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row wrap" style={{ gap: 8 }}><span className="code">{o.codigo}</span>{r.retrasada ? <Status estado="retrasado" small /> : <Status estado={o.estado} map={f.ESTADOS_OBRA} small />}</div>
          <h3 className="mt-s">{o.nombre}</h3>
          <div className="small muted">{o.cliente} · entrega {f.fecha(o.fecha_entrega)}</div>
        </div>
        <Ring value={r.avance_global} size={76} label="global" tone={r.retrasada ? 'bad' : undefined} />
      </div>
      <div className="grid g3" style={{ gap: 8, gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div><div className="xs muted">Únicas</div><div className="strong num">{f.t(r.kg_unicos, 1)}</div></div>
        <div><div className="xs muted">Fabricadas</div><div className="strong num">{f.t(r.kg_fabricados, 1)}</div></div>
        <div><div className="xs muted">Montadas</div><div className="strong num">{f.t(r.kg_montados, 1)}</div></div>
      </div>
      <LineaProduccion fases={r.fases} compact />
    </div>
  );
}

export default function Panel() {
  const { user, can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useData('/panel');
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} retry={reload} />;
  const k = data.kpis;
  const acciones = [
    can('piezas.ver') && { to: '/escanear', icon: Escaner, t: 'Escanear pieza', s: 'Ver ficha y registrar avance' },
    can('avance.taller') && { to: '/fabricacion', icon: PerfilH, t: 'Avance de fabricación', s: 'Piezas pendientes por fase' },
    can('partes.montaje') && { to: '/control-obra', icon: Casco, t: 'Parte de montaje', s: 'Registro diario en obra' },
    can('partes.taller') && { to: '/taller', icon: Soldadura, t: 'Registrar horas', s: 'Parte de horas del taller' },
    can('obras.editar') && { to: '/obras?nueva=1', icon: Nave, t: 'Nueva obra', s: 'Alta con las 9 fases' },
  ].filter(Boolean).slice(0, 4);
  return (
    <>
      <div className="page-head">
        <div><h1>Hola, {user.nombre.split(' ')[0]}</h1><p>Situación de la producción a {f.fecha(data.hoy)} · {f.plural(k.obras_activas, 'obra activa', 'obras activas')}</p></div>
      </div>
      <div className="grid g4 mb">
        {acciones.map((a) => (
          <button key={a.to} className="big-action" onClick={() => nav(a.to)}>
            <span className="ico"><a.icon size={30} /></span><span>{a.t}<small>{a.s}</small></span>
          </button>
        ))}
      </div>
      <div className="grid g4 mb">
        <Kpi icon={Bascula} label="Toneladas únicas" value={f.tNum(k.kg_unicos, 1)} unit="t" sub={`Previstas: ${f.t(k.kg_previstos_fab, 1)}`} />
        <Kpi icon={PerfilH} label="Fabricadas" value={f.tNum(k.kg_fabricados, 1)} unit="t" tone="ok" sub={`Pendiente: ${f.t(k.kg_pendiente_fabricar, 1)}`} />
        <Kpi icon={Grua} label="Montadas" value={f.tNum(k.kg_montados, 1)} unit="t" tone="ok" sub={`Pendiente: ${f.t(k.kg_pendiente_montar, 1)}`} />
        <Kpi icon={Peligro} label="Obras con retraso" value={k.obras_retrasadas} tone={k.obras_retrasadas ? 'bad' : 'ok'} sub={`de ${k.obras_activas} activas`} />
      </div>
      <div className="grid g3 mb">
        <div className="card span2">
          <div className="card-head">
            <div><h2>Producción de los últimos 14 días</h2><p>Kilos procesados por fase (producción acumulada)</p></div>
            <div className="row wrap small">
              <span className="badge info">Hoy: {f.t(k.hoy_acumulado)}</span>
            </div>
          </div>
          <BarChart data={data.serie} series={SERIES_FASES} />
        </div>
        <div className="card">
          <h2>Hoy</h2>
          <div className="stack mt" style={{ gap: 12 }}>
            {[['Cortado', k.hoy_cortados, '#64d2ff'], ['Armado y soldado', k.hoy_armados, '#0a84ff'], ['Pintado', k.hoy_pintados, '#ff9f0a'], ['Montado', k.hoy_montados, '#30d158']].map(([l, v, c]) => (
              <div key={l} className="row between"><span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: c }} />{l}</span><b className="num">{f.t(v)}</b></div>
            ))}
          </div>
          <div className="banner info mt small" style={{ alignItems: 'flex-start' }}><Info size={18} style={{ flex: 'none', marginTop: 2 }} />
            <span>Una misma tonelada pasa por varias fases. Las <b>toneladas únicas</b> cuentan cada pieza una sola vez; la <b>producción acumulada</b> suma lo procesado en cada fase.</span></div>
        </div>
      </div>
      <div className="row between mb"><h2>Obras en curso</h2><Link to="/obras" className="btn ghost sm">Ver todas<ArrowRight size={16} /></Link></div>
      {data.obras.length ? <div className="grid g-auto mb">{data.obras.map((o) => <ObraCard key={o.id} o={o} />)}</div> : <Empty title="No hay obras activas" />}
      <div className="grid g2">
        <div className="card">
          <h2 className="mb">Últimos movimientos</h2>
          {data.ultimos.length ? data.ultimos.map((m) => (
            <Link key={m.id} to={`/piezas/${m.pieza_id}`} className="file-row" style={{ color: 'var(--text)' }}>
              <span className="marca" style={{ minWidth: 64 }}>{m.marca}</span>
              <div className="grow"><div className="small strong">{m.cantidad > 0 ? '' : 'Corrección · '}{m.fase}</div><div className="xs muted">{m.codigo} · {m.usuario || '—'} · {f.fechaHora(m.fecha)}</div></div>
              <b className="num small" style={{ color: m.kg < 0 ? 'var(--bad)' : undefined }}>{f.kg(m.kg)}</b>
            </Link>
          )) : <Empty title="Sin movimientos todavía" />}
        </div>
        <div className="card">
          <h2 className="mb">Incidencias abiertas</h2>
          {data.incidencias.length ? data.incidencias.map((p) => (
            <Link key={p.id} to={`/piezas/${p.id}`} className="file-row" style={{ color: 'var(--text)' }}>
              <Peligro size={22} style={{ color: 'var(--bad)' }} /><span className="marca">{p.marca}</span>
              <div className="grow small"><span className="code">{p.codigo}</span> {p.observaciones}</div>
            </Link>
          )) : <Empty title="Sin incidencias" />}
        </div>
      </div>
    </>
  );
}
