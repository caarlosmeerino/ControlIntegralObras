import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Pencil, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Status, Ring, Empty } from '../components/ui.jsx';
import { AvanceSheet, BotonAvance } from '../components/Avance.jsx';
import { PiezaForm } from '../components/Piezas.jsx';
import { Subir, Galeria } from '../components/Archivos.jsx';
import * as f from '../lib/format.js';

export default function Pieza() {
  const { id } = useParams();
  const { can } = useApp();
  const { data: p, error, loading, reload } = useData(`/piezas/${id}`);
  const [avance, setAvance] = useState(false);
  const [edit, setEdit] = useState(false);
  if (loading && !p) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <>
      <Link to={`/obras/${p.obra_id}`} className="volver"><ChevronLeft size={20} />{p.obra_nombre}</Link>
      <div className="mb">
        <div className="card">
          <div className="row wrap" style={{ alignItems: 'flex-start', gap: 18 }}>
            <Ring value={p.progreso} size={96} stroke={10} label="pieza" tone={p.estado === 'retrasado' ? 'bad' : undefined} />
            <div className="grow" style={{ minWidth: 200 }}>
              <div className="row wrap" style={{ gap: 8 }}><span className="code">{p.obra_codigo}</span><Status estado={p.estado} small />{p.incidencia && <span className="badge bad"><AlertTriangle size={14} />Incidencia</span>}</div>
              <h1 className="mt-s"><span className="marca" style={{ fontSize: 'inherit' }}>{p.marca}</span></h1>
              <div className="muted">{f.ELEMENTOS[p.elemento]} {p.perfil} · plano {p.plano || '—'} · {p.obra_nombre}</div>
            </div>
            {can('piezas.editar') && <button className="btn" onClick={() => setEdit(true)}><Pencil size={18} />Editar</button>}
          </div>
          <div className="grid g3 mt" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div><div className="xs muted">Cantidad</div><div className="strong" style={{ fontSize: '1.3rem' }}>{p.cantidad} ud</div></div>
            <div><div className="xs muted">Peso unitario</div><div className="strong num" style={{ fontSize: '1.3rem' }}>{f.kg(p.peso_unitario_kg)}</div></div>
            <div><div className="xs muted">Peso total</div><div className="strong num" style={{ fontSize: '1.3rem' }}>{f.kg(p.peso_total_kg)}</div></div>
          </div>
          {can('avance.taller', 'avance.obra', 'avance.oficina') && <div className="mt"><BotonAvance pieza={p} onClick={() => setAvance(true)} block /></div>}
        </div>
      </div>
      <div className="grid g2 mb">
        <div className="card">
          <h2 className="mb">Recorrido por fases</h2>
          <ul className="timeline">
            {p.avance.map((a) => {
              const done = a.completadas >= p.cantidad; const parcial = a.completadas > 0 && !done; const actual = a.fase_id === p.fase_actual_id;
              const I = done ? CheckCircle2 : parcial || actual ? Clock : Circle;
              return (
                <li key={a.fase_id} style={{ gridTemplateColumns: '28px 1fr' }}>
                  <I size={24} style={{ color: done ? 'var(--ok)' : parcial || actual ? 'var(--warn)' : 'var(--idle)', background: 'var(--surface)', position: 'relative', zIndex: 1 }} />
                  <div className="row between"><span className={actual ? 'strong' : ''}>{a.orden}. {a.nombre}</span><span className="small num muted">{a.completadas}/{p.cantidad} ud</span></div>
                </li>
              );
            })}
          </ul>
          <div className="divider" />
          <dl className="kv">
            <dt>Fabricación</dt><dd>{f.fecha(p.fecha_fabricacion)}</dd>
            <dt>Expedición</dt><dd>{f.fecha(p.fecha_expedicion)}</dd>
            <dt>Montaje</dt><dd>{f.fecha(p.fecha_montaje)}</dd>
            {p.observaciones && <><dt>Observaciones</dt><dd>{p.observaciones}</dd></>}
          </dl>
        </div>
        <div className="card">
          <h2 className="mb">Historial completo</h2>
          {!p.movimientos.length && !p.historial.length ? <Empty title="Sin movimientos" /> : (
            <ul className="timeline">
              {[...p.movimientos.map((m) => ({ k: `m${m.id}`, fecha: m.fecha, color: m.cantidad < 0 ? 'var(--bad)' : 'var(--ok)',
                t: <>{m.cantidad < 0 ? 'Corrección' : 'Completa'} <b>{m.fase}</b> · {Math.abs(m.cantidad)} ud · {f.kg(Math.abs(m.kg))}</>,
                s: `${m.usuario || 'Sistema'}${m.trabajador ? ` · realizado por ${m.trabajador}` : ''}${m.nota ? ` · «${m.nota}»` : ''} · ${m.origen}` })),
              ...p.historial.map((h) => ({ k: `h${h.id}`, fecha: h.fecha, color: 'var(--primary)', t: h.detalle, s: h.usuario || 'Sistema' }))]
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                .map((x) => <li key={x.k}><span className="dot" style={{ background: x.color }} /><div><div className="small">{x.t}</div><div className="xs muted">{f.fechaHora(x.fecha)} · {x.s}</div></div></li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Fotografías y documentos</h2><Subir entidad="pieza" entidadId={p.id} onDone={reload} /></div>
        <Galeria archivos={p.archivos} onDelete={reload} />
      </div>
      {avance && <AvanceSheet pieza={p} onClose={() => setAvance(false)} onDone={reload} />}
      {edit && <PiezaForm obraId={p.obra_id} pieza={p} onClose={() => setEdit(false)} onSaved={(n) => (n ? reload() : history.back())} />}
    </>
  );
}
