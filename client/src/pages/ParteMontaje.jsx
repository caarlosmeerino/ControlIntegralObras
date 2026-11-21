import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Kpi, Empty } from '../components/ui.jsx';
import { Subir, Galeria } from '../components/Archivos.jsx';
import * as f from '../lib/format.js';

export default function ParteMontaje() {
  const { id } = useParams();
  const { data: p, error, loading, reload } = useData(`/montaje/partes/${id}`);
  if (loading && !p) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <>
      <Link to={`/obras/${p.obra_id}`} className="btn ghost sm mb"><ArrowLeft size={18} />{p.obra_codigo}</Link>
      <div className="page-head"><div><h1>Parte de montaje · {f.fecha(p.fecha)}</h1><p>{p.obra_codigo} · {p.obra_nombre} · {p.encargado} · {p.clima}</p></div></div>
      <div className="grid g4 mb">
        <Kpi label="Montado" value={f.tNum(p.kg_montados)} unit="t" tone="ok" sub={`${p.piezas_montadas} unidades`} />
        <Kpi label="Recibido" value={f.tNum(p.kg_recibidos)} unit="t" sub={`${p.piezas_recibidas} unidades · ${p.piezas_descargadas} descargadas`} />
        <Kpi label="Horas" value={f.num(p.horas_totales, 1)} unit="h" tone="idle" sub={`${p.horas.length} persona(s)`} />
        <Kpi label="Rendimiento" value={p.horas_totales ? f.num(p.kg_montados / p.horas_totales) : '—'} unit="kg/h" tone="idle" />
      </div>
      {p.incidencias && <div className="banner bad">{p.incidencias}</div>}
      <div className="grid g2">
        <div className="card"><h2 className="mb">Piezas</h2>
          {p.movimientos.length ? p.movimientos.map((m) => <div key={m.id} className="file-row"><Link className="marca" to={`/piezas/${m.pieza_id}`}>{m.marca}</Link><span className="grow small">{m.nota} · {m.cantidad} ud</span><b className="num">{f.kg(m.kg)}</b></div>)
            : <Empty title="Sin piezas registradas en el parte" />}
        </div>
        <div className="card"><h2 className="mb">Personal y medios</h2>
          {p.horas.map((h) => <div key={h.id} className="file-row"><span className="grow">{h.trabajador}</span><b>{f.horas(h.horas)}</b></div>)}
          {p.medios.map((m) => <div key={m.medio_id} className="file-row"><span className="grow">{m.nombre}</span><b>{f.horas(m.horas)}</b></div>)}
          {!p.horas.length && !p.medios.length && <Empty title="Sin personal ni medios" />}
          {p.observaciones && <><div className="divider" /><div className="small">{p.observaciones}</div></>}
        </div>
      </div>
      <div className="card mt"><div className="card-head"><h2>Fotografías</h2><Subir entidad="parte_montaje" entidadId={p.id} onDone={reload} /></div><Galeria archivos={p.fotos} onDelete={reload} /></div>
    </>
  );
}
