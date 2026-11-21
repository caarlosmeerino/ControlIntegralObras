import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { get } from '../lib/api.js';
import { bloquearScroll } from './ui.jsx';
import { Lupa } from './iconos.jsx';
import { iniciales, colorCliente } from '../lib/obra.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function AvatarCliente({ nombre, size = 40 }) {
  return <span className="avatar-cliente" style={{ width: size, height: size, fontSize: size * 0.36, background: colorCliente(nombre) }}>{iniciales(nombre)}</span>;
}

/** Selector de cliente estilo iOS: hoja desde abajo con buscador y lista tipo Contactos */
export default function ClientePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="input selector cliente-campo" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {value ? <><AvatarCliente nombre={value} size={30} /><span className="grow strong">{value}</span></> : <span className="grow muted">Elegir cliente</span>}
        <ChevronRight size={18} className="muted" />
      </button>
      {open && <Hoja valor={value} onClose={() => setOpen(false)} onElegir={(c) => { onChange(c); setOpen(false); }} />}
    </>
  );
}

function Hoja({ valor, onClose, onElegir }) {
  const [obras, setObras] = useState(null);
  const [q, setQ] = useState('');
  const ref = useRef();
  useEffect(() => {
    get('/obras').then(setObras).catch(() => setObras([]));
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); bloquearScroll(1);
    const t = setTimeout(() => ref.current?.focus(), 320);
    return () => { document.removeEventListener('keydown', k); bloquearScroll(-1); clearTimeout(t); };
  }, [onClose]);
  const clientes = useMemo(() => {
    const m = new Map();
    for (const o of obras || []) {
      if (!o.cliente) continue;
      const c = m.get(o.cliente) || { nombre: o.cliente, n: 0, ciudades: new Set() };
      c.n++; if (o.ciudad) c.ciudades.add(o.ciudad); m.set(o.cliente, c);
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [obras]);
  const t = norm(q);
  const lista = clientes.filter((c) => !t || norm(c.nombre).includes(t) || [...c.ciudades].some((x) => norm(x).includes(t)));
  const existe = clientes.some((c) => norm(c.nombre) === t);
  const nuevo = q.trim();
  // Agrupar por inicial, como en Contactos
  const grupos = [];
  for (const c of lista) {
    const L = norm(c.nombre)[0]?.toUpperCase() || '#';
    if (!grupos.length || grupos[grupos.length - 1].L !== L) grupos.push({ L, items: [] });
    grupos[grupos.length - 1].items.push(c);
  }
  return (
    <div className="overlay overlay-acciones" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Elegir cliente">
        <div className="grabber" />
        <div className="picker-head">
          <button type="button" className="picker-txt" onClick={onClose}>Cancelar</button>
          <b>Cliente</b>
          <span className="picker-txt" aria-hidden="true" style={{ visibility: 'hidden' }}>Cancelar</span>
        </div>
        <div className="picker-buscar">
          <Lupa size={18} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar o escribir un cliente nuevo" aria-label="Buscar cliente"
            onKeyDown={(e) => { if (e.key === 'Enter' && nuevo) { e.preventDefault(); onElegir(lista.find((c) => norm(c.nombre) === t)?.nombre || nuevo); } }} />
        </div>
        <div className="picker-lista">
          {nuevo && !existe && (
            <div className="picker-grupo">
              <button type="button" className="picker-fila" onClick={() => onElegir(nuevo)}>
                <span className="avatar-cliente nuevo"><Plus size={20} /></span>
                <span className="grow"><span className="picker-nombre">Añadir «{nuevo}»</span><span className="picker-sub">Cliente nuevo</span></span>
              </button>
            </div>
          )}
          {obras === null ? <div className="spinner" /> : grupos.map((g) => (
            <div key={g.L}>
              <div className="picker-letra">{g.L}</div>
              <div className="picker-grupo">
                {g.items.map((c) => (
                  <button key={c.nombre} type="button" className="picker-fila" onClick={() => onElegir(c.nombre)}>
                    <AvatarCliente nombre={c.nombre} />
                    <span className="grow"><span className="picker-nombre">{c.nombre}</span>
                      <span className="picker-sub">{c.n} {c.n === 1 ? 'proyecto' : 'proyectos'}{c.ciudades.size ? ` · ${[...c.ciudades].join(', ')}` : ''}</span></span>
                    {c.nombre === valor && <Check size={20} className="accion-check" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {obras && !lista.length && !nuevo && <div className="empty small">Todavía no hay clientes. Escribe el nombre del primero.</div>}
        </div>
      </div>
    </div>
  );
}
