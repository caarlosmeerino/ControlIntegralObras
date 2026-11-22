import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Circle, Plus, Trash2, RotateCcw, CalendarDays, AlertTriangle } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, del } from '../lib/api.js';
import { Loading, ErrorBox, Status, Ring, Cabecera } from '../components/ui.jsx';
import { estadoEtapa } from '../lib/obra.js';
import * as f from '../lib/format.js';

const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** Una fase del proyecto: fechas, checklist y confirmación de que se ha terminado */
export default function Fase() {
  const { id, faseId } = useParams();
  const { can, toast, toastError } = useApp();
  const { data: e, error, loading, reload, setData } = useData(`/etapas/${faseId}`);
  const [nueva, setNueva] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading && !e) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const editar = can('obras.editar', 'fases.editar');
  const estado = estadoEtapa(e);
  const hoy = f.hoyISO();
  const pct = e.completada ? 100 : e.tareas.length ? (e.tareas.filter((t) => t.hecha).length / e.tareas.length) * 100 : 0;

  const marcar = async (t) => {
    setData({ ...e, tareas: e.tareas.map((x) => (x.id === t.id ? { ...x, hecha: !x.hecha } : x)) });
    try { await put(`/etapas/tareas/${t.id}`, { hecha: !t.hecha }); } catch (er) { toastError(er); reload(); }
  };
  const añadir = async (ev) => {
    ev.preventDefault();
    const textos = nueva.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!textos.length) return;
    try { await post(`/etapas/${e.id}/tareas`, { textos }); setNueva(''); reload(); } catch (er) { toastError(er); }
  };
  const quitar = async (t) => { try { await del(`/etapas/tareas/${t.id}`); reload(); } catch (er) { toastError(er); } };
  const completar = async (si) => {
    const pendientes = e.tareas.filter((t) => !t.hecha).length;
    if (si && pendientes && !confirm(`Quedan ${pendientes} tarea(s) sin marcar. ¿Confirmar igualmente que la fase está terminada?`)) return;
    setBusy(true);
    try { await put(`/etapas/${e.id}/completar`, { completada: si }); toast(si ? `«${e.nombre}» confirmada como terminada.` : `«${e.nombre}» reabierta.`); reload(); }
    catch (er) { toastError(er); } finally { setBusy(false); }
  };

  let plazo = '';
  if (e.completada) plazo = `Terminada el ${f.fecha(e.completada_en)}${e.completada_por_nombre ? ` · ${e.completada_por_nombre}` : ''}`;
  else if (estado === 'retrasado') plazo = `Debía terminar el ${f.fecha(e.fecha_fin)} · ${dias(e.fecha_fin, hoy)} días de retraso`;
  else if (e.fecha_inicio && hoy < e.fecha_inicio) plazo = `Empieza en ${dias(hoy, e.fecha_inicio)} días`;
  else if (e.fecha_fin) plazo = `Quedan ${dias(hoy, e.fecha_fin)} días`;

  return (
    <>
      <Link to={`/obras/${id}`} className="volver"><ChevronLeft size={20} />{e.obra_nombre}</Link>
      <Cabecera icono={<Ring value={pct} size={56} tone={estado === 'retrasado' ? 'bad' : estado === 'terminado' ? 'ok' : undefined} />} titulo={e.nombre}
        sub={<>Fase {e.orden} · {f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}{plazo && <><br />{plazo}</>}</>}
        estado={<Status estado={estado} small />} />

      {estado === 'retrasado' && <div className="banner bad"><AlertTriangle size={20} />La fecha de fin ha pasado y la fase no está confirmada como terminada.</div>}

      <div className="card mb">
        <div className="card-head"><div><h2>Checklist</h2><p>{e.tareas.filter((t) => t.hecha).length} de {e.tareas.length} hechas</p></div></div>
        {e.tareas.length > 0 && (
          <div className="checklist">
            {e.tareas.map((t) => (
              <div key={t.id} className={`check-item ${t.hecha ? 'hecha' : ''}`}>
                <button type="button" className="check-btn" onClick={() => editar && marcar(t)} disabled={!editar} aria-label={t.hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto}`}>
                  {t.hecha ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                </button>
                <div className="grow">
                  <div className="check-texto">{t.texto}</div>
                  {t.hecha && t.hecha_en && <div className="xs muted">{f.fechaHora(t.hecha_en)}{t.hecha_por_nombre ? ` · ${t.hecha_por_nombre}` : ''}</div>}
                </div>
                {editar && <button type="button" className="btn ghost icon" onClick={() => quitar(t)} aria-label={`Quitar ${t.texto}`}><Trash2 size={18} className="muted" /></button>}
              </div>
            ))}
          </div>
        )}
        {editar && (
          <form className="check-nueva" onSubmit={añadir}>
            <Plus size={22} className="muted" />
            <input className="grow" value={nueva} onChange={(ev) => setNueva(ev.target.value)} placeholder="Añadir tarea…" aria-label="Nueva tarea" enterKeyHint="done" />
            {nueva.trim() && <button className="btn sm primary">Añadir</button>}
          </form>
        )}
      </div>

      {editar && (e.completada ? (
        <button className="btn xl" disabled={busy} onClick={() => completar(false)}><RotateCcw size={20} />Reabrir fase</button>
      ) : (
        <button className="btn xl ok" disabled={busy} onClick={() => completar(true)}><CheckCircle2 size={22} />Confirmar fase terminada</button>
      ))}

      {e.hermanas?.length > 1 && (
        <div className="fases-nav mt">
          {e.hermanas.map((h) => <Link key={h.id} to={`/obras/${id}/fases/${h.id}`} className={`chip ${h.id === e.id ? 'on' : ''}`}>{h.orden}. {h.nombre}</Link>)}
        </div>
      )}
    </>
  );
}
