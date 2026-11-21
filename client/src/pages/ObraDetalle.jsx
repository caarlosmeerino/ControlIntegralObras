import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Pencil, MapPin, Navigation, CalendarDays } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Tabs, Ring, Status, PhaseList, UbicacionBar } from '../components/ui.jsx';
import Despiece from '../components/Despiece.jsx';
import Enlaces from '../components/Enlaces.jsx';
import ObraForm from '../components/ObraForm.jsx';
import { avanceGrupo, urlCliente } from '../lib/obra.js';
import * as f from '../lib/format.js';

function Bloque({ titulo, grupo, r, texto }) {
  const { fases, porcentaje } = avanceGrupo(r, grupo);
  return (
    <div className="card">
      <div className="row" style={{ gap: 18, marginBottom: 14 }}>
        <Ring value={porcentaje} size={84} tone={porcentaje >= 100 ? 'ok' : undefined} />
        <div><h2>{titulo}</h2><div className="muted small mt-s">{texto}</div></div>
      </div>
      <PhaseList fases={fases} sinEstado />
    </div>
  );
}

/** Situación de una fase según sus fechas */
function plazo(e) {
  const hoy = f.hoyISO();
  const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  if (e.fecha_inicio && hoy < e.fecha_inicio) return ['idle', `Empieza en ${dias(hoy, e.fecha_inicio)} días`];
  if (e.fecha_fin && hoy > e.fecha_fin) return ['ok', 'Plazo finalizado'];
  if (e.fecha_fin) return ['warn', `En curso · quedan ${dias(hoy, e.fecha_fin)} días`];
  return e.fecha_inicio ? ['warn', 'En curso'] : ['idle', 'Sin fechas'];
}

function Fases({ etapas, onEditar }) {
  return (
    <div className="card">
      <div className="card-head"><h2>Fases</h2>{onEditar && <button className="btn sm" onClick={onEditar}><Pencil size={15} />Editar</button>}</div>
      {!etapas.length ? <div className="muted small">Sin fases. Pulsa «Editar» para añadirlas.</div> : (
        <div className="fases-lista">
          {etapas.map((e, i) => {
            const [tone, txt] = plazo(e);
            return (
              <div key={e.id || i} className="fase-linea">
                <span className={`fase-num ${tone}`}>{i + 1}</span>
                <div className="grow">
                  <div className="strong">{e.nombre}</div>
                  <div className="small muted"><CalendarDays size={14} style={{ verticalAlign: -2 }} /> {f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}</div>
                </div>
                <span className={`badge ${tone}`}>{txt}</span>
              </div>
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
  const piezas = useData(tab === 'fabricacion' || tab === 'montaje' ? `/piezas?obra_id=${id}` : null, [tab]);
  if (loading && !o) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const r = o.resumen;
  const recargar = () => { piezas.reload(); reload(); };
  const hayUbicacion = o.direccion || o.ciudad;
  const prevKg = r.kg_previstos_fab || r.kg_unicos;
  return (
    <>
      <Link to={urlCliente(o.cliente)} className="volver"><ChevronLeft size={20} />{o.cliente || 'Sin cliente'}</Link>
      <div className="page-head">
        <div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
            <span className="code">{o.codigo}</span>
            {r.retrasada ? <Status estado="retrasado" small /> : <Status estado={o.estado} map={f.ESTADOS_OBRA} small />}
          </div>
          <h1>{o.nombre}</h1>
          <p>{[o.ciudad, o.fecha_inicio && `${f.fecha(o.fecha_inicio)} → ${f.fecha(o.fecha_entrega)}`, f.kg(r.kg_unicos)].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="page-actions" style={{ width: 'auto' }}>
          {hayUbicacion && <a className="btn sm maps" href={f.mapsUrl(o)} target="_blank" rel="noopener noreferrer"><Navigation size={15} />Google Maps</a>}
          {can('obras.editar') && <button className="btn sm" onClick={() => setEdit(true)}><Pencil size={15} />Editar</button>}
        </div>
      </div>

      <Tabs ancho value={tab} onChange={setTab} tabs={[
        { id: 'resumen', label: 'Resumen' }, { id: 'fabricacion', label: 'Fabricación' }, { id: 'montaje', label: 'Montaje' },
        { id: 'planos', label: 'Planos' }, { id: 'docs', label: 'Documentos' },
      ]} />

      {tab === 'resumen' && (
        <div className="stack">
          <div className="grid g2">
            <Bloque titulo="Fabricación" grupo="fabricacion" r={r} texto={`${f.kg(r.kg_salida_taller)} terminados en taller de ${f.kg(prevKg)}`} />
            <Bloque titulo="Montaje" grupo="montaje" r={r} texto={`${f.kg(r.kg_montados)} montados de ${f.kg(r.kg_previstos_montaje || r.kg_unicos)}`} />
          </div>
          <div className="grid g2">
            <Fases etapas={o.etapas || []} onEditar={can('obras.editar') ? () => setEdit(true) : null} />
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
                <dt>Despiece</dt><dd>{f.kg(r.kg_unicos)} · {f.m2(o.m2_despiece)} · {f.ml(o.ml_despiece)}</dd>
                {o.observaciones && <><dt>Notas</dt><dd>{o.observaciones}</dd></>}
              </dl>
            </div>
          </div>
          <div className="card">
            <h2 className="mb">¿Dónde está el material?</h2>
            <UbicacionBar fases={r.fases} totalKg={r.kg_unicos} />
          </div>
        </div>
      )}
      {(tab === 'fabricacion' || tab === 'montaje') && (piezas.loading && !piezas.data ? <Loading /> : <Despiece key={tab} modo={tab} piezas={piezas.data || []} obraId={o.id} reload={recargar} />)}
      {tab === 'planos' && <Enlaces obraId={o.id} tipo="plano" />}
      {tab === 'docs' && <Enlaces obraId={o.id} tipo="documento" />}
      {edit && <ObraForm obra={o} onClose={() => setEdit(false)} onSaved={reload} />}
    </>
  );
}
