import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../lib/app.jsx';
import { qs } from '../lib/api.js';
import { semanaISO, lunesDeSemana, masDias, MESES, DIAS, estadoEtapa, colorCliente, pastelObra } from '../lib/obra.js';
import { hoyISO } from '../lib/format.js';

/** Barras de fases dentro de una semana (como los eventos de varios días del Calendario) */
export function barrasSemana(etapas, lunes) {
  const domingo = masDias(lunes, 6);
  const filas = [];
  const items = etapas
    .filter((e) => (e.fecha_inicio || e.fecha_fin) <= domingo && (e.fecha_fin || e.fecha_inicio) >= lunes)
    .map((e) => {
      const ini = e.fecha_inicio && e.fecha_inicio > lunes ? e.fecha_inicio : lunes;
      const fin = (e.fecha_fin || e.fecha_inicio) < domingo ? (e.fecha_fin || e.fecha_inicio) : domingo;
      const a = Math.round((new Date(ini) - new Date(lunes)) / 86400000);
      const b = Math.round((new Date(fin) - new Date(lunes)) / 86400000);
      return { e, a, b, empieza: e.fecha_inicio >= lunes, acaba: (e.fecha_fin || '') <= domingo };
    })
    .sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  for (const it of items) {
    let fila = filas.findIndex((f) => f.every((o) => o.b < it.a || o.a > it.b));
    if (fila === -1) { filas.push([]); fila = filas.length - 1; }
    filas[fila].push(it); it.fila = fila;
  }
  return items;
}

const MAX = 3;

export default function Calendario() {
  const nav = useNavigate();
  const hoy = hoyISO();
  const [mes, setMes] = useState(() => hoy.slice(0, 7)); // AAAA-MM
  const [anio, m] = mes.split('-').map(Number);
  const primero = `${mes}-01`;
  const ultimo = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10);
  const lunes0 = masDias(primero, -((new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7));
  const semanas = [];
  for (let l = lunes0; l <= ultimo; l = masDias(l, 7)) semanas.push(l);
  const hasta = masDias(semanas[semanas.length - 1], 6);
  const { data } = useData(`/etapas/planning${qs({ desde: lunes0, hasta })}`);
  const etapas = useMemo(() => (data || []).filter((e) => !e.arrastrada).map((e) => ({ ...e, estado: estadoEtapa(e) })), [data]);
  const mover = (n) => { const d = new Date(Date.UTC(anio, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };

  return (
    <div className="card calendario">
      <div className="cal-cabecera">
        <h2><span className="cal-mes">{MESES[m - 1]}</span> {anio}</h2>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost icon sm" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <button className="btn sm" onClick={() => setMes(hoy.slice(0, 7))}>Hoy</button>
          <button className="btn ghost icon sm" onClick={() => mover(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="cal-dias"><span className="cal-sem-tit">Sem</span>{DIAS.map((d) => <span key={d}>{d}</span>)}</div>
      {semanas.map((lunes) => {
        const { anio: a, semana } = semanaISO(lunes);
        const barras = barrasSemana(etapas, lunes);
        const visibles = barras.filter((b) => b.fila < MAX);
        const ocultas = barras.length - visibles.length;
        const esActual = hoy >= lunes && hoy <= masDias(lunes, 6);
        return (
          <button key={lunes} type="button" className={`cal-semana ${esActual ? 'actual' : ''}`} onClick={() => nav(`/planning/${a}/${semana}`)} aria-label={`Semana ${semana}: ${barras.length} fases`}>
            <span className="cal-num">{semana}</span>
            {Array.from({ length: 7 }, (_, i) => {
              const d = masDias(lunes, i);
              return <span key={d} className={`cal-dia ${d.slice(0, 7) !== mes ? 'fuera' : ''} ${d === hoy ? 'hoy' : ''} ${i > 4 ? 'finde' : ''}`}><i>{Number(d.slice(8))}</i></span>;
            })}
            <span className="cal-barras" style={{ gridTemplateRows: `repeat(${Math.min(MAX, Math.max(1, ...visibles.map((b) => b.fila + 1), 0))}, 18px)` }}>
              {visibles.map(({ e, a: ia, b: ib, fila, empieza, acaba }) => (
                <span key={e.id} className={`cal-barra ${e.estado} ${empieza ? 'ini' : ''} ${acaba ? 'fin' : ''}`}
                  style={{ gridColumn: `${ia + 1} / ${ib + 2}`, gridRow: fila + 1, ...pastelObra(e.obra_nombre) }} title={`${e.obra_nombre} · ${e.nombre}`}>
                  {e.obra_nombre} · {e.nombre}
                </span>
              ))}
            </span>
            {ocultas > 0 && <span className="cal-mas">+{ocultas}</span>}
          </button>
        );
      })}
      <div className="cal-leyenda"><span><i className="dot" style={{ background: 'var(--bad)' }} />Retraso</span><span><i className="dot" style={{ background: 'var(--ok)' }} />Terminada</span><span>Toca una semana para ver su planning</span></div>
    </div>
  );
}

export { lunesDeSemana };
