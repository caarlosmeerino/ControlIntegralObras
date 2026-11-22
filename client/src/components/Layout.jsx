import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff, CalendarDays, Boxes, Users, HardHat, ChevronRight, UserRound, Moon, Sun, DatabaseBackup, LogOut, Plus, Menu } from 'lucide-react';
import * as Ic from './iconos.jsx';
import { bloquearScroll } from './ui.jsx';
import { useApp } from '../lib/app.jsx';
import { ROLES } from '../lib/format.js';

const iniciales = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

function useOscuro() {
  const { tema, setTema } = useApp();
  const oscuro = tema === 'dark' || (tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return [oscuro, () => setTema(oscuro ? 'light' : 'dark')];
}

/** Hoja «Más» del móvil: cuenta, gestión y salir */
function MenuMovil({ onIr, onClose }) {
  const { user, can, logout } = useApp();
  const [oscuro, cambiarTema] = useOscuro();
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); bloquearScroll(1);
    return () => { document.removeEventListener('keydown', k); bloquearScroll(-1); };
  }, [onClose]);
  const fila = (I, texto, onClick, extra) => (
    <button type="button" className="mc-fila" onClick={onClick}>
      <span className="mc-icono"><I size={18} /></span><span className="grow">{texto}</span>{extra ?? <ChevronRight size={17} className="mc-chev" />}
    </button>
  );
  return (
    <div className="menu-capa" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-cuenta" role="dialog" aria-modal="true" aria-label="Más opciones">
        <div className="mc-grabber" />
        <button type="button" className="mc-perfil" onClick={() => onIr('/perfil')}>
          <span className="mc-avatar">{iniciales(user.nombre)}</span>
          <span className="grow"><b>{user.nombre}</b><small>{ROLES[user.rol]} · {user.username}</small></span>
          <ChevronRight size={17} className="mc-chev" />
        </button>
        <div className="mc-grupo">
          {fila(UserRound, 'Mi cuenta y contraseña', () => onIr('/perfil'))}
          {can('usuarios.admin') && fila(Users, 'Usuarios', () => onIr('/usuarios'))}
          {can('sistema.admin') && fila(DatabaseBackup, 'Copias de seguridad', () => onIr('/sistema'))}
          {fila(oscuro ? Sun : Moon, 'Modo oscuro', cambiarTema, <span className={`mc-switch ${oscuro ? 'on' : ''}`} aria-hidden="true"><i /></span>)}
        </div>
        <div className="mc-grupo">
          <button type="button" className="mc-fila mc-salir" onClick={() => { onClose(); logout(); }}>
            <span className="mc-icono"><LogOut size={18} /></span><span className="grow">Cerrar sesión</span>
          </button>
        </div>
        <button type="button" className="mc-cerrar" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, can, logout, online, cola } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [mas, setMas] = useState(false);
  const [oscuro, cambiarTema] = useOscuro();
  useEffect(() => { setMas(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const empieza = (...p) => p.some((x) => loc.pathname.startsWith(x));
  const enPlanning = loc.pathname === '/' || empieza('/planning', '/clientes', '/obras');
  const principal = [
    { to: '/', label: 'Planning', icon: CalendarDays, on: enPlanning },
    { to: '/piezas', label: 'Piezas', icon: Boxes, on: empieza('/piezas') },
  ];
  const equipo = can('personal.ver') ? [{ to: '/empleados', label: 'Empleados', icon: HardHat, on: empieza('/empleados') }] : [];
  const gestion = [
    ...(can('usuarios.admin') ? [{ to: '/usuarios', label: 'Usuarios', icon: Users, on: empieza('/usuarios') }] : []),
    ...(can('sistema.admin') ? [{ to: '/sistema', label: 'Copias de seguridad', icon: DatabaseBackup, on: empieza('/sistema') }] : []),
  ];
  const ir = (to) => { setMas(false); nav(to); };
  const nuevo = can('obras.editar');
  const enlace = (s) => (
    <NavLink key={s.to} to={s.to} className={`lat-link ${s.on ? 'on' : ''}`} aria-current={s.on ? 'page' : undefined}>
      <s.icon size={19} strokeWidth={1.9} /><span>{s.label}</span>
    </NavLink>
  );
  const titulo = [...principal, ...equipo, ...gestion].find((s) => s.on)?.label || (empieza('/perfil') ? 'Mi cuenta' : '');

  return (
    <div className="app app-lateral">
      {/* Menú lateral (ordenador y tablet) */}
      <aside className="lateral no-print" aria-label="Menú principal">
        <NavLink to="/" className="lat-marca" aria-label="Inicio">
          <span className="app-icon"><Ic.PerfilH size={18} /></span><b>Control Integral</b>
        </NavLink>
        {nuevo && <button type="button" className="btn primary lat-nuevo" onClick={() => nav('/?nuevo=1')}><Plus size={18} />Nuevo proyecto</button>}
        <div className="lat-seccion">Proyectos</div>
        {principal.map(enlace)}
        {equipo.length > 0 && <><div className="lat-seccion">Equipo</div>{equipo.map(enlace)}</>}
        {gestion.length > 0 && <><div className="lat-seccion">Gestión</div>{gestion.map(enlace)}</>}
        <div className="grow" />
        <button type="button" className="lat-link" onClick={cambiarTema}>{oscuro ? <Sun size={19} /> : <Moon size={19} />}<span>{oscuro ? 'Modo claro' : 'Modo oscuro'}</span></button>
        <div className="lat-usuario">
          <NavLink to="/perfil" className="lat-yo">
            <span className="mc-avatar peq">{iniciales(user.nombre)}</span>
            <span className="grow" style={{ minWidth: 0 }}><b>{user.nombre}</b><small>{ROLES[user.rol]}</small></span>
          </NavLink>
          <button type="button" className="btn ghost icon" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </aside>

      <div className="principal">
        {(!online || cola > 0) && (
          <div className="offline">{!online ? <><WifiOff size={16} style={{ verticalAlign: -3 }} /> Sin conexión. Los cambios se envían al volver la red.</> : null}
            {cola > 0 && ` ${cola} cambio(s) pendiente(s) de enviar.`}</div>
        )}
        {/* Barra superior del móvil */}
        <header className="barra-movil no-print">
          <button type="button" className="btn ghost icon" onClick={() => setMas(true)} aria-label="Menú"><Menu size={22} /></button>
          <b className="grow">{titulo || 'Control Integral'}</b>
          <NavLink to="/perfil" className="mc-avatar mini2" aria-label="Mi cuenta">{iniciales(user.nombre)}</NavLink>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {/* Barra de pestañas inferior (móvil) con botón central */}
      <nav className="tabbar no-print" aria-label="Secciones">
        {principal.map((s) => (
          <NavLink key={s.to} to={s.to} className={`tab ${s.on ? 'on' : ''}`} aria-current={s.on ? 'page' : undefined}><s.icon size={23} strokeWidth={s.on ? 2.2 : 1.8} /><span>{s.label}</span></NavLink>
        ))}
        {nuevo && <button type="button" className="tab tab-central" onClick={() => nav('/?nuevo=1')} aria-label="Nuevo proyecto"><span className="tab-bola"><Plus size={26} strokeWidth={2.4} /></span><span>Nuevo</span></button>}
        {equipo.map((s) => (
          <NavLink key={s.to} to={s.to} className={`tab ${s.on ? 'on' : ''}`} aria-current={s.on ? 'page' : undefined}><s.icon size={23} strokeWidth={s.on ? 2.2 : 1.8} /><span>{s.label}</span></NavLink>
        ))}
        <button type="button" className={`tab ${mas || empieza('/perfil', '/sistema', '/usuarios') ? 'on' : ''}`} onClick={() => setMas(true)}><Menu size={23} /><span>Más</span></button>
      </nav>

      {mas && <MenuMovil onIr={ir} onClose={() => setMas(false)} />}
    </div>
  );
}
