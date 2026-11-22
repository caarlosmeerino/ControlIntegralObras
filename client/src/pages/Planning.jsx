import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Flag, PlayCircle, Circle, CheckCircle2, X } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { qs, put } from '../lib/api.js';
import { Loading, ErrorBox, Status, Empty, Cabecera, Selector, Seg } from '../components/ui.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import { lunesDeSemana, semanaISO, masDias, semanasDelAnio, MESES, DIAS, estadoEtapa, pastelObra } from '../lib/obra.js';
import { barrasSemana } from '../components/Calendario.jsx';
import * as f from '../lib/format.js';

const diaTxt = (iso) => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;

/** Planning de una semana: filtros por proyecto y empleado, diagrama y lo que queda por hacer */
export default function Planning() {
  const { anio, semana } = useParams();
  const nav = useNavigate();
  const { can, toastError } = useApp();
  const [params, setParams] = useSearchParams();
  const fObra = params.get('obra') || '';
  const fEmp = params.get('empleado') || '';
  const vista = params.get('ver') || 'pendiente';
  const A = Number(anio); const S = Number(semana);
  const lunes = lunesDeSemana(A, S);
  const domingo = masDias(lunes, 6);
  const hoy = f.hoyISO();
  const { data, error, loading, reload, setData } = useData(`/etapas/planning${qs({ desde: lunes, hasta: domingo })}`);
  const { data: empleados } = useData(can('personal.ver') ? '/empleados' : null);
  const [hechas, setHechas] = useState({}); // tareas marcadas ahora (se quedan visibles tachadas)

  const filtrar = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const ir = (n) => {
    let a = A; let s = S + n;
    if (s < 1) { a -= 1; s = semanasDelAnio(a); } else if (s > semanasDelAnio(a)) { a += 1; s = 1; }
    nav(`/planning/${a}/${s}${params.toString() ? `?${params}` : ''}`);
  };
  const actual = semanaISO(hoy);

  const todas = useMemo(() => (data || []).map((e) => ({ ...e, estado: estadoEtapa(e) })), [data]);
  const emp = (empleados || []).find((x) => String(x.id) === fEmp);
  const obrasEmp = emp ? new Set(emp.obras.map((o) => o.id)) : null;
  const filtradas = todas.filter((e) => (!fObra || String(e.obra_id) === fObra) && (!obrasEmp || obrasEmp.has(e.obra_id)));
  const semanaEtapas = filtradas.filter((e) => !e.arrastrada);
  const barras = barrasSemana(semanaEtapas, lunes);
  const empiezan = semanaEtapas.filter((e) => e.fecha_inicio >= lunes && e.fecha_inicio <= domingo);
  const terminan = semanaEtapas.filter((e) => e.fecha_fin >= lunes && e.fecha_fin <= domingo);
  const retraso = filtradas.filter((e) => e.estado === 'retrasado');

  // Opciones de los filtros
  const obrasOpc = [...new Map(todas.map((e) => [e.obra_id, e.obra_nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  if (fObra && !obrasOpc.some(([id]) => String(id) === fObra)) obrasOpc.push([Number(fObra), 'Proyecto sin fases esta semana']);

  // Lo que queda por hacer, agrupado por proyecto
  const pendientes = filtradas.filter((e) => !e.completada);
  const grupos = [];
  for (const e of [...pendientes].sort((a, b) => a.obra_nombre.localeCompare(b.obra_nombre, 'es') || a.orden - b.orden)) {
    let g = grupos.find((x) => x.id === e.obra_id);
    if (!g) grupos.push(g = { id: e.obra_id, nombre: e.obra_nombre, cliente: e.cliente, etapas: [] });
    g.etapas.push(e);
  }
  const nTareas = pendientes.reduce((s, e) => s + e.pendientes.length, 0);

  const marcar = async (t, e) => {
    const si = !hechas[t.id];
    setHechas({ ...hechas, [t.id]: si });
    try { await put(`/etapas/tareas/${t.id}`, { hecha: si }); } catch (err) { setHechas({ ...hechas, [t.id]: !si }); toastError(err); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  const editar = can('obras.editar', 'fases.editar');
  const hayFiltro = fObra || fEmp;

  return (
    <>
      <Link to="/" className="volver"><ChevronLeft size={20} />Inicio</Link>
      <Cabecera icono={<span className="icono-cab icono-semana"><small>SEM</small>{S}</span>} titulo={`Semana ${S}`}
        sub={`${diaTxt(lunes)} – ${diaTxt(domingo)} ${domingo.slice(0, 4)}`}
        estado={A === actual.anio && S === actual.semana ? <span className="badge info">Esta semana</span> : null}
        acciones={<div className="nav-semana">
          <button className="btn ghost icon sm" onClick={() => ir(-1)} aria-label="Semana anterior"><ChevronLeft size={22} /></button>
          <button className="btn sm" onClick={() => nav(`/planning/${actual.anio}/${actual.semana}${params.toString() ? `?${params}` : ''}`)}>Hoy</button>
          <button className="btn ghost icon sm" onClick={() => ir(1)} aria-label="Semana siguiente"><ChevronRight size={22} /></button>
        </div>} />

      {/* Filtros */}
      <div className="filtros-semana mb">
        <Selector filtro titulo="Proyecto" value={fObra} onChange={(v) => filtrar('obra', v)} placeholder="Todos los proyectos"
          options={[{ value: '', label: 'Todos los proyectos' }, ...obrasOpc.map(([id, n]) => ({ value: String(id), label: n }))]} />
        {empleados && (
          <Selector filtro titulo="Empleado" value={fEmp} onChange={(v) => filtrar('empleado', v)} placeholder="Todos los empleados"
            options={[{ value: '', label: 'Todos los empleados' }, ...empleados.filter((x) => x.activo).map((x) => ({ value: String(x.id), label: x.nombre, sub: x.obras.length ? x.obras.map((o) => o.nombre).join(' · ') : 'Sin proyecto asignado' }))]} />
        )}
        {hayFiltro && <button type="button" className="btn ghost sm" onClick={() => setParams({ ...(vista !== 'pendiente' ? { ver: vista } : {}) }, { replace: true })}><X size={16} />Quitar filtros</button>}
      </div>
      {emp && !emp.obras.length && <div className="aviso-suave mb">{emp.nombre} no está en el equipo de ningún proyecto. Añádelo desde la pestaña «Equipo» de cada proyecto.</div>}

      {loading && !data ? <Loading /> : (
        <>
          <div className="resumen-semana mb">
            <div><PlayCircle size={18} /><b>{empiezan.length}</b><span>empiezan</span></div>
            <div><Flag size={18} /><b>{terminan.length}</b><span>terminan</span></div>
            <div className={retraso.length ? 'mal' : ''}><AlertTriangle size={18} /><b>{retraso.length}</b><span>con retraso</span></div>
          </div>

          <div className="mb"><Seg value={vista} onChange={(v) => filtrar('ver', v === 'pendiente' ? '' : v)}
            options={[['pendiente', `Por hacer${pendientes.length ? ` (${pendientes.length})` : ''}`], ['semana', 'Diagrama de la semana']]} /></div>

          {vista === 'pendiente' ? (
            !grupos.length ? (
              <div className="card"><Empty icon={CheckCircle2} title={filtradas.length ? 'Todo hecho esta semana' : 'No hay fases esta semana'}>
                {hayFiltro ? 'Con los filtros elegidos.' : filtradas.length ? 'Todas las fases de la semana están confirmadas como terminadas.' : ''}</Empty></div>
            ) : (
              <>
                <p className="small muted" style={{ margin: '0 4px 10px' }}>{f.plural(pendientes.length, 'fase pendiente', 'fases pendientes')} · {f.plural(nTareas, 'tarea sin hacer', 'tareas sin hacer')}</p>
                <div className="stack">
                  {grupos.map((g) => (
                    <div key={g.id} className="card pad0 grupo-obra">
                      <Link to={`/obras/${g.id}`} className="grupo-obra-cab">
                        <AvatarCliente nombre={g.cliente || g.nombre} size={34} />
                        <span className="grow" style={{ minWidth: 0 }}><b>{g.nombre}</b><small>{g.cliente}</small></span>
                        <ChevronRight size={18} className="muted" />
                      </Link>
                      {g.etapas.map((e) => (
                        <div key={e.id} className="pend-fase">
                          <Link to={`/obras/${e.obra_id}/fases/${e.id}`} className="pend-fase-cab">
                            <span className="pend-barra" style={pastelObra(e.obra_nombre)} />
                            <span className="grow" style={{ minWidth: 0 }}>
                              <b>{e.nombre}</b>
                              <small>{f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}{e.arrastrada ? ' · de semanas anteriores' : e.fecha_fin >= lunes && e.fecha_fin <= domingo ? ' · termina esta semana' : ''}</small>
                            </span>
                            <Status estado={e.estado} small />
                          </Link>
                          {e.pendientes.length > 0 ? (
                            <div className="pend-tareas">
                              {e.pendientes.map((t) => (
                                <button key={t.id} type="button" className={`pend-tarea ${hechas[t.id] ? 'hecha' : ''}`} disabled={!editar} onClick={() => marcar(t, e)}
                                  aria-label={hechas[t.id] ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}>
                                  {hechas[t.id] ? <CheckCircle2 size={22} /> : <Circle size={22} />}<span>{t.texto}</span>
                                </button>
                              ))}
                            </div>
                          ) : <div className="pend-vacia">{e.tareas_total ? 'Checklist completo: falta confirmar la fase como terminada.' : 'Sin checklist. Ábrela para añadir tareas o confirmarla.'}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )
          ) : !semanaEtapas.length ? <div className="card"><Empty icon={CalendarDays} title="No hay fases programadas esta semana" /></div> : (
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
                    <span className={`sg-barra ${e.estado}`} style={{ gridColumn: `${a + 1} / ${b + 2}`, ...pastelObra(e.obra_nombre) }}>
                      {e.tareas_total ? `${e.tareas_hechas}/${e.tareas_total}` : ''}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
