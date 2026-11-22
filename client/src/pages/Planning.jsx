import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, AlertTriangle, Flag, PlayCircle } from 'lucide-react';
import { useData } from '../lib/app.jsx';
import { qs } from '../lib/api.js';
import { Loading, ErrorBox, Status, Empty, Cabecera } from '../components/ui.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import { lunesDeSemana, semanaISO, masDias, semanasDelAnio, MESES, DIAS, estadoEtapa, colorCliente } from '../lib/obra.js';
import { barrasSemana } from '../components/Calendario.jsx';
import * as f from '../lib/format.js';

const diaTxt = (iso) => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;

/** Planning de una semana del año: fases activas, qué empieza, qué termina y qué va con retraso */
export default function Planning() {
  const { anio, semana } = useParams();
  const nav = useNavigate();
  const A = Number(anio); const S = Number(semana);
  const lunes = lunesDeSemana(A, S);
  const domingo = masDias(lunes, 6);
  const hoy = f.hoyISO();
  const { data, error, loading, reload } = useData(`/etapas/planning${qs({ desde: lunes, hasta: domingo })}`);
  const ir = (n) => {
    let a = A; let s = S + n;
    if (s < 1) { a -= 1; s = semanasDelAnio(a); } else if (s > semanasDelAnio(a)) { a += 1; s = 1; }
    nav(`/planning/${a}/${s}`);
  };
  const actual = semanaISO(hoy);
  if (error) return <ErrorBox error={error} retry={reload} />;
  const etapas = (data || []).map((e) => ({ ...e, estado: estadoEtapa(e) }));
  const barras = barrasSemana(etapas, lunes);
  const empiezan = etapas.filter((e) => e.fecha_inicio >= lunes && e.fecha_inicio <= domingo);
  const terminan = etapas.filter((e) => e.fecha_fin >= lunes && e.fecha_fin <= domingo);
  const retraso = etapas.filter((e) => e.estado === 'retrasado');

  return (
    <>
      <Link to="/" className="volver"><ChevronLeft size={20} />Inicio</Link>
      <Cabecera icono={<span className="icono-cab icono-semana"><small>SEM</small>{S}</span>} titulo={`Semana ${S}`}
        sub={`${diaTxt(lunes)} – ${diaTxt(domingo)} ${domingo.slice(0, 4)}`}
        estado={A === actual.anio && S === actual.semana ? <span className="badge info">Esta semana</span> : null}
        acciones={<div className="nav-semana">
          <button className="btn ghost icon sm" onClick={() => ir(-1)} aria-label="Semana anterior"><ChevronLeft size={22} /></button>
          <button className="btn sm" onClick={() => nav(`/planning/${actual.anio}/${actual.semana}`)}>Hoy</button>
          <button className="btn ghost icon sm" onClick={() => ir(1)} aria-label="Semana siguiente"><ChevronRight size={22} /></button>
        </div>} />

      {loading && !data ? <Loading /> : !etapas.length ? <div className="card"><Empty icon={CalendarDays} title="No hay fases programadas esta semana" /></div> : (
        <>
          <div className="resumen-semana mb">
            <div><PlayCircle size={18} /><b>{empiezan.length}</b><span>empiezan</span></div>
            <div><Flag size={18} /><b>{terminan.length}</b><span>terminan</span></div>
            <div className={retraso.length ? 'mal' : ''}><AlertTriangle size={18} /><b>{retraso.length}</b><span>con retraso</span></div>
          </div>

          <div className="card semana-gantt mb">
            <div className="sg-cab">
              <span />
              {DIAS.map((d, i) => { const iso = masDias(lunes, i); return <span key={d} className={iso === hoy ? 'hoy' : ''}>{d}<b>{Number(iso.slice(8))}</b></span>; })}
            </div>
            {barras.map(({ e, a, b }) => (
              <Link key={e.id} to={`/obras/${e.obra_id}/fases/${e.id}`} className="sg-fila">
                <span className="sg-nombre">
                  <AvatarCliente nombre={e.cliente || e.obra_nombre} size={28} />
                  <span style={{ minWidth: 0 }}><b>{e.obra_nombre}</b><small>{e.nombre}</small></span>
                </span>
                <span className="sg-pista">
                  {Array.from({ length: 7 }, (_, i) => <i key={i} className={masDias(lunes, i) === hoy ? 'hoy' : ''} />)}
                  <span className={`sg-barra ${e.estado}`} style={{ gridColumn: `${a + 1} / ${b + 2}`, '--c': colorCliente(e.obra_nombre) }}>
                    {e.tareas_total ? `${e.tareas_hechas}/${e.tareas_total}` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="lista">
            {etapas.map((e) => (
              <Link key={e.id} to={`/obras/${e.obra_id}/fases/${e.id}`} className="lista-fila">
                <span className={`fase-num ${f.ESTADOS[e.estado].tone}`}>{e.completada ? <CheckCircle2 size={16} /> : e.orden}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="lista-titulo">{e.nombre}</div>
                  <div className="lista-sub strong" style={{ color: 'var(--text-2)' }}>{e.obra_nombre}</div>
                  <div className="lista-sub">{e.cliente} · {f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}{e.tareas_total ? ` · checklist ${e.tareas_hechas}/${e.tareas_total}` : ''}
                    {e.fecha_inicio >= lunes && e.fecha_inicio <= domingo ? ' · empieza esta semana' : ''}{e.fecha_fin >= lunes && e.fecha_fin <= domingo ? ' · termina esta semana' : ''}</div>
                  <div className="mt-s"><Status estado={e.estado} small /></div>
                </div>
                <ChevronRight size={18} className="muted" />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
