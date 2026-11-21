import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Building2, CalendarRange, Factory, Wrench, Truck, HardHat, Users, UsersRound, FileText, Gauge,
  Search, QrCode, Menu, Moon, Sun, MonitorSmartphone, LogOut, ShieldCheck, Database, Package, KeyRound, WifiOff, ClipboardList,
} from 'lucide-react';
import { useApp } from '../lib/app.jsx';
import { get } from '../lib/api.js';
import { ROLES } from '../lib/format.js';

export const MENU = [
  { to: '/', label: 'Panel principal', icon: LayoutDashboard, perm: ['obras.ver'], end: true },
  { to: '/resumen', label: 'Resumen de producción', icon: BarChart3, perm: ['obras.ver'] },
  { to: '/obras', label: 'Obras', icon: Building2, perm: ['obras.ver'] },
  { to: '/proyectos', label: 'Gestión de proyectos', icon: CalendarRange, perm: ['obras.ver'] },
  { to: '/fabricacion', label: 'Fabricación', icon: Factory, perm: ['piezas.ver'] },
  { to: '/taller', label: 'Control del taller', icon: Wrench, perm: ['partes.taller', 'personal.ver'] },
  { to: '/montaje', label: 'Montaje', icon: Truck, perm: ['obras.ver'] },
  { to: '/control-obra', label: 'Control en obra', icon: HardHat, perm: ['partes.montaje'] },
  { to: '/personal', label: 'Personal', icon: Users, perm: ['personal.ver'] },
  { to: '/equipos', label: 'Operarios y equipos', icon: UsersRound, perm: ['personal.ver'] },
  { to: '/informes', label: 'Informes', icon: FileText, perm: ['informes.ver'] },
  { to: '/rendimientos', label: 'Toneladas y rendimientos', icon: Gauge, perm: ['informes.ver', 'personal.ver'] },
];
const ADMIN = [
  { to: '/usuarios', label: 'Usuarios y permisos', icon: ShieldCheck, perm: ['usuarios.admin'] },
  { to: '/sistema', label: 'Copias y sistema', icon: Database, perm: ['sistema.admin'] },
];

function bottomFor(rol) {
  const m = {
    operario: [['/', 'Inicio', LayoutDashboard], ['/fabricacion', 'Piezas', Factory], 'scan', ['/taller', 'Horas', Wrench]],
    encargado_montaje: [['/', 'Inicio', LayoutDashboard], ['/montaje', 'Montaje', Truck], 'scan', ['/control-obra', 'Parte', HardHat]],
    jefe_taller: [['/', 'Inicio', LayoutDashboard], ['/fabricacion', 'Fabricación', Factory], 'scan', ['/taller', 'Taller', Wrench]],
    administracion: [['/', 'Inicio', LayoutDashboard], ['/obras', 'Obras', Building2], 'scan', ['/informes', 'Informes', FileText]],
  };
  return m[rol] || [['/', 'Inicio', LayoutDashboard], ['/obras', 'Obras', Building2], 'scan', ['/fabricacion', 'Fabricación', Factory]];
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const ref = useRef();
  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const ac = new AbortController();
    const tm = setTimeout(() => get(`/buscar?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal }).then((r) => { setRes(r); setSel(0); }).catch(() => {}), 180);
    return () => { clearTimeout(tm); ac.abort(); };
  }, [q]);
  useEffect(() => {
    const k = (e) => { if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); ref.current?.focus(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const items = res ? [...res.obras.map((o) => ({ k: `o${o.id}`, to: `/obras/${o.id}`, icon: Building2, title: <><span className="code">{o.codigo}</span> {o.nombre}</>, sub: o.cliente })),
    ...res.piezas.map((p) => ({ k: `p${p.id}`, to: `/piezas/${p.id}`, icon: Package, title: <><span className="marca">{p.marca}</span> <span className="muted small">{p.perfil}</span></>, sub: `${p.obra_codigo} · plano ${p.plano || '—'} · ${p.cantidad} ud` }))] : [];
  const go = (it) => { nav(it.to); setQ(''); setOpen(false); ref.current?.blur(); };
  return (
    <div className="search">
      <Search size={20} />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && items[sel]) go(items[sel]);
          if (e.key === 'Escape') { setQ(''); ref.current?.blur(); }
        }}
        placeholder="Buscar obra, marca, plano…" aria-label="Buscar obras y piezas" enterKeyHint="search" autoComplete="off" />
      {open && res && (
        <div className="search-results">
          {!items.length && <div className="empty small">Sin resultados para «{q}».</div>}
          {res.obras.length > 0 && <div className="search-title">Obras</div>}
          {items.map((it, i) => (
            <div key={it.k}>
              {i === res.obras.length && res.piezas.length > 0 && <div className="search-title">Piezas</div>}
              <div className={`search-item ${i === sel ? 'sel' : ''}`} onMouseDown={() => go(it)}>
                <it.icon size={20} className="muted" />
                <div className="grow"><div>{it.title}</div><div className="xs muted">{it.sub}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomLink({ b: [to, label, I] }) {
  return <NavLink to={to} end={to === '/'}><I size={24} />{label}</NavLink>;
}

export default function Layout() {
  const { user, can, logout, tema, setTema, online, cola } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  const menu = MENU.filter((m) => can(...m.perm));
  const admin = ADMIN.filter((m) => can(...m.perm));
  const sigTema = { auto: ['dark', Moon, 'Modo oscuro'], dark: ['light', Sun, 'Modo claro'], light: ['auto', MonitorSmartphone, 'Tema del sistema'] }[tema];
  const TemaIcon = sigTema[1];

  return (
    <div className="app">
      {open && <div className="side-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`side ${open ? 'open' : ''}`} aria-label="Menú principal">
        <div className="brand"><img src="/icono.svg" alt="" /> <div>Control Integral<small>Estructuras metálicas</small></div></div>
        {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end} className="nav-link"><m.icon size={20} />{m.label}</NavLink>)}
        <NavLink to="/escanear" className="nav-link"><QrCode size={20} />Escanear QR</NavLink>
        {admin.length > 0 && <div className="nav-group">Administración</div>}
        {admin.map((m) => <NavLink key={m.to} to={m.to} className="nav-link"><m.icon size={20} />{m.label}</NavLink>)}
        <div className="side-foot">
          <button className="nav-link btn ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--side-text)' }} onClick={() => setTema(sigTema[0])}><TemaIcon size={20} />{sigTema[2]}</button>
          <NavLink to="/perfil" className="nav-link"><KeyRound size={20} /><div className="grow" style={{ lineHeight: 1.2 }}>{user.nombre}<div className="xs" style={{ opacity: .7 }}>{ROLES[user.rol]}</div></div></NavLink>
          <button className="nav-link btn ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--side-text)' }} onClick={logout}><LogOut size={20} />Cerrar sesión</button>
        </div>
      </aside>
      <div className="main">
        {(!online || cola > 0) && (
          <div className="offline">{!online ? <><WifiOff size={16} style={{ verticalAlign: -3 }} /> Sin conexión. Puedes seguir registrando avances; se enviarán al recuperar la red.</> : null}
            {cola > 0 && ` ${cola} avance(s) pendiente(s) de enviar.`}</div>
        )}
        <header className="topbar no-print">
          <button className="btn ghost icon hide-d" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <GlobalSearch />
          <button className="btn primary hide-m" onClick={() => nav('/escanear')}><QrCode size={20} />Escanear</button>
          <button className="btn ghost icon hide-m" onClick={() => setTema(sigTema[0])} aria-label={sigTema[2]} title={sigTema[2]}><TemaIcon /></button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      <nav className="bottom-nav no-print" aria-label="Navegación rápida">
        {bottomFor(user.rol).map((b) => b === 'scan'
          ? <NavLink key="scan" to="/escanear" className="center"><span className="ico"><QrCode size={28} /></span><em>Escanear</em></NavLink>
          : <BottomLink key={b[0]} b={b} />)}
        <button onClick={() => setOpen(true)}><ClipboardList size={24} />Más</button>
      </nav>
    </div>
  );
}
