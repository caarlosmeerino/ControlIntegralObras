import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import * as Ic from './iconos.jsx';
import { useApp } from '../lib/app.jsx';
import { ROLES } from '../lib/format.js';

/** Barra superior mínima: logo (vuelve a Inicio) y menú de la cuenta. */
export default function Layout() {
  const { user, can, logout, tema, setTema, online, cola } = useApp();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const oscuro = tema === 'dark' || (tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  return (
    <div className="app">
      {(!online || cola > 0) && (
        <div className="offline">{!online ? <><WifiOff size={16} style={{ verticalAlign: -3 }} /> Sin conexión. Los avances se guardan y se envían al volver la red.</> : null}
          {cola > 0 && ` ${cola} avance(s) pendiente(s) de enviar.`}</div>
      )}
      <header className="cabecera no-print">
        <div className="cab-fila">
          <NavLink to="/" className="marca-app" aria-label="Inicio">
            <span className="app-icon"><Ic.PerfilH size={18} /></span>
            <span className="marca-txt">Control Integral</span>
          </NavLink>
          <div className="grow" />
          <button className="btn icon cab-btn" onClick={() => setTema(oscuro ? 'light' : 'dark')} aria-label={oscuro ? 'Modo claro' : 'Modo oscuro'} title={oscuro ? 'Modo claro' : 'Modo oscuro'}>{oscuro ? <Ic.Sol size={22} /> : <Ic.Luna size={22} />}</button>
          <div className="usuario">
            <button className="btn cab-btn avatar" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Mi cuenta">{user.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</button>
            {menu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setMenu(false)} />
                <div className="menu-user">
                  <div className="mu-head"><b>{user.nombre}</b><span>{ROLES[user.rol]}</span></div>
                  <NavLink to="/perfil" className="mu-item"><Ic.Operario size={20} />Mi cuenta</NavLink>
                  {can('usuarios.admin') && <NavLink to="/usuarios" className="mu-item"><Ic.Llave size={20} />Usuarios y permisos</NavLink>}
                  {can('sistema.admin') && <NavLink to="/sistema" className="mu-item"><Ic.Archivo size={20} />Copias de seguridad</NavLink>}
                  <button className="mu-item" onClick={logout}><Ic.Salir size={20} />Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  );
}
