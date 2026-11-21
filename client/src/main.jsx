import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import './styles.css';

const P = {
  Cliente: lazy(() => import('./pages/Cliente.jsx')), Obra: lazy(() => import('./pages/ObraDetalle.jsx')), Pieza: lazy(() => import('./pages/Pieza.jsx')),
  Usuarios: lazy(() => import('./pages/Usuarios.jsx')), Sistema: lazy(() => import('./pages/Sistema.jsx')), Perfil: lazy(() => import('./pages/Perfil.jsx')),
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
        <Route index element={<Inicio />} />
        {r('clientes/:nombre', P.Cliente, ['obras.ver'])}
        {r('obras/:id', P.Obra, ['obras.ver'])}
        {r('piezas/:id', P.Pieza, ['piezas.ver'])}
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
