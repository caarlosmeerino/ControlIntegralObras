import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get } from '../lib/api.js';
import { Loading, ErrorBox } from '../components/ui.jsx';

// Destino de los códigos QR impresos: /q/<token> → ficha de la pieza
export default function QrRedirect() {
  const { token } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState(null);
  useEffect(() => { get(`/piezas/qr/${token}`).then((r) => nav(`/piezas/${r.id}?origen=qr`, { replace: true })).catch(setError); }, [token, nav]);
  return error ? <ErrorBox error={error} /> : <Loading />;
}
