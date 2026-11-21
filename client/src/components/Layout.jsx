import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff, X } from 'lucide-react';
import * as Ic from './iconos.jsx';
import { useApp } from '../lib/app.jsx';
import { get } from '../lib/api.js';
import { ROLES } from '../lib/format.js';

// Navegación por ZONAS, siguiendo el recorrido real de la estructura
export const ZONAS = [
  { id: 'produccion', label: 'Producción', icon: Ic.Linea, items: [
    { to: '/', label: 'Panel principal', icon: Ic.Manometro, perm: ['obras.ver'], end: true },
    { to: '/resumen', label: 'Resumen de producción', icon: Ic.Linea, perm: ['obras.ver'] },
    { to: '/obras', label: 'Obras', icon: Ic.Nave, perm: ['obras.ver'] },
    { to: '/proyectos', label: 'Gestión de proyectos', icon: Ic.Plano, perm: ['obras.ver'] },
  ] },
  { id: 'taller', label: 'Taller', icon: Ic.PerfilH, items: [
    { to: '/fabricacion', label: 'Fabricación', icon: Ic.PerfilH, perm: ['piezas.ver'] },
    { to: '/taller', label: 'Control del taller', icon: Ic.Soldadura, perm: ['partes.taller', 'personal.ver'] },
  ] },
  { id: 'obra', label: 'Obra', icon: Ic.Grua, items: [
    { to: '/montaje', label: 'Montaje', icon: Ic.Grua, perm: ['obras.ver'] },
    { to: '/control-obra', label: 'Control en obra', icon: Ic.Casco, perm: ['partes.montaje'] },
  ] },
  { id: 'equipo', label: 'Equipo', icon: Ic.Cuadrilla, items: [
    { to: '/personal', label: 'Personal', icon: Ic.Operario, perm: ['personal.ver'] },
    { to: '/equipos', label: 'Operarios y equipos', icon: Ic.Cuadrilla, perm: ['personal.ver'] },
  ] },
  { id: 'analisis', label: 'Análisis', icon: Ic.Bascula, items: [
    { to: '/informes', label: 'Informes', icon: Ic.Albaran, perm: ['informes.ver'] },
    { to: '/rendimientos', label: 'Toneladas y rendimientos', icon: Ic.Bascula, perm: ['informes.ver', 'personal.ver'] },
  ] },
  { id: 'admin', label: 'Ajustes', icon: Ic.Perno, items: [
    { to: '/usuarios', label: 'Usuarios y permisos', icon: Ic.Llave, perm: ['usuarios.admin'] },
    { to: '/sistema', label: 'Copias y sistema', icon: Ic.Archivo, perm: ['sistema.admin'] },
    { to: '/perfil', label: 'Mi cuenta', icon: Ic.Operario, perm: null },
  ] },
];
// Rutas de detalle → zona a la que pertenecen
const DETALLE = [[/^\/(obras|q)\//, 'produccion'], [/^\/piezas\//, 'taller'], [/^\/escanear/, 'taller'], [/^\/partes\//, 'obra']];

function useZonas() {
  const { can } = useApp();
  return ZONAS.map((z) => ({ ...z, items: z.items.filter((i) => !i.perm || can(...i.perm)) })).filter((z) => z.items.length);
}
function zonaActual(zonas, path) {
  for (const [re, id] of DETALLE) if (re.test(path)) return id;
  const hit = zonas.find((z) => z.items.some((i) => (i.end ? path === i.to : path === i.to || path.startsWith(i.to + '/'))));
  return hit?.id || zonas[0]?.id;
}

function GlobalSearch({ autoFocus, onDone }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const ref = useRef();
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const ac = new AbortController();
    const tm = setTimeout(() => get(`/buscar?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal }).then((r) => { setRes(r); setSel(0); }).catch(() => {}), 180);
    return () => { clearTimeout(tm); ac.abort(); };
  }, [q]);
  useEffect(() => {
    const k = (e) => { if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); ref.current?.focus(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const items = res ? [...res.obras.map((o) => ({ k: `o${o.id}`, to: `/obras/${o.id}`, icon: Ic.Nave, title: <><span className="code">{o.codigo}</span> {o.nombre}</>, sub: o.cliente })),
    ...res.piezas.map((p) => ({ k: `p${p.id}`, to: `/piezas/${p.id}`, icon: Ic.PerfilH, title: <><span className="marca">{p.marca}</span> <span className="muted small">{p.perfil}</span></>, sub: `${p.obra_codigo} · plano ${p.plano || '—'} · ${p.cantidad} ud` }))] : [];
  const go = (it) => { nav(it.to); setQ(''); setOpen(false); ref.current?.blur(); onDone?.(); };
  return (
    <div className="search">
      <Ic.Lupa size={20} />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && items[sel]) go(items[sel]);
          if (e.key === 'Escape') { setQ(''); ref.current?.blur(); onDone?.(); }
        }}
        placeholder="Buscar obra, marca o plano" aria-label="Buscar obras y piezas" enterKeyHint="search" autoComplete="off" />
      {open && res && (
        <div className="search-results">
          {!items.length && <div className="empty small">Sin resultados para «{q}».</div>}
          {res.obras.length > 0 && <div className="search-title">Obras</div>}
          {items.map((it, i) => (
            <div key={it.k}>
              {i === res.obras.length && res.piezas.length > 0 && <div className="search-title">Piezas</div>}
              <div className={`search-item ${i === sel ? 'sel' : ''}`} onMouseDown={() => go(it)}>
                <it.icon size={22} className="muted" />
                <div className="grow"><div>{it.title}</div><div className="xs muted">{it.sub}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hoja de zona en móvil: secciones como fichas grandes */
function HojaZonas({ zonas, soloZona, onClose }) {
  const { user, logout, tema, setTema } = useApp();
  const lista = soloZona ? zonas.filter((z) => z.id === soloZona) : zonas;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet zona-sheet" role="dialog" aria-modal="true" aria-label="Apartados">
        <div className="sheet-head"><h2 className="grow">{soloZona ? lista[0]?.label : 'Todos los apartados'}</h2><button className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><X /></button></div>
        <div className="sheet-body">
          {lista.map((z) => (
            <div key={z.id} className="zona-bloque">
              {!soloZona && <div className="zona-titulo"><z.icon size={18} />{z.label}</div>}
              <div className="zona-fichas">
                {z.items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className="ficha-nav" onClick={onClose}><i.icon size={30} /><span>{i.label}</span></NavLink>
                ))}
              </div>
            </div>
          ))}
          {!soloZona && (
            <div className="row wrap mt">
              <button className="btn" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>{tema === 'dark' ? <Ic.Sol /> : <Ic.Luna />}{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button>
              <button className="btn" onClick={logout}><Ic.Salir />Salir ({user.username})</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, tema, setTema, online, cola } = useApp();
  const zonas = useZonas();
  const loc = useLocation();
  const nav = useNavigate();
  const [hoja, setHoja] = useState(null); // null | 'todas' | id de zona
  const [buscar, setBuscar] = useState(false);
  const [menuUser, setMenuUser] = useState(false);
  useEffect(() => {
    setHoja(null); setBuscar(false); setMenuUser(false);
    requestAnimationFrame(() => document.querySelector('.subzona .active')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }, [loc.pathname]);
  const actual = zonaActual(zonas, loc.pathname);
  const zona = zonas.find((z) => z.id === actual);
  const oscuro = tema === 'dark' || (tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const abrirZona = (z) => (z.items.length === 1 ? nav(z.items[0].to) : setHoja(z.id));
  // Barra inferior móvil: hasta 4 zonas principales + escáner en el centro
  const principales = zonas.filter((z) => ['produccion', 'taller', 'obra'].includes(z.id));
  const izquierda = principales.slice(0, 2); const derecha = principales.slice(2, 3);

  return (
    <div className="app">
      {(!online || cola > 0) && (
        <div className="offline">{!online ? <><WifiOff size={16} style={{ verticalAlign: -3 }} /> Sin conexión. Los avances se guardan y se envían al volver la red.</> : null}
          {cola > 0 && ` ${cola} avance(s) pendiente(s) de enviar.`}</div>
      )}
      <header className="cabecera no-print">
        <div className="cab-fila">
          <NavLink to="/" className="marca-app" aria-label="Inicio">
            <span className="logo"><Ic.PerfilH size={26} /></span>
            <span className="marca-txt">CONTROL<b>INTEGRAL</b><small>Estructuras metálicas</small></span>
          </NavLink>
          <nav className="zonas hide-m" aria-label="Zonas">
            {zonas.filter((z) => z.id !== 'admin').map((z) => (
              <NavLink key={z.id} to={z.items[0].to} end={z.items[0].end} className={`zona ${actual === z.id ? 'on' : ''}`}>
                <z.icon size={20} />{z.label}
              </NavLink>
            ))}
          </nav>
          <div className="grow hide-m" />
          <div className="hide-m cab-buscar"><GlobalSearch /></div>
          <button className="btn icon cab-btn hide-d" onClick={() => setBuscar(true)} aria-label="Buscar"><Ic.Lupa /></button>
          <button className="btn escanear hide-m" onClick={() => nav('/escanear')}><Ic.Escaner size={22} />Escanear</button>
          <button className="btn icon cab-btn hide-m" onClick={() => setTema(oscuro ? 'light' : 'dark')} aria-label={oscuro ? 'Modo claro' : 'Modo oscuro'} title={oscuro ? 'Modo claro' : 'Modo oscuro'}>{oscuro ? <Ic.Sol /> : <Ic.Luna />}</button>
          <div className="usuario hide-m">
            <button className="btn cab-btn avatar" onClick={() => setMenuUser(!menuUser)} aria-expanded={menuUser} aria-label="Mi cuenta">{user.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</button>
            {menuUser && (
              <div className="menu-user" onMouseLeave={() => setMenuUser(false)}>
                <div className="mu-head"><b>{user.nombre}</b><span>{ROLES[user.rol]}</span></div>
                {zonas.find((z) => z.id === 'admin')?.items.map((i) => <NavLink key={i.to} to={i.to} className="mu-item"><i.icon size={20} />{i.label}</NavLink>)}
                <button className="mu-item" onClick={logout}><Ic.Salir size={20} />Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
        {zona && zona.id !== 'admin' && zona.items.length > 1 && (
          <nav className="subzona" aria-label={`Apartados de ${zona.label}`}>
            {zona.items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className="sub"><i.icon size={18} />{i.label}</NavLink>)}
          </nav>
        )}
        <div className="franja" aria-hidden="true" />
      </header>
      {buscar && (
        <div className="overlay buscar-movil" onMouseDown={(e) => e.target === e.currentTarget && setBuscar(false)}>
          <div className="buscar-caja"><GlobalSearch autoFocus onDone={() => setBuscar(false)} /><button className="btn ghost icon" onClick={() => setBuscar(false)} aria-label="Cerrar"><X /></button></div>
        </div>
      )}
      <main className="content"><Outlet /></main>
      <nav className="bottom-nav no-print" aria-label="Navegación rápida">
        {izquierda.map((z) => <button key={z.id} className={actual === z.id ? 'active' : ''} onClick={() => abrirZona(z)}><z.icon size={26} />{z.label}</button>)}
        <NavLink to="/escanear" className="center"><span className="ico"><Ic.Escaner size={30} /></span><em>Escanear</em></NavLink>
        {derecha.map((z) => <button key={z.id} className={actual === z.id ? 'active' : ''} onClick={() => abrirZona(z)}><z.icon size={26} />{z.label}</button>)}
        <button className={!['produccion', 'taller', 'obra'].includes(actual) ? 'active' : ''} onClick={() => setHoja('todas')}><Ic.Zonas size={26} />Más</button>
      </nav>
      {hoja && <HojaZonas zonas={zonas} soloZona={hoja === 'todas' ? null : hoja} onClose={() => setHoja(null)} />}
    </div>
  );
}
