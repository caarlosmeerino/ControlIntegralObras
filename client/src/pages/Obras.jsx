import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Search } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { Loading, ErrorBox, Seg, DataTable, Status, Bar, Empty } from '../components/ui.jsx';
import ObraForm from '../components/ObraForm.jsx';
import { ObraCard } from './Panel.jsx';
import * as f from '../lib/format.js';

export default function Obras() {
  const { can } = useApp();
  const [sp, setSp] = useSearchParams();
  const [estado, setEstado] = useState('activas');
  const [vista, setVista] = useState(() => (window.innerWidth < 980 ? 'tarjetas' : 'tabla'));
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useData('/obras');
  const nav = useNavigate();
  const nueva = sp.get('nueva') === '1';
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const lista = data.filter((o) => (estado === 'todas' || (estado === 'activas' ? ['planificada', 'en_curso', 'pausada'].includes(o.estado) : o.estado === estado))
    && (!q || `${o.codigo} ${o.nombre} ${o.cliente}`.toLowerCase().includes(q.toLowerCase())));
  const tot = (k) => lista.reduce((s, o) => s + (o.resumen[k] || 0), 0);
  return (
    <>
      <div className="page-head">
        <div><h1>Obras</h1><p>Cada obra con su seguimiento independiente. {f.plural(lista.length, 'obra')} · {f.t(tot('kg_unicos'), 1)} únicas</p></div>
        <div className="page-actions">{can('obras.editar') && <button className="btn primary" onClick={() => setSp({ nueva: '1' })}><Plus />Nueva obra</button>}</div>
      </div>
      <div className="row wrap mb">
        <div className="search" style={{ maxWidth: 340 }}><Search size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, nombre o cliente" aria-label="Filtrar obras" /></div>
        <Seg value={estado} onChange={setEstado} options={[['activas', 'Activas'], ['terminada', 'Terminadas'], ['todas', 'Todas']]} />
        <span className="grow" />
        <span className="hide-m"><Seg value={vista} onChange={setVista} options={[['tabla', <List key="l" size={18} />], ['tarjetas', <LayoutGrid key="g" size={18} />]]} /></span>
      </div>
      {!lista.length ? <Empty title="No hay obras con estos filtros" /> : vista === 'tarjetas' ? (
        <div className="grid g-auto">{lista.map((o) => <ObraCard key={o.id} o={o} />)}</div>
      ) : (
        <div className="card pad0">
          <DataTable rows={lista} onRow={(o) => nav(`/obras/${o.id}`)}
            columns={[
              { key: 'codigo', label: 'Código', render: (o) => <span className="code">{o.codigo}</span> },
              { key: 'nombre', label: 'Obra', render: (o) => <><div className="strong">{o.nombre}</div><div className="xs muted">{o.cliente}</div></> },
              { key: 'resp', label: 'Responsable', render: (o) => o.responsable_nombre || '—' },
              { key: 'entrega', label: 'Entrega', render: (o) => f.fecha(o.fecha_entrega) },
              { key: 'unicas', label: 't únicas', num: true, render: (o) => f.tNum(o.resumen.kg_unicos, 1) },
              { key: 'fab', label: 't fabricadas', num: true, render: (o) => f.tNum(o.resumen.kg_fabricados, 1) },
              { key: 'mont', label: 't montadas', num: true, render: (o) => f.tNum(o.resumen.kg_montados, 1) },
              { key: 'avance', label: 'Avance global', width: 170, render: (o) => <div className="row" style={{ gap: 8 }}><div className="grow"><Bar value={o.resumen.avance_global} tone={o.resumen.retrasada ? 'bad' : ''} /></div><b className="small num">{f.num(o.resumen.avance_global)} %</b></div> },
              { key: 'estado', label: 'Estado', render: (o) => o.resumen.retrasada ? <Status estado="retrasado" small /> : <Status estado={o.estado} map={f.ESTADOS_OBRA} small /> },
            ]}
            footer={{ codigo: 'Total', unicas: f.tNum(tot('kg_unicos'), 1), fab: f.tNum(tot('kg_fabricados'), 1), mont: f.tNum(tot('kg_montados'), 1) }}
            card={(o) => <ObraCard o={o} />} />
        </div>
      )}
      {nueva && <ObraForm onClose={() => setSp({})} onSaved={(o) => nav(`/obras/${o.id}`)} />}
    </>
  );
}
