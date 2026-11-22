import { useState } from 'react';
import { Plus, PackagePlus, ChevronLeft } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, del, qs } from '../lib/api.js';
import { Loading, Sheet, Field, Stepper, Empty, Selector } from './ui.jsx';
import IconoPieza, { FAMILIAS } from './IconoPieza.jsx';
import { ListaRegistro, PiezaPropiaForm, pesoTxt } from './Registro.jsx';
import * as f from '../lib/format.js';

const ELEMENTO = { ipe: 'viga', ipn: 'viga', upn: 'viga', upe: 'viga', hea: 'pilar', heb: 'pilar', hem: 'pilar', correa_c: 'correa', correa_z: 'correa', omega: 'correa', placa: 'placa', l: 'arriostramiento', lu: 'arriostramiento' };
const PREFIJO = { viga: 'V', pilar: 'P', correa: 'C', placa: 'PL', arriostramiento: 'A' };

function siguienteMarca(piezas, familia) {
  const pre = PREFIJO[ELEMENTO[familia]] || 'M';
  const usadas = new Set(piezas.map((p) => p.marca));
  for (let i = 1; i < 999; i++) { const m = `${pre}-${String(i).padStart(2, '0')}`; if (!usadas.has(m)) return m; }
  return `${pre}-${Date.now() % 1000}`;
}

/** Paso 2: cuántas, de qué longitud o superficie, y peso calculado */
function Configurar({ obraId, pieza, item, piezas, etapas = [], etapaInicial, onClose, onVolver, onSaved }) {
  const { toast, toastError } = useApp();
  const cat = item; // pieza del registro
  const unidad = cat?.unidad || (pieza?.ml_unitario ? 'm' : pieza?.m2_unitario ? 'm2' : 'ud');
  const pesoBase = cat ? Number(cat.peso) : (unidad === 'm' && pieza.ml_unitario ? pieza.peso_unitario_kg / pieza.ml_unitario : unidad === 'm2' && pieza.m2_unitario ? pieza.peso_unitario_kg / pieza.m2_unitario : pieza.peso_unitario_kg);
  const [marca, setMarca] = useState(pieza?.marca || siguienteMarca(piezas, cat?.familia));
  const [cantidad, setCantidad] = useState(pieza?.cantidad || 1);
  const [medida, setMedida] = useState(pieza ? String((unidad === 'm' ? pieza.ml_unitario : unidad === 'm2' ? pieza.m2_unitario : 0) || '').replace('.', ',') : '');
  const [plano, setPlano] = useState(pieza?.plano || '');
  const [obs, setObs] = useState(pieza?.observaciones || '');
  const [etapa, setEtapa] = useState(pieza ? (pieza.etapa_id || '') : (etapaInicial || ''));
  const [busy, setBusy] = useState(false);
  const med = f.parseNum(medida) || 0;
  const pesoUd = unidad === 'ud' ? pesoBase : pesoBase * med;
  const guardar = async () => {
    if (unidad !== 'ud' && !med) return toastError(new Error(unidad === 'm' ? 'Indica la longitud de cada pieza en metros.' : 'Indica la superficie de cada pieza en m².'));
    setBusy(true);
    try {
      const body = {
        obra_id: obraId, marca, cantidad, plano, observaciones: obs,
        elemento: pieza?.elemento || ELEMENTO[cat?.familia] || 'otro', perfil: pieza?.perfil || cat?.designacion || '',
        peso_unitario_kg: Math.round(pesoUd * 1000) / 1000, ml_unitario: unidad === 'm' ? med : 0, m2_unitario: unidad === 'm2' ? med : 0,
        catalogo_id: cat?.id || pieza?.catalogo_id || null,
        etapa_id: etapa || null,
      };
      if (pieza) await put(`/piezas/${pieza.id}`, body); else await post('/piezas', body);
      toast(pieza ? `${marca} actualizada.` : `${marca} añadida: ${f.kg(pesoUd * cantidad)}.`);
      onSaved(); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const borrar = async () => {
    if (!confirm(`¿Quitar ${pieza.marca} del proyecto?`)) return;
    try { await del(`/piezas/${pieza.id}`); toast(`${pieza.marca} quitada.`); onSaved(); onClose(); } catch (e) { toastError(e); }
  };
  const nombre = cat?.designacion || pieza?.catalogo_nombre || pieza?.perfil || pieza?.marca;
  const familia = cat?.familia || pieza?.familia || 'propia';
  return (
    <Sheet title={pieza ? `Pieza ${pieza.marca}` : 'Añadir al proyecto'} onClose={onClose}
      footer={<>{pieza ? <button className="btn danger" onClick={borrar}>Quitar</button> : <button className="btn" onClick={onVolver}><ChevronLeft size={18} />Volver</button>}
        <button className="btn primary" disabled={busy} onClick={guardar}>{pieza ? 'Guardar' : 'Añadir'}</button></>}>
      <div className="stack">
        <div className="row" style={{ gap: 14 }}>
          <IconoPieza familia={familia} size={56} />
          <div className="grow"><div className="strong" style={{ fontSize: '1.15rem' }}>{nombre}</div><div className="muted small">{FAMILIAS[familia] || ''} · {pesoTxt({ peso: pesoBase, unidad })}</div></div>
        </div>
        <div className="form-grid">
          <Field label="Marca"><input className="input mono" value={marca} onChange={(e) => setMarca(e.target.value.toUpperCase())} /></Field>
          <Field label="Plano (opcional)"><input className="input" value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="E-101" /></Field>
          {etapas.length > 0 && (
            <Field label="Fase en la que se usa" full>
              <Selector titulo="Fase" value={etapa} onChange={setEtapa}
                options={[{ value: '', label: 'Sin fase asignada' }, ...etapas.map((e) => ({ value: e.id, label: `${e.orden}. ${e.nombre}`, sub: e.fecha_inicio ? `${f.fecha(e.fecha_inicio)} → ${f.fecha(e.fecha_fin)}` : '' }))]} />
            </Field>
          )}
          <Field label="Cantidad" full><Stepper value={cantidad} onChange={setCantidad} min={1} max={9999} /></Field>
          {unidad !== 'ud' && (
            <Field label={unidad === 'm' ? 'Longitud de cada pieza' : 'Superficie de cada pieza'} full>
              <label className="medida"><input className="input" inputMode="decimal" value={medida} onChange={(e) => setMedida(e.target.value)} placeholder={unidad === 'm' ? 'Ej.: 6,5' : 'Ej.: 1,2'} autoFocus={!pieza} /><em>{unidad === 'm' ? 'm' : 'm²'}</em></label>
            </Field>
          )}
          <Field label="Observaciones" full><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
        </div>
        <div className="peso-total">
          <div><span>Cada pieza</span><b>{f.kg(pesoUd)}</b></div>
          <div><span>Total ({cantidad} ud)</span><b>{f.kg(pesoUd * cantidad)}</b></div>
        </div>
      </div>
    </Sheet>
  );
}

function FilaPieza({ p, onClick }) {
  return (
    <button type="button" className="lista-fila pieza-fila" onClick={onClick}>
      <IconoPieza familia={p.familia || 'propia'} />
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
        <span className="lista-titulo"><span className="marca">{p.marca}</span> · {p.catalogo_nombre || p.perfil || f.ELEMENTOS[p.elemento]}</span>
        <span className="lista-sub">{p.cantidad} ud{p.ml_unitario ? ` × ${f.num(p.ml_unitario, 2)} m` : ''}{p.m2_unitario ? ` × ${f.num(p.m2_unitario, 2)} m²` : ''}{p.plano ? ` · plano ${p.plano}` : ''}</span>
      </span>
      <b className="num">{f.kg(p.peso_total_kg)}</b>
    </button>
  );
}

/** Piezas del proyecto (pestaña) o de una fase concreta (etapaId) */
export default function PiezasProyecto({ obraId, etapas = [], etapaId = null }) {
  const { can } = useApp();
  const { data: todas, loading, reload } = useData(`/piezas${qs({ obra_id: obraId })}`);
  const data = todas && etapaId ? todas.filter((p) => p.etapa_id === Number(etapaId)) : todas;
  const [paso, setPaso] = useState(null); // null | 'buscar' | { item } | { pieza }
  const [nueva, setNueva] = useState(false);
  if (loading && !data) return <Loading />;
  const piezas = data || [];
  const total = piezas.reduce((s, p) => s + p.peso_total_kg, 0);
  const editar = can('piezas.editar');
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div><h2>{etapaId ? 'Piezas de esta fase' : 'Piezas del proyecto'}</h2><p>{f.plural(piezas.length, 'marca')} · {f.num(piezas.reduce((s, p) => s + p.cantidad, 0))} unidades · <b>{f.kg(total)}</b></p></div>
          {editar && <button className="btn primary" onClick={() => setPaso('buscar')}><Plus size={18} />Añadir pieza</button>}
        </div>
        {!piezas.length ? <Empty title={etapaId ? 'Esta fase aún no tiene piezas' : 'Todavía no hay piezas'}>Añádelas desde el registro de piezas o crea una nueva.</Empty> : etapaId || !etapas.length ? (
          <div className="lista lista-plana">
            {piezas.map((p) => <FilaPieza key={p.id} p={p} onClick={() => editar && setPaso({ pieza: p })} />)}
          </div>
        ) : (
          [...etapas.map((e) => ({ id: e.id, titulo: `${e.orden}. ${e.nombre}` })), { id: null, titulo: 'Sin fase asignada' }].map((g) => {
            const del_ = piezas.filter((p) => (p.etapa_id || null) === g.id);
            if (!del_.length) return null;
            return (
              <div key={g.id ?? 'sin'} className="grupo-piezas">
                <div className="grupo-cab"><span>{g.titulo}</span><span>{f.kg(del_.reduce((s, p) => s + p.peso_total_kg, 0))}</span></div>
                <div className="lista lista-plana">
                  {del_.map((p) => <FilaPieza key={p.id} p={p} onClick={() => editar && setPaso({ pieza: p })} />)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {paso === 'buscar' && (
        <Sheet title="Elegir del registro" onClose={() => setPaso(null)} wide>
          <button type="button" className="picker-fila crear-pieza" onClick={() => setNueva(true)}>
            <span className="avatar-cliente nuevo"><PackagePlus size={20} /></span>
            <span className="grow"><span className="picker-nombre">Crear una pieza nueva</span><span className="picker-sub">Se guarda también en el registro de piezas</span></span>
          </button>
          <ListaRegistro autoFocus onElegir={(item) => setPaso({ item })} />
        </Sheet>
      )}
      {paso?.item && <Configurar obraId={obraId} item={paso.item} piezas={todas || []} etapas={etapas} etapaInicial={etapaId} onClose={() => setPaso(null)} onVolver={() => setPaso('buscar')} onSaved={reload} />}
      {paso?.pieza && <Configurar obraId={obraId} pieza={paso.pieza} item={paso.pieza.catalogo_id ? { id: paso.pieza.catalogo_id, familia: paso.pieza.familia, designacion: paso.pieza.catalogo_nombre, unidad: paso.pieza.catalogo_unidad, peso: paso.pieza.catalogo_peso } : null}
        piezas={todas || []} etapas={etapas} onClose={() => setPaso(null)} onSaved={reload} />}
      {nueva && <PiezaPropiaForm onClose={() => setNueva(false)} onSaved={(item) => { if (item) setPaso({ item }); }} />}
    </div>
  );
}
