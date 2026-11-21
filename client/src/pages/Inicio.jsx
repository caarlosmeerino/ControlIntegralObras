import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Seg, Empty } from '../components/ui.jsx';
import { Lupa } from '../components/iconos.jsx';
import ObraForm from '../components/ObraForm.jsx';
import { ProyectoFila } from './Cliente.jsx';
import { ACTIVAS, iniciales, urlCliente } from '../lib/obra.js';
import * as f from '../lib/format.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Inicio() {
  const { can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useData('/obras');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('curso');
  const [nueva, setNueva] = useState(false);

  const obras = useMemo(() => (data || []).filter((o) => estado === 'todas' || (estado === 'curso' ? ACTIVAS.includes(o.estado) : o.estado === 'terminada')), [data, estado]);
  const t = norm(q.trim());
  const coincide = (o) => !t || [o.cliente, o.ciudad, o.nombre, o.codigo, o.direccion].some((x) => norm(x).includes(t));
  const proyectos = t ? obras.filter(coincide) : [];
  const clientes = useMemo(() => {
    const m = new Map();
    for (const o of obras) {
      const k = o.cliente || 'Sin cliente';
      const c = m.get(k) || { nombre: k, obras: [], ciudades: new Set() };
      c.obras.push(o); if (o.ciudad) c.ciudades.add(o.ciudad); m.set(k, c);
    }
    return [...m.values()].filter((c) => !t || norm(c.nombre).includes(t) || c.obras.some(coincide)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [obras, t]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const enCurso = (data || []).filter((o) => ACTIVAS.includes(o.estado)).length;
  return (
    <>
      <div className="page-head">
        <div><h1>Proyectos</h1><p>{f.plural(enCurso, 'proyecto en curso', 'proyectos en curso')}</p></div>
        {can('obras.editar') && <button className="btn primary big" onClick={() => setNueva(true)}><Plus size={22} />Nuevo proyecto</button>}
      </div>

      <div className="row wrap mb">
        <div className="search busqueda-grande"><Lupa size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, ciudad o proyecto" aria-label="Buscar cliente, ciudad o proyecto" type="search" />
        </div>
        <Seg value={estado} onChange={setEstado} options={[['curso', 'En curso'], ['terminadas', 'Terminados'], ['todas', 'Todos']]} />
      </div>

      {t && (
        <section className="mb">
          <h2 className="seccion">Proyectos</h2>
          {proyectos.length ? <div className="lista">{proyectos.map((o) => <ProyectoFila key={o.id} o={o} mostrarCliente />)}</div> : <div className="muted small">Ningún proyecto coincide.</div>}
        </section>
      )}

      <section>
        <h2 className="seccion">Clientes</h2>
        {!clientes.length ? <Empty title={t ? `Nada coincide con «${q}»` : 'Todavía no hay proyectos'}>{!t && can('obras.editar') && 'Pulsa «Nuevo proyecto» para dar de alta el primero.'}</Empty> : (
          <div className="lista">
            {clientes.map((c) => {
              const activos = c.obras.filter((o) => ACTIVAS.includes(o.estado)).length;
              const retraso = c.obras.some((o) => o.resumen.retrasada);
              return (
                <Link key={c.nombre} to={urlCliente(c.nombre)} className="lista-fila">
                  <span className="avatar-cliente">{iniciales(c.nombre)}</span>
                  <div className="grow">
                    <div className="lista-titulo">{c.nombre}</div>
                    <div className="lista-sub">{f.plural(c.obras.length, 'proyecto')}{activos ? ` · ${activos} en curso` : ''}{c.ciudades.size ? ` · ${[...c.ciudades].join(', ')}` : ''}</div>
                  </div>
                  {retraso && <span className="badge bad">Retraso</span>}
                  <ChevronRight size={20} className="muted" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {nueva && <ObraForm clientes={[...new Set((data || []).map((o) => o.cliente).filter(Boolean))]} onClose={() => setNueva(false)} onSaved={(o) => nav(`/obras/${o.id}`)} />}
    </>
  );
}
