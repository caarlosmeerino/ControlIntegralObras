import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Panel from './pages/Panel.jsx';
import './styles.css';

const L = (f) => lazy(f);
const P = {
  Resumen: L(() => import('./pages/Resumen.jsx')), Obras: L(() => import('./pages/Obras.jsx')), Obra: L(() => import('./pages/ObraDetalle.jsx')),
  Proyectos: L(() => import('./pages/Proyectos.jsx')), Fabricacion: L(() => import('./pages/Fabricacion.jsx')), Taller: L(() => import('./pages/Taller.jsx')),
  Montaje: L(() => import('./pages/Montaje.jsx')), ControlObra: L(() => import('./pages/ControlObra.jsx')), Personal: L(() => import('./pages/Personal.jsx')),
  Equipos: L(() => import('./pages/Equipos.jsx')), Informes: L(() => import('./pages/Informes.jsx')), Rendimientos: L(() => import('./pages/Rendimientos.jsx')),
  Pieza: L(() => import('./pages/Pieza.jsx')), Escanear: L(() => import('./pages/Escanear.jsx')), QrRedirect: L(() => import('./pages/QrRedirect.jsx')),
  Usuarios: L(() => import('./pages/Usuarios.jsx')), Sistema: L(() => import('./pages/Sistema.jsx')), Perfil: L(() => import('./pages/Perfil.jsx')),
  Etiquetas: L(() => import('./pages/Etiquetas.jsx')), Parte: L(() => import('./pages/ParteMontaje.jsx')),
};

function Guard({ perm, children }) {
  const { can } = useApp();
  if (perm && !can(...perm)) return <div className="banner bad">Tu perfil no tiene acceso a este apartado.</div>;
  return children;
}

function Root() {
  const { user } = useApp();
  if (user === undefined) return <Loading />;
  if (!user) return <Login />;
  const r = (path, El, perm) => <Route path={path} element={<Guard perm={perm}><Suspense fallback={<Loading />}><El /></Suspense></Guard>} />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Panel />} />
        {r('resumen', P.Resumen, ['obras.ver'])}
        {r('obras', P.Obras, ['obras.ver'])}
        {r('obras/:id', P.Obra, ['obras.ver'])}
        {r('obras/:id/etiquetas', P.Etiquetas, ['piezas.ver'])}
        {r('proyectos', P.Proyectos, ['obras.ver'])}
        {r('fabricacion', P.Fabricacion, ['piezas.ver'])}
        {r('taller', P.Taller, ['partes.taller', 'personal.ver'])}
        {r('montaje', P.Montaje, ['obras.ver'])}
        {r('control-obra', P.ControlObra, ['partes.montaje'])}
        {r('partes/:id', P.Parte, ['obras.ver'])}
        {r('personal', P.Personal, ['personal.ver'])}
        {r('equipos', P.Equipos, ['personal.ver'])}
        {r('informes', P.Informes, ['informes.ver'])}
        {r('rendimientos', P.Rendimientos, ['informes.ver', 'personal.ver'])}
        {r('piezas/:id', P.Pieza, ['piezas.ver'])}
        {r('escanear', P.Escanear, ['piezas.ver'])}
        {r('q/:token', P.QrRedirect, ['piezas.ver'])}
        {r('usuarios', P.Usuarios, ['usuarios.admin'])}
        {r('sistema', P.Sistema, ['sistema.admin'])}
        {r('perfil', P.Perfil)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode><AppProvider><BrowserRouter><Root /></BrowserRouter></AppProvider></StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
