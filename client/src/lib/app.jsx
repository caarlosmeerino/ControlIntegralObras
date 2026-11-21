import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { get, post, setUnauthorizedHandler, sincronizar, pendientes } from './api.js';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [cola, setCola] = useState(pendientes().length);
  const [tema, setTemaState] = useState(() => { try { return localStorage.getItem('cio-tema') || 'auto'; } catch { return 'auto'; } });
  const id = useRef(0);

  const toast = useCallback((msg, type = 'ok', ms = 4200) => {
    const k = ++id.current;
    setToasts((t) => [...t, { k, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.k !== k)), ms);
  }, []);
  const toastError = useCallback((e) => toast(e?.message || String(e), 'error', 6500), [toast]);

  const cargarUsuario = useCallback(async () => {
    try { const r = await get('/auth/me'); setUser(r.user); } catch (e) { if (e.status === 0 && user) return; setUser(null); }
  }, []);

  useEffect(() => { cargarUsuario(); setUnauthorizedHandler(() => setUser(null)); }, [cargarUsuario]);

  useEffect(() => {
    const sync = async () => {
      const r = await sincronizar();
      if (r.enviados) toast(`Conexión recuperada: ${r.enviados} avance(s) pendiente(s) enviados.`);
      r.errores.forEach((m) => toast(m, 'error', 8000));
    };
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    const upd = () => setCola(pendientes().length);
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('cio-outbox', upd);
    if (navigator.onLine) sync();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('cio-outbox', upd); };
  }, [toast]);

  const setTema = (t) => {
    setTemaState(t);
    try { if (t === 'auto') localStorage.removeItem('cio-tema'); else localStorage.setItem('cio-tema', t); } catch { /* */ }
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  };

  const logout = async () => { await post('/auth/logout').catch(() => {}); setUser(null); };
  const can = useCallback((...p) => !!user && p.some((x) => user.permisos.includes(x)), [user]);

  const value = useMemo(() => ({ user, setUser, can, logout, toast, toastError, online, cola, tema, setTema, recargarUsuario: cargarUsuario }),
    [user, can, toast, toastError, online, cola, tema, cargarUsuario]);
  const Icon = { ok: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.type] || Info;
          return (
            <div key={t.k} className={`toast ${t.type}`}>
              <I size={22} style={{ flex: 'none', color: t.type === 'error' ? 'var(--bad)' : t.type === 'info' ? 'var(--info)' : 'var(--ok)' }} />
              <div className="grow">{t.msg}</div>
              <button className="btn ghost sm icon" style={{ minHeight: 28, width: 28 }} aria-label="Cerrar" onClick={() => setToasts((x) => x.filter((y) => y.k !== t.k))}><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

/** Hook de carga de datos con estado de carga/error y recarga */
export function useData(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) { setLoading(false); return; }
    const ac = new AbortController();
    setLoading(true);
    get(path, { signal: ac.signal }).then((d) => { setData(d); setError(null); }).catch((e) => { if (e.name !== 'AbortError') setError(e); }).finally(() => setLoading(false));
    return () => ac.abort();
  }, [path, n, ...deps]);
  return { data, error, loading, reload: () => setN((x) => x + 1), setData };
}
