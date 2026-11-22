import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Empty, Status, Selector, BotonMas } from '../components/ui.jsx';
import ObraForm from '../components/ObraForm.jsx';
import { ACTIVAS, estadoEtapa, faseActual, obraRetrasada } from '../lib/obra.js';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import * as f from '../lib/format.js';

/** Fila de proyecto con el avance de sus fases */
export function ProyectoFila({ o, mostrarCliente }) {
  const etapas = o.etapas || [];
  const hechas = etapas.filter((e) => e.completada).length;
  const actual = faseActual(o);
  const retraso = obraRetrasada(o);
  return (
    <Link to={`/obras/${o.id}`} className="lista-fila proyecto-fila">
      <div className="grow">
        <div className="lista-titulo">{o.nombre}</div>
        <div className="lista-sub">{[o.codigo, mostrarCliente && o.cliente, o.ciudad, o.fecha_entrega && `fin ${f.fecha(o.fecha_entrega)}`].filter(Boolean).join(' · ')}</div>
        {etapas.length > 0 && (
          <div className="fases-mini">
            <div className="fases-puntos">{etapas.map((e) => <i key={e.id} className={estadoEtapa(e)} title={e.nombre} />)}</div>
            <span className="small muted">{hechas}/{etapas.length} fases{actual ? ` · ${actual.nombre}` : ' · todas terminadas'}</span>
          </div>
        )}
        <div className="mt-s">{retraso ? <Status estado="retrasado" small /> : <Status estado={o.estado} map={f.ESTADOS_OBRA} small />}</div>
      </div>
      <ChevronRight size={20} className="muted" />
    </Link>
  );
}

export default function Cliente() {
  const { nombre } = useParams();
  const cliente = decodeURIComponent(nombre);
  const { can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useData('/obras');
  const [estado, setEstado] = useState('curso');
  const [nueva, setNueva] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const todas = data.filter((o) => (o.cliente || 'Sin cliente') === cliente);
  const lista = todas.filter((o) => estado === 'todas' || (estado === 'curso' ? ACTIVAS.includes(o.estado) : o.estado === 'terminada'));
  const ciudades = [...new Set(todas.map((o) => o.ciudad).filter(Boolean))];
  return (
    <>
      <Link to="/" className="volver"><ChevronLeft size={20} />Proyectos</Link>
      <div className="page-head">
        <div className="row" style={{ gap: 16 }}>
          <AvatarCliente nombre={cliente} size={64} />
          <div><h1>{cliente}</h1><p>{f.plural(todas.length, 'proyecto')}{ciudades.length ? ` · ${ciudades.join(', ')}` : ''}</p></div>
        </div>
        {can('obras.editar') && <BotonMas texto="Nuevo proyecto" onClick={() => setNueva(true)} />}
      </div>
      <div className="mb"><Selector filtro titulo="Mostrar proyectos" value={estado} onChange={setEstado} options={[['curso', 'En curso'], ['terminadas', 'Terminados'], ['todas', 'Todos']]} /></div>
      {lista.length ? <div className="lista">{lista.map((o) => <ProyectoFila key={o.id} o={o} />)}</div> : <Empty title="No hay proyectos en este filtro" />}
      {nueva && <ObraForm cliente={cliente === 'Sin cliente' ? '' : cliente} onClose={() => setNueva(false)} onSaved={(o) => nav(`/obras/${o.id}`)} />}
    </>
  );
}
