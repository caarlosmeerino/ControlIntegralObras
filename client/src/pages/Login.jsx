import { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApp } from '../lib/app.jsx';

export default function Login() {
  const { setUser, recargarUsuario } = useApp();
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [ver, setVer] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const enviar = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await post('/auth/login', { username: u, password: p }); setUser(r.user); recargarUsuario(); }
    catch (er) { setError(er.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card stack" onSubmit={enviar}>
        <div className="row" style={{ gap: 14 }}>
          <img src="/icono.svg" alt="" width="56" height="56" style={{ borderRadius: 14 }} />
          <div><h1 style={{ fontSize: '1.35rem' }}>Control Integral de Obras</h1><div className="muted small">Fabricación y montaje de estructuras metálicas</div></div>
        </div>
        {error && <div className="banner bad" role="alert">{error}</div>}
        <div className="field"><label htmlFor="u">Usuario</label>
          <input id="u" className="input" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required /></div>
        <div className="field"><label htmlFor="p">Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input id="p" className="input" type={ver ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required style={{ paddingRight: 56 }} />
            <button type="button" className="btn ghost icon" style={{ position: 'absolute', right: 0, top: 0 }} onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <EyeOff /> : <Eye />}</button>
          </div></div>
        <button className="btn primary big block" disabled={busy}><LogIn />{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
