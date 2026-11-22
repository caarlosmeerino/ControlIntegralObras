import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff, CalendarDays, Boxes, Users, HardHat, ChevronRight, UserRound, Moon, Sun, DatabaseBackup, LogOut } from 'lucide-react';
import * as Ic from './iconos.jsx';
import { bloquearScroll } from './ui.jsx';
import { useApp } from '../lib/app.jsx';
import { ROLES } from '../lib/format.js';

const iniciales = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

/** Contenido del menú de cuenta (igual en el desplegable del ordenador y en la hoja del móvil) */
function MenuCuenta({ onIr, cerrar }) {
  const { user, can, logout, tema, setTema } = useApp();
  const oscuro = tema === 'dark' || (tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const fila = (I, color, texto, onClick, extra) => (
    <button type="button" className="mc-fila" onClick={onClick}>
      <span className="mc-icono" style={{ background: color }}><I size={17} strokeWidth={2.2} /></span>
      <span className="grow">{texto}</span>{extra ?? <ChevronRight size={17} className="mc-chev" />}
    </button>
  );
  return (
    <>
      <button type="button" className="mc-perfil" onClick={() => onIr('/perfil')}>
        <span className="mc-avatar">{iniciales(user.nombre)}</span>
        <span className="grow"><b>{user.nombre}</b><small>{ROLES[user.rol]} · {user.username}</small></span>
        <ChevronRight size={17} className="mc-chev" />
      </button>
      <div className="mc-grupo">
        {fila(UserRound, '#007aff', 'Mi cuenta y contraseña', () => onIr('/perfil'))}
        {can('usuarios.admin') && fila(Users, '#5856d6', 'Usuarios', () => onIr('/usuarios'))}
        {can('sistema.admin') && fila(DatabaseBackup, '#34c759', 'Copias de seguridad', () => onIr('/sistema'))}
        {fila(oscuro ? Sun : Moon, '#8e8e93', 'Modo oscuro', () => setTema(oscuro ? 'light' : 'dark'),
          <span className={`mc-switch ${oscuro ? 'on' : ''}`} aria-hidden="true"><i /></span>)}
      </div>
      <div className="mc-grupo">
        <button type="button" className="mc-fila mc-salir" onClick={() => { cerrar(); logout(); }}>
          <span className="mc-icono" style={{ background: '#ff3b30' }}><LogOut size={17} strokeWidth={2.2} /></span>
          <span className="grow">Cerrar sesión</span>
        </button>
      </div>
    </>
  );
}

export default function Layout() {
  const { user, can, online, cola } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const pop = useRef(null);
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const movil = () => window.matchMedia('(max-width: 760px)').matches;
  useEffect(() => {
    if (!menu) return undefined;
    const k = (e) => e.key === 'Escape' && setMenu(false);
    const fuera = (e) => { if (!movil() && pop.current && !pop.current.contains(e.target) && !e.target.closest('.avatar-menu')) setMenu(false); };
    document.addEventListener('keydown', k); document.addEventListener('mousedown', fuera);
    const m = movil(); if (m) bloquearScroll(1);
    return () => { document.removeEventListener('keydown', k); document.removeEventListener('mousedown', fuera); if (m) bloquearScroll(-1); };
  }, [menu]);

  const enPlanning = loc.pathname === '/' || ['/planning', '/clientes', '/obras'].some((p) => loc.pathname.startsWith(p));
  const secciones = [
    { to: '/', label: 'Planning', icon: CalendarDays, on: enPlanning },
    { to: '/piezas', label: 'Piezas', icon: Boxes, on: loc.pathname.startsWith('/piezas') },
    ...(can('personal.ver') ? [{ to: '/empleados', label: 'Empleados', icon: HardHat, on: loc.pathname.startsWith('/empleados') }] : []),
  ];
  const ir = (to) => { setMenu(false); nav(to); };

  return (
    <div className="app">
      {(!online || cola > 0) && (
        <div className="offline">{!online ? <><WifiOff size={16} style={{ verticalAlign: -3 }} /> Sin conexión. Los cambios se envían al volver la red.</> : null}
          {cola > 0 && ` ${cola} cambio(s) pendiente(s) de enviar.`}</div>
      )}

      <header className="barra no-print">
        <div className="barra-fila">
          <NavLink to="/" className="marca-app" aria-label="Inicio">
            <span className="app-icon"><Ic.PerfilH size={18} /></span>
            <span className="marca-txt"><b>Control Integral</b><small>Obras</small></span>
          </NavLink>
          <nav className="barra-nav" aria-label="Secciones">
            {secciones.map((s) => (
              <NavLink key={s.to} to={s.to} className={`barra-link ${s.on ? 'on' : ''}`} aria-current={s.on ? 'page' : undefined}>
                <s.icon size={18} strokeWidth={2} />{s.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className={`avatar-menu ${menu ? 'abierto' : ''}`} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Mi cuenta">
            <span className="mc-avatar peq">{iniciales(user.nombre)}</span>
            <span className="avatar-txt"><b>{user.nombre.split(' ')[0]}</b><small>{ROLES[user.rol]}</small></span>
          </button>
        </div>
      </header>

      <main className="content"><Outlet /></main>

      {/* Barra de pestañas inferior en el móvil */}
      <nav className="tabbar no-print" aria-label="Secciones">
        {secciones.map((s) => (
          <NavLink key={s.to} to={s.to} className={`tab ${s.on ? 'on' : ''}`} aria-current={s.on ? 'page' : undefined}>
            <s.icon size={24} strokeWidth={s.on ? 2.3 : 1.8} /><span>{s.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`tab ${menu || ['/perfil', '/sistema', '/usuarios'].some((p) => loc.pathname.startsWith(p)) ? 'on' : ''}`} onClick={() => setMenu(true)} aria-label="Mi cuenta">
          <span className="mc-avatar mini">{iniciales(user.nombre)}</span><span>Cuenta</span>
        </button>
      </nav>

      {menu && (
        <div className="menu-capa" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="menu-cuenta" ref={pop} role="menu" aria-label="Mi cuenta">
            <div className="mc-grabber" />
            <MenuCuenta onIr={ir} cerrar={() => setMenu(false)} />
            <button type="button" className="mc-cerrar" onClick={() => setMenu(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
