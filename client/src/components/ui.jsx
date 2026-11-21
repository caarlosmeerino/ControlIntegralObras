import { useEffect, useState } from 'react';
import { X, CheckCircle2, Clock, AlertOctagon, Circle, Inbox, AlertTriangle, RefreshCw, Minus, Plus } from 'lucide-react';
import * as f from '../lib/format.js';
import { ICONO_FASE, PerfilH } from './iconos.jsx';

export const Loading = () => <div className="spinner" role="status" aria-label="Cargando" />;

export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return (
    <div className="banner bad" role="alert">
      <AlertTriangle size={22} />
      <div className="grow">{error.message}</div>
      {retry && <button className="btn sm" onClick={retry}><RefreshCw size={16} />Reintentar</button>}
    </div>
  );
}

export function Empty({ icon: I = Inbox, title, children }) {
  return (
    <div className="empty">
      <I size={44} />
      <div className="strong" style={{ color: 'var(--text-2)' }}>{title}</div>
      {children && <div className="small mt-s">{children}</div>}
    </div>
  );
}

const ICON_ESTADO = { ok: CheckCircle2, warn: Clock, bad: AlertOctagon, idle: Circle };
export function Status({ estado, map = f.ESTADOS, small }) {
  const e = map[estado] || { label: estado, tone: 'idle' };
  const I = ICON_ESTADO[e.tone] || Circle;
  return <span className={`badge ${e.tone}`} style={small ? { height: 24, fontSize: '.74rem' } : undefined}><I size={small ? 13 : 15} />{e.label}</span>;
}

export const toneOf = (estado) => (f.ESTADOS[estado] || {}).tone || 'idle';

export function Bar({ value, tone, thick, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`bar ${tone || ''} ${thick ? 'thick' : ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Manómetro semicircular con escala graduada (sustituye al anillo) */
export function Ring({ value, size = 96, stroke = 10, label, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const W = size, H = Math.round(size * 0.66), r = (size - stroke) / 2 - 2, cx = W / 2, cy = r + stroke / 2 + 2;
  const pt = (pct, rr) => { const a = Math.PI * (1 - pct / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (from, to) => { const [x1, y1] = pt(from, r); const [x2, y2] = pt(to, r); return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  const color = tone ? `var(--${tone})` : v >= 100 ? 'var(--ok)' : 'var(--acento)';
  const [nx, ny] = pt(v, r - stroke * 0.9);
  return (
    <div className="gauge" style={{ width: W }} role="img" aria-label={`${label || 'Avance'}: ${f.pct(v)}`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={arc(0, 100)} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        {v > 0 && <path d={arc(0, Math.max(v, 0.5))} stroke={color} strokeWidth={stroke} fill="none" />}
        {Array.from({ length: 11 }, (_, i) => { const [x1, y1] = pt(i * 10, r + stroke / 2 + 1); const [x2, y2] = pt(i * 10, r + stroke / 2 - (i % 5 ? 3 : 6)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--surface)" strokeWidth={i % 5 ? 1.5 : 2.5} />; })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth={Math.max(2, size / 40)} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={Math.max(3, size / 22)} fill="var(--text)" />
      </svg>
      <div className="gauge-label"><b style={{ fontSize: Math.max(15, size / 4.4) }}>{f.num(v, v < 10 && v > 0 ? 1 : 0)}<i>%</i></b>{label && <small>{label}</small>}</div>
    </div>
  );
}

export function Kpi({ icon: I, label, value, unit, sub, tone }) {
  return (
    <div className={`card kpi placa tone-${tone || 'primary'}`}>
      {I && <div className="kpi-icon"><I size={24} /></div>}
      <div className="grow">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}{unit && <small>{unit}</small>}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

/** Lista de fases con barra de progreso, kg y estado. Cada % se calcula con sus propias cantidades. */
export function PhaseList({ fases, compact, onClick }) {
  return (
    <div className="phase-list">
      {fases.map((fs) => {
        const tone = toneOf(fs.estado);
        return (
          <div key={fs.id} className="phase" onClick={onClick ? () => onClick(fs) : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
            <div className={`phase-n ${tone}`}>{fs.orden}</div>
            <div>
              <div className="phase-name">{fs.nombre}</div>
              {!compact && <div className="phase-kg">{f.tNum(fs.kg_completados)} de {f.t(fs.kg_base)} {fs.indicador || ''}</div>}
            </div>
            <Bar value={fs.porcentaje} tone={tone === 'idle' ? '' : tone} label={fs.nombre} />
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <span className="phase-pct">{f.pct(fs.porcentaje)}</span>
              {!compact && <span className="hide-m"><Status estado={fs.estado} small /></span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Línea de producción: las fases como estaciones de una cadena */
export function LineaProduccion({ fases, compact }) {
  return (
    <ol className={`linea ${compact ? 'compact' : ''}`} aria-label="Avance por fases">
      {fases.map((x) => {
        const tone = toneOf(x.estado);
        const I = ICONO_FASE[x.clave] || PerfilH;
        return (
          <li key={x.id} className={`estacion ${tone}`} title={`${x.orden}. ${x.nombre}: ${f.pct(x.porcentaje)}`}>
            <span className="est-caja"><span className="est-fill" style={{ height: `${Math.min(100, x.porcentaje)}%` }} /><I size={compact ? 16 : 20} /></span>
            {!compact && <span className="est-nombre">{x.nombre.split(' ')[0]}</span>}
            <span className="est-pct">{f.num(x.porcentaje)}%</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra apilada: dónde está físicamente cada kg (suma = toneladas únicas). */
export function UbicacionBar({ fases, totalKg }) {
  if (!totalKg) return <div className="muted small">Sin piezas registradas.</div>;
  const ult = fases[fases.length - 1];
  const tramos = [...fases.map((x, i) => ({ nombre: `En ${x.nombre.toLowerCase()}`, kg: x.kg_en_fase, color: f.COLOR_FASE[i] })),
    { nombre: 'Finalizado', kg: ult?.kg_completados || 0, color: 'var(--ok)' }].filter((x) => x.kg > 0.5);
  return (
    <div>
      <div className="stackbar" role="img" aria-label="Distribución de toneladas por fase">
        {tramos.map((x) => <span key={x.nombre} title={`${x.nombre}: ${f.t(x.kg)}`} style={{ width: `${(x.kg / totalKg) * 100}%`, background: x.color }} />)}
      </div>
      <div className="legend">
        {tramos.map((x) => <span key={x.nombre}><i className="dot" style={{ background: x.color }} />{x.nombre}: <b className="num">{f.t(x.kg)}</b></span>)}
      </div>
    </div>
  );
}

export function Sheet({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-head">
          <h2 className="grow">{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, full }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.icon && <t.icon size={18} />}{t.label}
        </button>
      ))}
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)} type="button">{l}</button>)}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 9999 }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <button type="button" onClick={() => set(value - 1)} aria-label="Menos" disabled={value <= min}><Minus /></button>
      <input inputMode="numeric" value={value} onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || min)} aria-label="Cantidad" />
      <button type="button" onClick={() => set(value + 1)} aria-label="Más" disabled={value >= max}><Plus /></button>
    </div>
  );
}

/** Tabla en escritorio y tarjetas en móvil */
export function DataTable({ columns, rows, onRow, card, footer, empty = 'No hay datos.', rowKey = (r) => r.id, selected }) {
  if (!rows?.length) return <Empty title={empty} />;
  return (
    <>
      <div className="table-wrap resp">
        <table className="t">
          <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={`${onRow ? 'click' : ''} ${selected?.(r) ? 'sel' : ''}`} onClick={onRow ? () => onRow(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot><tr>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{footer[c.key] ?? ''}</td>)}</tr></tfoot>}
        </table>
      </div>
      <div className="cards-list">
        {rows.map((r) => (
          <div key={rowKey(r)} className={`item-card ${selected?.(r) ? 'sel' : ''}`} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? { cursor: 'pointer' } : undefined}>
            {card ? card(r) : columns.map((c) => (
              <div key={c.key} className="row between"><span className="muted small">{c.label}</span><span className="strong">{c.render ? c.render(r) : r[c.key]}</span></div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Gráfico de barras SVG (apiladas opcionalmente) */
export function BarChart({ data, series, height = 220, format = (v) => f.tNum(v, 1), xLabel = (d) => f.diaCorto(d.periodo) }) {
  const [hover, setHover] = useState(null);
  if (!data?.length) return <Empty title="Sin producción en el periodo" />;
  const W = 720, H = height, pl = 44, pb = 26, pt = 10;
  const totals = data.map((d) => series.reduce((s, x) => s + (Number(d[x.key]) || 0), 0));
  const max = Math.max(...totals, 1);
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const bw = (W - pl - 6) / data.length;
  const y = (v) => H - pb - (v / nice) * (H - pb - pt);
  const step = Math.ceil(data.length / 12);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Gráfico de producción">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}><line x1={pl} x2={W} y1={y(nice * g)} y2={y(nice * g)} stroke="var(--border)" strokeDasharray={g ? '3 4' : ''} />
            <text x={pl - 6} y={y(nice * g) + 4} textAnchor="end">{format(nice * g)}</text></g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pb - pt} fill={hover === i ? 'var(--surface-3)' : 'transparent'} />
              {series.map((s) => {
                const v = Number(d[s.key]) || 0; if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v); acc += v;
                return <rect key={s.key} x={pl + i * bw + bw * 0.18} width={bw * 0.64} y={y1} height={Math.max(1, y0 - y1)} fill={s.color} rx={2} />;
              })}
              {i % step === 0 && <text x={pl + i * bw + bw / 2} y={H - 8} textAnchor="middle">{xLabel(d)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="card" style={{ position: 'absolute', top: 0, right: 0, padding: '8px 12px', fontSize: '.82rem', pointerEvents: 'none', minWidth: 180 }}>
          <div className="strong">{xLabel(data[hover])}</div>
          {series.map((s) => Number(data[hover][s.key]) > 0 && <div key={s.key} className="row between"><span><i className="dot" style={{ background: s.color }} /> {s.label}</span><b className="num">{format(data[hover][s.key])}</b></div>)}
        </div>
      )}
      <div className="legend">{series.map((s) => <span key={s.key}><i className="dot" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export const SERIES_FASES = [
  { key: 'corte', label: 'Cortado', color: '#8e9aa6' },
  { key: 'armado', label: 'Armado y soldado', color: 'var(--text)' },
  { key: 'pintura', label: 'Pintado', color: '#e8a400' },
  { key: 'montaje', label: 'Montado', color: 'var(--ok)' },
];
