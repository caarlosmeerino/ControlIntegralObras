import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, MapPin, Navigation, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Tabs, Status, Bar, BotonMas } from '../components/ui.jsx';
import PiezasProyecto from '../components/PiezasProyecto.jsx';
import { ArchivosObra } from '../components/Archivos.jsx';
import ObraForm from '../components/ObraForm.jsx';
import { urlCliente, estadoEtapa, obraRetrasada } from '../lib/obra.js';
import * as f from '../lib/format.js';

/** Fases creadas en el proyecto: cada una abre su checklist */
function Fases({ obra, onEditar }) {
  const etapas = obra.etapas || [];
  const hechas = etapas.filter((e) => e.completada).length;
  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Fases</h2><p>{etapas.length ? `${hechas} de ${etapas.length} terminadas` : 'Sin fases'}</p></div>
        {onEditar && <button className="btn sm" onClick={onEditar}><Pencil size={15} />Editar fases</button>}
      </div>
      {!etapas.length ? <div className="muted small">Pulsa «Editar fases» para crearlas.</div> : (
        <div className="lista lista-plana">
          {etapas.map((e) => {
            const est = estadoEtapa(e);
            const pct = e.tareas_total ? (e.tareas_hechas / e.tareas_total) * 100 : e.completada ? 100 : 0;
            return (
              <Link key={e.id} to={`/obras/${obra.id}/fases/${e.id}`} className="lista-fila fase-fila">
                <span className={`fase-num ${f.ESTADOS[est].tone}`}>{e.completada ? <CheckCircle2 size={16} /> : e.orden}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="lista-titulo">{e.nombre}</div>
                  <div className="lista-sub"><CalendarDays size={13} style={{ verticalAlign: -2 }} /> {f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}{e.tareas_total ? ` · checklist ${e.tareas_hechas}/${e.tareas_total}` : ''}</div>
                  <div className="row" style={{ gap: 10, marginTop: 8 }}>
                    <Status estado={est} small />
                    {e.tareas_total > 0 && <div className="grow"><Bar value={pct} tone={est === 'retrasado' ? 'bad' : pct >= 100 ? 'ok' : ''} /></div>}
                  </div>
                </div>
                <ChevronRight size={18} className="muted" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ObraDetalle() {
  const { id } = useParams();
  const { can } = useApp();
  const [tab, setTab] = useState('resumen');
  const [edit, setEdit] = useState(false);
  const { data: o, error, loading, reload } = useData(`/obras/${id}`);
  if (loading && !o) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const hayUbicacion = o.direccion || o.ciudad;
  const retrasada = obraRetrasada(o);
  return (
    <>
      <Link to={urlCliente(o.cliente)} className="volver"><ChevronLeft size={20} />{o.cliente || 'Sin cliente'}</Link>
      <div className="page-head">
        <div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
            <span className="code">{o.codigo}</span>
            {retrasada ? <Status estado="retrasado" small /> : <Status estado={o.estado} map={f.ESTADOS_OBRA} small />}
          </div>
          <h1>{o.nombre}</h1>
          <p>{[o.ciudad, o.fecha_inicio && `${f.fecha(o.fecha_inicio)} → ${f.fecha(o.fecha_entrega)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="acciones-cab">
          {hayUbicacion && <a className="btn-mas secundario" href={f.mapsUrl(o)} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Maps" title="Google Maps"><Navigation size={19} /><span className="txt">Google Maps</span></a>}
          {can('obras.editar') && <BotonMas texto="Editar" icon={Pencil} onClick={() => setEdit(true)} />}
        </div>
      </div>

      <Tabs ancho value={tab} onChange={setTab} tabs={[
        { id: 'resumen', label: 'Resumen' }, { id: 'piezas', label: 'Piezas' }, { id: 'planos', label: 'Planos' }, { id: 'docs', label: 'Documentos' },
      ]} />

      {tab === 'resumen' && (
        <div className="stack">
          <Fases obra={o} onEditar={can('obras.editar') ? () => setEdit(true) : null} />
          <div className="card">
            <h2 className="mb">Datos del proyecto</h2>
            <dl className="kv">
              <dt>Cliente</dt><dd>{o.cliente || '—'}</dd>
              <dt>Dirección</dt>
              <dd>
                {hayUbicacion ? (
                  <a className="enlace-mapa" href={f.mapsUrl(o)} target="_blank" rel="noopener noreferrer">
                    <MapPin size={16} /><span>{[o.direccion, [o.codigo_postal, o.ciudad].filter(Boolean).join(' '), o.provincia && o.provincia !== o.ciudad ? o.provincia : ''].filter(Boolean).join(', ')}</span>
                  </a>
                ) : '—'}
              </dd>
              <dt>Piezas</dt><dd>{f.plural(o.resumen.n_piezas, 'marca')} · {f.kg(o.resumen.kg_unicos)}</dd>
              {o.observaciones && <><dt>Notas</dt><dd>{o.observaciones}</dd></>}
            </dl>
          </div>
        </div>
      )}
      {tab === 'piezas' && <PiezasProyecto obraId={o.id} />}
      {tab === 'planos' && <ArchivosObra obraId={o.id} solo={['plano']} />}
      {tab === 'docs' && <ArchivosObra obraId={o.id} solo={['documento', 'foto']} />}
      {edit && <ObraForm obra={o} onClose={() => setEdit(false)} onSaved={reload} />}
    </>
  );
}
