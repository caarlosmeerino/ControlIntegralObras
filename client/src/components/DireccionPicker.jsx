import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MapPin, Home, Route, Building2, Store, PenLine } from 'lucide-react';
import { get, qs } from '../lib/api.js';
import { bloquearScroll } from './ui.jsx';
import { Lupa } from './iconos.jsx';

const ICONO = { google: MapPin, portal: Home, callejero: Route, carretera: Route, municipio: Building2, poblacion: Building2, toponimo: Store };

/**
 * Dirección de la obra con sugerencias oficiales (CartoCiudad · IGN).
 * Al elegir una, devuelve también ciudad, provincia, código postal y coordenadas.
 */
export default function DireccionPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="input selector cliente-campo" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {value?.direccion || value?.ciudad ? (
          <>
            <span className="pin-circulo"><MapPin size={16} /></span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="strong" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.direccion || value.ciudad}</span>
              <span className="muted small">{[value.codigo_postal, value.ciudad].filter(Boolean).join(' · ')}{value.lat ? ' · ubicación exacta' : ''}</span>
            </span>
          </>
        ) : <span className="grow muted">Buscar la dirección de la obra</span>}
        <ChevronRight size={18} className="muted" />
      </button>
      {open && <Hoja inicial={value?.direccion || ''} onClose={() => setOpen(false)} onElegir={(v) => { onChange(v); setOpen(false); }} />}
    </>
  );
}

function Hoja({ inicial, onClose, onElegir }) {
  const [q, setQ] = useState(inicial);
  const [res, setRes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [eligiendo, setEligiendo] = useState(null);
  const ref = useRef();
  // Token de sesión: Google cobra la búsqueda y la elección como una sola sesión
  const sesion = useRef(globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2));
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); bloquearScroll(1);
    const t = setTimeout(() => ref.current?.focus(), 320);
    return () => { document.removeEventListener('keydown', k); bloquearScroll(-1); clearTimeout(t); };
  }, [onClose]);
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 3) { setRes([]); setError(''); return; }
    const ac = new AbortController();
    setCargando(true);
    const t = setTimeout(() => {
      get(`/direcciones${qs({ q: texto, sesion: sesion.current })}`, { signal: ac.signal })
        .then((r) => { setRes(r); setError(''); })
        .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
        .finally(() => setCargando(false));
    }, 280);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  const elegir = async (x) => {
    setEligiendo(x.id);
    let v = { direccion: x.direccion, ciudad: x.ciudad, provincia: x.provincia, codigo_postal: x.codigo_postal || '', lat: x.lat ?? null, lng: x.lng ?? null };
    if (v.lat == null || x.proveedor === 'google') {
      try {
        const d = await get(`/direcciones/detalle${qs({ id: x.id, tipo: x.tipo, portal: x.portal, proveedor: x.proveedor, sesion: sesion.current })}`);
        v = { ...v, ...Object.fromEntries(Object.entries(d).filter(([, val]) => val !== '' && val != null)) };
      } catch (e) { if (x.proveedor === 'google') { setError(e.message); setEligiendo(null); return; } }
    }
    onElegir(v);
  };
  const manual = q.trim();

  return (
    <div className="overlay overlay-acciones" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Dirección de la obra">
        <div className="grabber" />
        <div className="picker-head">
          <button type="button" className="picker-txt" onClick={onClose}>Cancelar</button>
          <b>Dirección de la obra</b>
          <span />
        </div>
        <div className="picker-buscar">
          <Lupa size={18} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Calle, número y municipio" aria-label="Buscar dirección" autoComplete="off" enterKeyHint="search" />
        </div>
        <div className="picker-lista">
          {q.trim().length < 3 ? (
            <div className="empty small"><MapPin size={36} /><div className="mt-s">Escribe la calle y el municipio.<br />Ej.: «Calle Alfonso I 12 Zaragoza» o «Polígono Malpica».</div></div>
          ) : (
            <>
              {error && <div className="banner">{error}</div>}
              {res.length > 0 && (
                <div className="picker-grupo">
                  {res.map((x) => {
                    const I = ICONO[x.tipo] || MapPin;
                    return (
                      <button key={x.id + x.direccion} type="button" className="picker-fila" onClick={() => elegir(x)} disabled={!!eligiendo}>
                        <span className="pin-circulo grande" style={x.tipo === 'portal' ? undefined : { background: 'linear-gradient(180deg,#8e8e93,#636366)' }}><I size={18} /></span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="picker-nombre">{x.tipo === 'toponimo' ? x.texto : (x.direccion || x.ciudad)}</span>
                          <span className="picker-sub">{x.proveedor === 'google' ? x.secundario : <>{x.tipo === 'toponimo' ? `${x.direccion} · ` : ''}{[x.codigo_postal, x.ciudad, x.provincia !== x.ciudad && x.provincia].filter(Boolean).join(' · ')}</>}</span>
                        </span>
                        {eligiendo === x.id && <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
              {cargando && !res.length && <div className="spinner" />}
              {!cargando && !res.length && !error && <div className="empty small">No encuentro esa dirección en el callejero oficial.</div>}
              {manual && (
                <div className="picker-grupo" style={{ marginTop: 14 }}>
                  <button type="button" className="picker-fila" onClick={() => onElegir({ direccion: manual, lat: null, lng: null, solo_texto: true })}>
                    <span className="avatar-cliente nuevo"><PenLine size={18} /></span>
                    <span className="grow"><span className="picker-nombre">Usar «{manual}» tal cual</span><span className="picker-sub">Si es una dirección nueva que aún no aparece. La ciudad la eliges tú.</span></span>
                  </button>
                </div>
              )}
              <div className="xs muted center mt">{res.some((x) => x.proveedor === 'google') ? 'Sugerencias de Google Maps · con tecnología de Google' : 'Direcciones oficiales de CartoCiudad · Instituto Geográfico Nacional'}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
