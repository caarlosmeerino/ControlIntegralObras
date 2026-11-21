import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ActionSheet } from './ui.jsx';
import { WifiOff } from 'lucide-react';
import * as Ic from './iconos.jsx';
import { useApp } from '../lib/app.jsx';
import { ROLES } from '../lib/format.js';

/** Barra superior mínima: logo (vuelve a Inicio) y menú de la cuenta. */
export default function Layout() {
  const { user, can, logout, tema, setTema, online, cola } = useApp();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
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
          <button className="btn cab-btn avatar" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-label="Mi cuenta">{user.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</button>
        </div>
      </header>
      <main className="content"><Outlet /></main>
      {menu && (
        <ActionSheet onClose={() => setMenu(false)}
          titulo={<div className="cuenta-cab"><span className="avatar-cliente grande">{user.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><b>{user.nombre}</b><span>{ROLES[user.rol]} · {user.username}</span></div>}
          opciones={[
            { value: 'perfil', label: 'Mi cuenta y contraseña', icon: Ic.Operario, onClick: () => nav('/perfil') },
            { value: 'tema', label: oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', icon: oscuro ? Ic.Sol : Ic.Luna, onClick: () => setTema(oscuro ? 'light' : 'dark') },
            ...(can('sistema.admin') ? [{ value: 'sistema', label: 'Copias de seguridad', icon: Ic.Archivo, onClick: () => nav('/sistema') }] : []),
            { value: 'salir', label: 'Cerrar sesión', icon: Ic.Salir, danger: true, onClick: logout },
          ]} />
      )}
    </div>
  );
}
