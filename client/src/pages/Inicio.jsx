import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, AlertTriangle, FolderKanban } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Empty } from '../components/ui.jsx';
import { Lupa } from '../components/iconos.jsx';
import ObraForm from '../components/ObraForm.jsx';
import Calendario from '../components/Calendario.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import { ACTIVAS, urlCliente, estadoEtapa, obraRetrasada } from '../lib/obra.js';
import * as f from '../lib/format.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const saludo = () => { const h = new Date().getHours(); return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; };
const fechaLarga = () => { const t = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** Próximo hito de una obra: fase con retraso, fase que termina o fase que empieza */
function proximoHito(o, hoy) {
  const pend = (o.etapas || []).filter((e) => !e.completada);
  const ret = pend.find((e) => estadoEtapa(e, hoy) === 'retrasado');
  if (ret) return { e: ret, fecha: ret.fecha_fin, txt: `${ret.nombre} · ${dias(ret.fecha_fin, hoy)} días de retraso`, orden: -1 };
  const curso = pend.filter((e) => estadoEtapa(e, hoy) === 'en_curso' && e.fecha_fin).sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin))[0];
  if (curso) { const d = dias(hoy, curso.fecha_fin); return { e: curso, fecha: curso.fecha_fin, txt: `${curso.nombre} · termina ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}`, orden: d }; }
  const sig = pend.filter((e) => e.fecha_inicio && e.fecha_inicio > hoy).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0];
  if (sig) { const d = dias(hoy, sig.fecha_inicio); return { e: sig, fecha: sig.fecha_inicio, txt: `${sig.nombre} · empieza ${d === 1 ? 'mañana' : `en ${d} días`}`, orden: d }; }
  return null;
}

export default function Inicio() {
  const { can, user } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  useEffect(() => { if (params.get('nuevo') === '1') { if (can('obras.editar')) setNueva(true); setParams({}, { replace: true }); } }, [params]);
  const { data, error, loading, reload } = useData('/obras');
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState(false);
  const hoy = f.hoyISO();
  const activas = useMemo(() => (data || []).filter((o) => ACTIVAS.includes(o.estado)), [data]);
  const t = norm(q.trim());
  const clientes = useMemo(() => {
    const m = new Map();
    for (const o of data || []) {
      const k = o.cliente || 'Sin cliente';
      const c = m.get(k) || { nombre: k, obras: [], ciudades: new Set() };
      c.obras.push(o); if (o.ciudad) c.ciudades.add(o.ciudad); m.set(k, c);
    }
    return [...m.values()].filter((c) => !t || norm(c.nombre).includes(t) || c.obras.some((o) => [o.ciudad, o.nombre, o.codigo].some((x) => norm(x).includes(t))))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [data, t]);
  const proximas = useMemo(() => activas.map((o) => ({ o, h: proximoHito(o, hoy) })).filter((x) => x.h).sort((a, b) => a.h.orden - b.h.orden).slice(0, 6), [activas, hoy]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <>
      <section className="saludo">
        <div className="saludo-txt">
          <span className="saludo-pre">Planning</span>
          <h1>{saludo()}, {String(user.nombre).split(' ')[0]}</h1>
          <p>{fechaLarga()}</p>
        </div>
        <div className="saludo-datos">
          <span><FolderKanban size={17} />{f.plural(activas.length, 'proyecto en curso', 'proyectos en curso')}</span>
          {activas.filter(obraRetrasada).length > 0 && <span><AlertTriangle size={17} />{activas.filter(obraRetrasada).length} con retraso</span>}
        </div>
        {can('obras.editar') && <button type="button" className="saludo-btn" onClick={() => setNueva(true)}><Plus size={18} />Nuevo proyecto</button>}
      </section>

      <Calendario />

      <section className="mt">
        <div className="row between" style={{ margin: '24px 4px 10px' }}><h2 className="seccion" style={{ margin: 0 }}>Clientes</h2></div>
        <div className="search busqueda-grande mb" style={{ maxWidth: 'none' }}><Lupa size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, ciudad o proyecto" aria-label="Buscar cliente, ciudad o proyecto" type="search" />
        </div>
        {!clientes.length ? <Empty title={t ? `Nada coincide con «${q}»` : 'Todavía no hay proyectos'} /> : (
          <div className="lista">
            {clientes.map((c) => {
              const act = c.obras.filter((o) => ACTIVAS.includes(o.estado)).length;
              return (
                <Link key={c.nombre} to={urlCliente(c.nombre)} className="lista-fila">
                  <AvatarCliente nombre={c.nombre} size={44} />
                  <div className="grow">
                    <div className="lista-titulo">{c.nombre}{c.obras.some(obraRetrasada) && <i className="punto-retraso" title="Con retraso" />}</div>
                    <div className="lista-sub">{f.plural(c.obras.length, 'proyecto')}{act ? ` · ${act} en curso` : ''}{c.ciudades.size ? ` · ${[...c.ciudades].join(', ')}` : ''}</div>
                  </div>
                  <ChevronRight size={20} className="muted" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt">
        <h2 className="seccion" style={{ margin: '24px 4px 10px' }}>Obras más próximas</h2>
        {!proximas.length ? <Empty title="No hay fases próximas" /> : (
          <div className="lista">
            {proximas.map(({ o, h }) => {
              const est = estadoEtapa(h.e, hoy);
              return (
                <Link key={o.id} to={`/obras/${o.id}`} className="lista-fila">
                  <div className={`fecha-chip ${est}`}><b>{Number(h.fecha.slice(8))}</b><span>{f.MESES_CORTOS[Number(h.fecha.slice(5, 7)) - 1]}</span></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="lista-titulo">{o.nombre}</div>
                    <div className="lista-sub">{o.cliente}{o.ciudad ? ` · ${o.ciudad}` : ''}</div>
                    <div className="small" style={{ marginTop: 2, color: est === 'retrasado' ? 'var(--bad-txt)' : 'var(--text-2)' }}>{h.txt}</div>
                  </div>
                  <ChevronRight size={18} className="muted" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {nueva && <ObraForm onClose={() => setNueva(false)} onSaved={(o) => nav(`/obras/${o.id}`)} />}
    </>
  );
}
