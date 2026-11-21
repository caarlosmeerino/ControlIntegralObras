import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useData } from '../lib/app.jsx';
import { Loading, ErrorBox } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export default function Etiquetas() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const ids = sp.get('ids');
  const { data, error, loading } = useData(`/piezas/etiquetas/${id}${ids ? `?ids=${ids}` : ''}`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <div className="page-head no-print">
        <div><h1>Etiquetas QR</h1><p>{data.length} etiqueta(s). Imprime en papel adhesivo y pega una en cada pieza.</p></div>
        <div className="page-actions"><Link className="btn" to={`/obras/${id}`}><ArrowLeft size={18} />Volver</Link><button className="btn primary" onClick={() => print()}><Printer size={18} />Imprimir</button></div>
      </div>
      <div className="labels">
        {data.map((p) => (
          <div key={p.id} className="label-qr">
            <div dangerouslySetInnerHTML={{ __html: p.svg }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 900, fontSize: 22 }}>{p.marca}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{p.codigo}</div>
              <div style={{ fontSize: 11 }}>{f.ELEMENTOS[p.elemento]} {p.perfil}</div>
              <div style={{ fontSize: 11 }}>Plano {p.plano || '—'} · {p.cantidad} ud</div>
              <div style={{ fontSize: 11 }}>{f.kg(p.peso_unitario_kg)} / ud</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
