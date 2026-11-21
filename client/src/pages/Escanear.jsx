import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Keyboard } from 'lucide-react';
import { QrScanner } from '../components/Avance.jsx';
import { get } from '../lib/api.js';
import { useApp } from '../lib/app.jsx';

export default function Escanear() {
  const nav = useNavigate();
  const { toastError } = useApp();
  const [activo, setActivo] = useState(true);
  const [manual, setManual] = useState('');
  const onCode = useCallback(async (code) => {
    const m = String(code).match(/\/q\/([a-f0-9]{16,64})/i) || String(code).match(/^([a-f0-9]{32})$/i);
    if (!m) { toastError(new Error('Este código QR no pertenece a la aplicación.')); setActivo(false); setTimeout(() => setActivo(true), 1200); return; }
    try { const r = await get(`/piezas/qr/${m[1]}`); nav(`/piezas/${r.id}?origen=qr`); } catch (e) { toastError(e); setActivo(false); setTimeout(() => setActivo(true), 1500); }
  }, [nav, toastError]);
  const buscar = async (e) => {
    e.preventDefault();
    try { const r = await get(`/buscar?q=${encodeURIComponent(manual)}`); if (r.piezas.length === 1) nav(`/piezas/${r.piezas[0].id}`); else if (r.piezas.length) nav(`/fabricacion?q=${encodeURIComponent(manual)}`); else toastError(new Error(`No se ha encontrado ninguna pieza «${manual}».`)); }
    catch (er) { toastError(er); }
  };
  return (
    <>
      <div className="page-head"><div><h1><QrCode style={{ verticalAlign: -4 }} /> Escanear pieza</h1><p>Apunta la cámara a la etiqueta QR. Se abrirá la ficha de la pieza para registrar el avance.</p></div></div>
      {activo ? <QrScanner onCode={onCode} /> : <div className="video-wrap" />}
      <form className="card mt" onSubmit={buscar} style={{ maxWidth: 520, margin: '16px auto 0' }}>
        <label className="label row" style={{ gap: 8 }}><Keyboard size={18} />¿No se lee la etiqueta? Escribe la marca</label>
        <div className="row mt-s"><input className="input mono" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="P-01" /><button className="btn primary">Buscar</button></div>
      </form>
    </>
  );
}
