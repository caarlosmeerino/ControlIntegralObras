import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, del } from '../lib/api.js';
import { Loading, ErrorBox, Kpi, Bar, Sheet, Field, DataTable } from './ui.jsx';
import * as f from '../lib/format.js';

export default function CostesObra({ obraId }) {
  const { can, toast, toastError } = useApp();
  const { data, error, loading, reload } = useData(`/costes/obra/${obraId}`);
  const [nuevo, setNuevo] = useState(null);
  const [pres, setPres] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const r = data.resumen; const cats = data.categorias;
  const guardarCoste = async () => {
    try { await post('/costes', { ...nuevo, obra_id: obraId, importe: f.parseNum(nuevo.importe) }); toast('Coste registrado.'); setNuevo(null); reload(); } catch (e) { toastError(e); }
  };
  const guardarPres = async () => {
    try {
      await put(`/costes/obra/${obraId}/presupuesto`, { partidas: Object.entries(pres).map(([categoria, v]) => ({ categoria, concepto: '', importe: f.parseNum(v) || 0 })).filter((p) => p.importe > 0) });
      toast('Presupuesto de costes guardado.'); setPres(null); reload();
    } catch (e) { toastError(e); }
  };
  const borrar = async (c) => { if (!confirm(`¿Eliminar «${c.concepto}»?`)) return; try { await del(`/costes/${c.id}`); reload(); } catch (e) { toastError(e); } };
  const over = r.consumido_pct > r.avance_global + 5;
  return (
    <div className="stack">
      <div className="grid g4">
        <Kpi label="Presupuesto de coste" value={f.eur0(r.previsto)} sub={`Venta: ${f.eur0(r.presupuesto)}`} />
        <Kpi label="Coste real" value={f.eur0(r.real)} tone={over ? 'bad' : 'ok'} sub={`${f.pct(r.consumido_pct)} consumido · avance ${f.pct(r.avance_global)}`} />
        <Kpi label="Coste por t fabricada" value={r.coste_t_fabricada ? f.eur0(r.coste_t_fabricada) : '—'} sub={`Previsto: ${r.coste_t_prevista ? f.eur0(r.coste_t_prevista) : '—'} /t`} tone={r.coste_t_fabricada > r.coste_t_prevista ? 'warn' : 'ok'} />
        <Kpi label="Horas imputadas" value={f.horas(r.horas)} tone="idle" sub={`${f.t(r.t_fabricadas * 1000)} fabricadas`} />
      </div>
      <div className="card">
        <div className="card-head"><div><h2>Presupuesto frente a real por partida</h2><p>La mano de obra y los medios de elevación se calculan solos a partir de los partes.</p></div>
          {can('costes.editar') && <button className="btn" onClick={() => setPres(Object.fromEntries(Object.keys(cats).map((k) => [k, r.categorias[k].previsto ? String(r.categorias[k].previsto).replace('.', ',') : ''])))}>Editar presupuesto</button>}</div>
        <div className="stack" style={{ gap: 14 }}>
          {Object.entries(cats).map(([k, label]) => {
            const c = r.categorias[k]; const p = c.previsto ? (c.real / c.previsto) * 100 : c.real ? 100 : 0;
            return (
              <div key={k}>
                <div className="row between small"><span className="strong">{label}</span><span className="num">{f.eur0(c.real)} <span className="muted">/ {f.eur0(c.previsto)}</span></span></div>
                <div className="mt-s"><Bar value={p} tone={p > 100 ? 'bad' : p > 85 ? 'warn' : 'ok'} /></div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div><h2>Costes imputados</h2><p>Facturas, albaranes y otros gastos</p></div>
          {can('costes.editar') && <button className="btn primary" onClick={() => setNuevo({ fecha: f.hoyISO(), categoria: 'material', concepto: '', proveedor: '', documento: '', importe: '' })}><Plus size={18} />Añadir coste</button>}</div>
        <DataTable rows={data.costes} empty="No hay costes registrados."
          columns={[{ key: 'fecha', label: 'Fecha', render: (c) => f.fecha(c.fecha) }, { key: 'cat', label: 'Partida', render: (c) => cats[c.categoria] }, { key: 'concepto', label: 'Concepto' },
            { key: 'proveedor', label: 'Proveedor' }, { key: 'documento', label: 'Documento' }, { key: 'importe', label: 'Importe', num: true, render: (c) => <b>{f.eur(c.importe)}</b> },
            can('costes.editar') && { key: 'x', label: '', render: (c) => <button className="btn ghost icon danger" onClick={() => borrar(c)} aria-label="Eliminar"><Trash2 size={18} /></button> }].filter(Boolean)} />
      </div>
      {nuevo && (
        <Sheet title="Añadir coste" onClose={() => setNuevo(null)} footer={<><button className="btn" onClick={() => setNuevo(null)}>Cancelar</button><button className="btn primary" onClick={guardarCoste}><Save size={18} />Guardar</button></>}>
          <div className="form-grid">
            <Field label="Fecha"><input type="date" className="input" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></Field>
            <Field label="Partida"><select className="input" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Concepto *" full><input className="input" value={nuevo.concepto} onChange={(e) => setNuevo({ ...nuevo, concepto: e.target.value })} /></Field>
            <Field label="Proveedor"><input className="input" value={nuevo.proveedor} onChange={(e) => setNuevo({ ...nuevo, proveedor: e.target.value })} /></Field>
            <Field label="Nº factura / albarán"><input className="input" value={nuevo.documento} onChange={(e) => setNuevo({ ...nuevo, documento: e.target.value })} /></Field>
            <Field label="Importe (€) *"><input className="input" inputMode="decimal" value={nuevo.importe} onChange={(e) => setNuevo({ ...nuevo, importe: e.target.value })} /></Field>
          </div>
        </Sheet>
      )}
      {pres && (
        <Sheet title="Presupuesto de costes por partida" onClose={() => setPres(null)} footer={<><button className="btn" onClick={() => setPres(null)}>Cancelar</button><button className="btn primary" onClick={guardarPres}><Save size={18} />Guardar</button></>}>
          <div className="form-grid">
            {Object.entries(cats).map(([k, v]) => <Field key={k} label={`${v} (€)`}><input className="input" inputMode="decimal" value={pres[k]} onChange={(e) => setPres({ ...pres, [k]: e.target.value })} /></Field>)}
            <div className="full banner info">Total: <b>{f.eur(Object.values(pres).reduce((s, v) => s + (f.parseNum(v) || 0), 0))}</b></div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
