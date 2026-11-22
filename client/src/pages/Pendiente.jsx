import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Circle, CheckCircle2, ListChecks, X, Package, Hammer, Truck, FileDown } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { qs, put } from '../lib/api.js';
import { Loading, ErrorBox, Empty, Cabecera, IconoIniciales, Selector, Status } from '../components/ui.jsx';
import { AvatarCliente } from '../components/ClientePicker.jsx';
import IconoPieza from '../components/IconoPieza.jsx';
import { semanaISO, lunesDeSemana, masDias, estadoEtapa, pastelObra, MESES } from '../lib/obra.js';
import * as f from '../lib/format.js';

const diaTxt = (iso) => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;

/** Rango de fechas de cada opción de «Cuándo» */
function rango(cuando, hoy) {
  const s = semanaISO(hoy);
  const lunes = lunesDeSemana(s.anio, s.semana);
  if (cuando === 'semana') return { desde: lunes, hasta: masDias(lunes, 6), txt: `Semana ${s.semana} · ${diaTxt(lunes)} – ${diaTxt(masDias(lunes, 6))}` };
  if (cuando === 'proxima') { const l = masDias(lunes, 7); return { desde: l, hasta: masDias(l, 6), txt: `Semana ${semanaISO(l).semana} · ${diaTxt(l)} – ${diaTxt(masDias(l, 6))}` }; }
  if (cuando === 'dos') return { desde: lunes, hasta: masDias(lunes, 13), txt: `${diaTxt(lunes)} – ${diaTxt(masDias(lunes, 13))}` };
  if (cuando === 'mes') { const fin = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)).toISOString().slice(0, 10); return { desde: hoy.slice(0, 8) + '01', hasta: fin, txt: `${MESES[Number(hoy.slice(5, 7)) - 1]} completo` }; }
  return { desde: null, hasta: null, txt: 'Todo lo pendiente, sin fechas' };
}

const TIPOS = [
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
  { id: 'material', label: 'Material', icon: Package, campo: 'material_recibido', boton: 'Recibido', vacio: 'No falta material' },
  { id: 'fabricar', label: 'Fabricar', icon: Hammer, campo: 'fecha_fabricacion', boton: 'Fabricada', vacio: 'No hay piezas por fabricar' },
  { id: 'montar', label: 'Montar', icon: Truck, campo: 'fecha_montaje', boton: 'Montada', vacio: 'No hay piezas por montar' },
];

function agrupar(lista) {
  const g = [];
  for (const x of lista) {
    let o = g.find((y) => y.id === x.obra_id);
    if (!o) g.push(o = { id: x.obra_id, nombre: x.obra_nombre, cliente: x.cliente, items: [] });
    o.items.push(x);
  }
  return g;
}

export default function Pendiente() {
  const { can, toastError } = useApp();
  const [params, setParams] = useSearchParams();
  const cuando = params.get('cuando') || 'semana';
  const fObra = params.get('obra') || '';
  const fEmp = params.get('empleado') || '';
  const tipo = params.get('ver') || 'tareas';
  const hoy = f.hoyISO();
  const R = rango(cuando, hoy);
  const set = (k, v, def = '') => { const p = new URLSearchParams(params); if (v && v !== def) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const { data, error, loading, reload } = useData(`/pendiente${qs({ desde: R.desde, hasta: R.hasta, obra_id: fObra, empleado_id: fEmp })}`);
  const { data: obras } = useData('/obras');
  const { data: empleados } = useData(can('personal.ver') ? '/empleados' : null);
  const [marcadas, setMarcadas] = useState({}); // id → true (hecho ahora; se queda tachado)

  const piezas = data?.piezas || [];
  const listas = useMemo(() => ({
    material: piezas.filter((p) => !p.material_recibido && !p.fecha_fabricacion),
    fabricar: piezas.filter((p) => !p.fecha_fabricacion),
    montar: piezas.filter((p) => p.fecha_fabricacion && !p.fecha_montaje),
  }), [data]);
  const etapas = (data?.etapas || []).map((e) => ({ ...e, estado: estadoEtapa(e) }));
  const nTareas = etapas.reduce((s, e) => s + Math.max(1, e.pendientes.length), 0);
  const cuenta = { tareas: nTareas, material: listas.material.length, fabricar: listas.fabricar.length, montar: listas.montar.length };
  const editar = can('obras.editar', 'fases.editar');
  const editarPiezas = can('piezas.editar');

  const marcarTarea = async (t) => {
    const si = !marcadas[`t${t.id}`];
    setMarcadas({ ...marcadas, [`t${t.id}`]: si });
    try { await put(`/etapas/tareas/${t.id}`, { hecha: si }); } catch (e) { setMarcadas({ ...marcadas, [`t${t.id}`]: !si }); toastError(e); }
  };
  const marcarPieza = async (p, campo) => {
    const k = `${campo}${p.id}`; const si = !marcadas[k];
    setMarcadas({ ...marcadas, [k]: si });
    try { await put(`/piezas/${p.id}`, { [campo]: si ? hoy : null }); } catch (e) { setMarcadas({ ...marcadas, [k]: !si }); toastError(e); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  const hayFiltro = fObra || fEmp || cuando !== 'semana';
  const T = TIPOS.find((x) => x.id === tipo) || TIPOS[0];
  const lista = tipo === 'tareas' ? null : listas[tipo];
  const empSel = (empleados || []).find((x) => String(x.id) === fEmp);


  return (
    <>
      <Cabecera icono={<IconoIniciales icon={ListChecks} color="" />} titulo="Pendiente" sub={R.txt}
        acciones={<a className="btn-mas" href={`/api/pendiente/pdf${qs({ ver: tipo, desde: R.desde, hasta: R.hasta, obra_id: fObra, empleado_id: fEmp, empleado_nombre: empSel?.nombre, periodo: R.txt })}`}
          target="_blank" rel="noopener" aria-label={`Descargar PDF: ${T.label}`} title="Descargar PDF"><FileDown size={19} /><span className="txt">PDF</span></a>} />

      <div className="filtros-semana mb">
        <Selector filtro titulo="¿Cuándo?" value={cuando} onChange={(v) => set('cuando', v, 'semana')} options={[
          { value: 'semana', label: 'Esta semana' }, { value: 'proxima', label: 'Próxima semana' }, { value: 'dos', label: 'Esta semana y la próxima' },
          { value: 'mes', label: 'Este mes' }, { value: 'todo', label: 'Todo lo pendiente', sub: 'Sin tener en cuenta las fechas' }]} />
        <Selector filtro titulo="Proyecto" value={fObra} onChange={(v) => set('obra', v)} placeholder="Todos los proyectos"
          options={[{ value: '', label: 'Todos los proyectos' }, ...(obras || []).filter((o) => ['planificada', 'en_curso', 'pausada'].includes(o.estado)).map((o) => ({ value: String(o.id), label: o.nombre, sub: o.cliente }))]} />
        {empleados && (
          <Selector filtro titulo="Empleado" value={fEmp} onChange={(v) => set('empleado', v)} placeholder="Todos los empleados"
            options={[{ value: '', label: 'Todos los empleados' }, ...empleados.filter((x) => x.activo).map((x) => ({ value: String(x.id), label: x.nombre, sub: x.obras.length ? x.obras.map((o) => o.nombre).join(' · ') : 'Sin proyecto asignado' }))]} />
        )}
        {hayFiltro && <button type="button" className="btn ghost sm" onClick={() => setParams(tipo !== 'tareas' ? { ver: tipo } : {}, { replace: true })}><X size={16} />Quitar filtros</button>}
      </div>
      {empSel && !empSel.obras.length && <div className="aviso-suave mb">{empSel.nombre} no está en el equipo de ningún proyecto. Añádelo desde la pestaña «Equipo» del proyecto.</div>}

      <div className="tipos-pend mb" role="tablist">
        {TIPOS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tipo === x.id} className={`tipo-pend ${tipo === x.id ? 'on' : ''}`} onClick={() => set('ver', x.id, 'tareas')}>
            <x.icon size={20} /><b>{data ? cuenta[x.id] : '·'}</b><span>{x.label}</span>
          </button>
        ))}
      </div>

      {loading && !data ? <Loading /> : tipo === 'tareas' ? (
        !etapas.length ? <div className="card"><Empty icon={CheckCircle2} title="No hay tareas pendientes">{hayFiltro ? 'Con los filtros elegidos.' : 'Todas las fases de esta semana están terminadas.'}</Empty></div> : (
          <div className="stack">
            {agrupar(etapas).map((g) => (
              <div key={g.id} className="card pad0">
                <Link to={`/obras/${g.id}`} className="grupo-obra-cab">
                  <AvatarCliente nombre={g.cliente || g.nombre} size={34} />
                  <span className="grow" style={{ minWidth: 0 }}><b>{g.nombre}</b><small>{g.cliente}</small></span>
                  <ChevronRight size={18} className="muted" />
                </Link>
                {g.items.map((e) => (
                  <div key={e.id} className="pend-fase">
                    <Link to={`/obras/${e.obra_id}/fases/${e.id}`} className="pend-fase-cab">
                      <span className="pend-barra" style={pastelObra(e.obra_nombre)} />
                      <span className="grow" style={{ minWidth: 0 }}><b>{e.nombre}</b><small>{f.fecha(e.fecha_inicio)} → {f.fecha(e.fecha_fin)}</small></span>
                      <Status estado={e.estado} small />
                    </Link>
                    {e.pendientes.length ? (
                      <div className="pend-tareas">
                        {e.pendientes.map((t) => (
                          <button key={t.id} type="button" className={`pend-tarea ${marcadas[`t${t.id}`] ? 'hecha' : ''}`} disabled={!editar} onClick={() => marcarTarea(t)}>
                            {marcadas[`t${t.id}`] ? <CheckCircle2 size={22} /> : <Circle size={22} />}<span>{t.texto}</span>
                          </button>
                        ))}
                      </div>
                    ) : <div className="pend-vacia">Sin tareas pendientes: falta confirmar la fase como terminada.</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      ) : !lista.length ? <div className="card"><Empty icon={T.icon} title={T.vacio}>{hayFiltro ? 'Con los filtros elegidos.' : cuando !== 'todo' ? 'Solo se cuentan las piezas asignadas a fases de estas fechas. Prueba «Todo lo pendiente».' : ''}</Empty></div> : (
        <>
          <p className="small muted" style={{ margin: '0 4px 10px' }}>
            {f.plural(lista.length, 'pieza')} · {f.num(lista.reduce((s, p) => s + p.cantidad, 0))} unidades · <b>{f.kg(lista.reduce((s, p) => s + p.kg, 0))}</b>
          </p>
          <div className="stack">
            {agrupar(lista).map((g) => (
              <div key={g.id} className="card pad0">
                <Link to={`/obras/${g.id}`} className="grupo-obra-cab">
                  <AvatarCliente nombre={g.cliente || g.nombre} size={34} />
                  <span className="grow" style={{ minWidth: 0 }}><b>{g.nombre}</b><small>{f.plural(g.items.length, 'pieza')} · {f.kg(g.items.reduce((s, p) => s + p.kg, 0))}</small></span>
                  <ChevronRight size={18} className="muted" />
                </Link>
                {g.items.map((p) => {
                  const hecho = marcadas[`${T.campo}${p.id}`];
                  return (
                    <div key={p.id} className={`pend-pieza ${hecho ? 'hecha' : ''}`}>
                      <IconoPieza familia={p.familia || 'propia'} size={40} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <b><span className="marca">{p.marca}</span> · {p.catalogo_nombre || p.perfil || 'Pieza'}</b>
                        <small>{p.cantidad} ud{p.ml_unitario ? ` × ${f.num(p.ml_unitario, 2)} m` : ''} · {f.kg(p.kg)}{p.etapa_nombre ? ` · ${p.etapa_nombre}` : ' · sin fase'}</small>
                      </span>
                      {editarPiezas && (
                        <button type="button" className={`btn sm ${hecho ? 'ok' : ''}`} onClick={() => marcarPieza(p, T.campo)} aria-pressed={!!hecho}>
                          {hecho ? <CheckCircle2 size={16} /> : <Circle size={16} />}{T.boton}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
