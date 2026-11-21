import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Tabs, Ring, Status, PhaseList, UbicacionBar } from '../components/ui.jsx';
import Despiece from '../components/Despiece.jsx';
import { ArchivosObra } from '../components/Archivos.jsx';
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

export default function ObraDetalle() {
  const { id } = useParams();
  const { can } = useApp();
  const [tab, setTab] = useState('resumen');
  const [edit, setEdit] = useState(false);
  const { data: o, error, loading, reload } = useData(`/obras/${id}`);
  const piezas = useData(tab === 'fabricacion' || tab === 'montaje' ? `/piezas?obra_id=${id}` : null, [tab]);
  const clientes = useData(edit ? '/obras' : null, [edit]);
  if (loading && !o) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const r = o.resumen;
  const recargar = () => { piezas.reload(); reload(); };
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
          <p>{[o.ciudad, o.fecha_entrega && `Entrega ${f.fecha(o.fecha_entrega)}`, `${f.t(r.kg_unicos)} en despiece`].filter(Boolean).join(' · ')}</p>
        </div>
        {can('obras.editar') && <button className="btn sm" onClick={() => setEdit(true)}><Pencil size={16} />Editar</button>}
      </div>

      <Tabs ancho value={tab} onChange={setTab} tabs={[
        { id: 'resumen', label: 'Resumen' }, { id: 'fabricacion', label: 'Fabricación' }, { id: 'montaje', label: 'Montaje' },
        { id: 'planos', label: 'Planos' }, { id: 'docs', label: 'Documentos' },
      ]} />

      {tab === 'resumen' && (
        <div className="stack">
          <div className="grid g2">
            <Bloque titulo="Fabricación" grupo="fabricacion" r={r} texto={`${f.t(r.kg_salida_taller)} terminadas en taller de ${f.t(r.kg_previstos_fab || r.kg_unicos)}`} />
            <Bloque titulo="Montaje" grupo="montaje" r={r} texto={`${f.t(r.kg_montados)} montadas de ${f.t(r.kg_previstos_montaje || r.kg_unicos)}`} />
          </div>
          <div className="grid g2">
            <div className="card">
              <h2 className="mb">¿Dónde está el material?</h2>
              <UbicacionBar fases={r.fases} totalKg={r.kg_unicos} />
            </div>
            <div className="card">
              <h2 className="mb">Datos del proyecto</h2>
              <dl className="kv">
                <dt>Cliente</dt><dd>{o.cliente || '—'}</dd>
                <dt>Ciudad</dt><dd>{o.ciudad || '—'}</dd>
                <dt>Dirección</dt><dd>{o.direccion || '—'}</dd>
                <dt>Fechas</dt><dd>{f.fecha(o.fecha_inicio)} → {f.fecha(o.fecha_entrega)}</dd>
                <dt>Toneladas</dt><dd>{f.t(r.kg_previstos_fab)} previstas · {f.t(r.kg_unicos)} en despiece</dd>
                {can('costes.ver') && o.presupuesto > 0 && <><dt>Presupuesto</dt><dd>{f.eur(o.presupuesto)}</dd></>}
                {o.observaciones && <><dt>Notas</dt><dd>{o.observaciones}</dd></>}
              </dl>
            </div>
          </div>
        </div>
      )}
      {(tab === 'fabricacion' || tab === 'montaje') && (piezas.loading && !piezas.data ? <Loading /> : <Despiece key={tab} modo={tab} piezas={piezas.data || []} obraId={o.id} reload={recargar} />)}
      {tab === 'planos' && <ArchivosObra obraId={o.id} solo={['plano']} />}
      {tab === 'docs' && <ArchivosObra obraId={o.id} solo={['documento', 'foto']} />}
      {edit && <ObraForm obra={o} clientes={[...new Set((clientes.data || []).map((x) => x.cliente).filter(Boolean))]} onClose={() => setEdit(false)} onSaved={reload} />}
    </>
  );
}
