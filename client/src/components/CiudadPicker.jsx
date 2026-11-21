import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, MapPin } from 'lucide-react';
import { get } from '../lib/api.js';
import { bloquearScroll } from './ui.jsx';
import { Lupa } from './iconos.jsx';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();

// Listado oficial del INE (se descarga una sola vez y queda en caché)
let datos = null;
function cargarMunicipios() {
  if (!datos) {
    datos = fetch('/municipios.json').then((r) => r.json()).then((d) => d.municipios.map(([n, p, alias]) => ({
      ciudad: n, alias: alias || '', provincia: d.provincias[p][0], comunidad: d.provincias[p][1], k: norm(n), ka: norm(alias),
    }))).catch((e) => { datos = null; throw e; });
  }
  return datos;
}

/** Selector de ciudad: solo admite municipios que existen (INE). value = { ciudad, provincia } */
export default function CiudadPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="input selector cliente-campo" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {value?.ciudad ? <><span className="pin-circulo"><MapPin size={16} /></span><span className="grow"><span className="strong">{value.ciudad}</span>{value.provincia && value.provincia !== value.ciudad && <span className="muted small"> · {value.provincia}</span>}</span></>
          : <span className="grow muted">Elegir ciudad</span>}
        <ChevronRight size={18} className="muted" />
      </button>
      {open && <Hoja valor={value} onClose={() => setOpen(false)} onElegir={(c) => { onChange(c); setOpen(false); }} />}
    </>
  );
}

function Hoja({ valor, onClose, onElegir }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(false);
  const [usadas, setUsadas] = useState([]);
  const [q, setQ] = useState('');
  const ref = useRef();
  useEffect(() => {
    cargarMunicipios().then(setLista).catch(() => setError(true));
    get('/obras').then((os) => {
      const m = new Map(); os.filter((o) => o.ciudad).forEach((o) => m.set(`${o.ciudad}|${o.provincia || ''}`, { ciudad: o.ciudad, provincia: o.provincia || '' }));
      setUsadas([...m.values()]);
    }).catch(() => {});
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); bloquearScroll(1);
    const t = setTimeout(() => ref.current?.focus(), 320);
    return () => { document.removeEventListener('keydown', k); bloquearScroll(-1); clearTimeout(t); };
  }, [onClose]);

  const t = norm(q);
  const resultados = useMemo(() => {
    if (!lista || t.length < 2) return [];
    const puntua = (m) => {
      const s = [m.k, m.ka].filter(Boolean);
      if (s.some((x) => x === t)) return 0;
      if (s.some((x) => x.startsWith(t))) return 1;
      if (s.some((x) => x.split(' ').some((w) => w.startsWith(t)))) return 2;
      if (s.some((x) => x.includes(t))) return 3;
      return 9;
    };
    return lista.map((m) => [puntua(m), m]).filter(([p]) => p < 9).sort((a, b) => a[0] - b[0] || a[1].ciudad.localeCompare(b[1].ciudad, 'es')).slice(0, 60).map(([, m]) => m);
  }, [lista, t]);

  const fila = (m) => {
    const sel = valor?.ciudad === m.ciudad && (!valor?.provincia || valor.provincia === m.provincia);
    return (
      <button key={`${m.ciudad}|${m.provincia}`} type="button" className="picker-fila" onClick={() => onElegir({ ciudad: m.ciudad, provincia: m.provincia })}>
        <span className="pin-circulo grande"><MapPin size={18} /></span>
        <span className="grow"><span className="picker-nombre">{m.ciudad}{m.alias && <span className="muted"> ({m.alias})</span>}</span>
          <span className="picker-sub">{[m.provincia !== m.ciudad && m.provincia, m.comunidad && m.comunidad !== m.provincia && m.comunidad].filter(Boolean).join(' · ') || m.provincia}</span></span>
        {sel && <Check size={20} className="accion-check" />}
      </button>
    );
  };

  return (
    <div className="overlay overlay-acciones" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Elegir ciudad">
        <div className="grabber" />
        <div className="picker-head">
          <button type="button" className="picker-txt" onClick={onClose}>Cancelar</button>
          <b>Ciudad</b>
          {valor?.ciudad ? <button type="button" className="picker-txt" style={{ justifySelf: 'end' }} onClick={() => onElegir({ ciudad: '', provincia: '' })}>Quitar</button> : <span />}
        </div>
        <div className="picker-buscar">
          <Lupa size={18} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar municipio" aria-label="Buscar municipio" autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); onElegir({ ciudad: resultados[0].ciudad, provincia: resultados[0].provincia }); } }} />
        </div>
        <div className="picker-lista">
          {error && <div className="banner bad">No se ha podido cargar el listado de municipios. Comprueba la conexión.</div>}
          {t.length < 2 ? (
            <>
              {usadas.length > 0 && <><div className="picker-letra">En tus proyectos</div><div className="picker-grupo">{usadas.map((u) => fila({ ...u, alias: '', comunidad: '' }))}</div></>}
              <div className="empty small">Escribe al menos 2 letras para buscar entre los 8.132 municipios de España.</div>
            </>
          ) : !lista ? <div className="spinner" /> : resultados.length ? (
            <div className="picker-grupo" style={{ marginTop: 4 }}>{resultados.map(fila)}</div>
          ) : (
            <div className="empty"><MapPin size={36} /><div className="strong">No existe ningún municipio «{q}»</div><div className="small mt-s">Revisa cómo está escrito. Solo se admiten municipios reales de España.</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
