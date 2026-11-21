import { useEffect, useState } from 'react';
import { Plus, Cloud, FolderOpen, FileText, MoreHorizontal, ExternalLink, Pencil, Trash2, ClipboardPaste, Link2 } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post, put, del, qs } from '../lib/api.js';
import { Loading, Sheet, Field, ActionSheet, Empty } from './ui.jsx';
import * as f from '../lib/format.js';

const TXT = {
  plano: { titulo: 'Planos', uno: 'plano', vacio: 'Todavía no hay planos enlazados', ej: 'Ej.: Planos de taller' },
  documento: { titulo: 'Documentos', uno: 'documento', vacio: 'Todavía no hay documentos enlazados', ej: 'Ej.: Certificados de calidad' },
};

const esICloud = (url) => /(^|\.)icloud\.com$/i.test(new URL(url).hostname);
const esCarpeta = (url) => /\/iclouddrive\/[^#]*$/i.test(url) || /folder|carpeta/i.test(url);
const ESPERA = 'cio-esperando-icloud';
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Abre la app Archivos (iPhone/iPad) o iCloud Drive en el navegador */
function abrirICloud(obraId, tipo) {
  try { sessionStorage.setItem(ESPERA, JSON.stringify({ obraId, tipo, t: Date.now() })); } catch { /* sin almacenamiento */ }
  if (esIOS()) window.location.href = 'shareddocuments://';
  else window.open('https://www.icloud.com/iclouddrive/', '_blank', 'noopener');
}
const leerEspera = () => { try { const v = JSON.parse(sessionStorage.getItem(ESPERA) || 'null'); return v && Date.now() - v.t < 30 * 60 * 1000 ? v : null; } catch { return null; } };
const olvidarEspera = () => { try { sessionStorage.removeItem(ESPERA); } catch { /* */ } };
const origen = (url) => { try { return esICloud(url) ? 'iCloud Drive' : new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function Formulario({ obraId, tipo, enlace, onClose, onSaved }) {
  const { toast, toastError } = useApp();
  const [url, setUrl] = useState(enlace?.url || '');
  const [nombre, setNombre] = useState(enlace?.nombre || '');
  const [busy, setBusy] = useState(false);
  const pegar = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setUrl(t.trim()); } catch { toastError(new Error('No se ha podido leer el portapapeles. Mantén pulsado el campo y elige «Pegar».')); }
  };
  const guardar = async () => {
    setBusy(true);
    try {
      const body = { obra_id: obraId, tipo, url: url.trim(), nombre: nombre.trim() };
      if (enlace) await put(`/enlaces/${enlace.id}`, body); else await post('/enlaces', body);
      toast(enlace ? 'Enlace actualizado.' : `${TXT[tipo].uno[0].toUpperCase()}${TXT[tipo].uno.slice(1)} enlazado.`);
      onSaved(); onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Sheet title={enlace ? 'Editar enlace' : `Enlazar ${TXT[tipo].uno}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !url.trim()} onClick={guardar}>Guardar</button></>}>
      <div className="stack">
        {!enlace && (
          <div className="pasos-icloud">
            <div className="row" style={{ gap: 10 }}><span className="icono-nube"><Cloud size={18} /></span><b>Cómo copiar el enlace en iCloud</b></div>
            <ol>
              <li>En iCloud, mantén pulsado el archivo o la carpeta → <b>Compartir</b> → <b>Copiar enlace</b>.</li>
              <li>Pega el enlace aquí abajo.</li>
            </ol>
          </div>
        )}
        <Field label="Enlace">
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.icloud.com/iclouddrive/…" inputMode="url" autoCapitalize="none" autoCorrect="off" />
            {navigator.clipboard?.readText && <button type="button" className="btn icon" onClick={pegar} aria-label="Pegar enlace" title="Pegar"><ClipboardPaste size={20} /></button>}
          </div>
        </Field>
        <Field label="Nombre" hint="Si lo dejas vacío se usa el nombre del archivo de iCloud."><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={TXT[tipo].ej} /></Field>
      </div>
    </Sheet>
  );
}

/** Tarjeta que aparece al volver de iCloud: añade con un toque el enlace copiado */
function AlVolver({ obraId, tipo, onClose, onSaved, onManual }) {
  const { toast, toastError } = useApp();
  const [busy, setBusy] = useState(false);
  const pegar = async () => {
    setBusy(true);
    try {
      const texto = (await navigator.clipboard.readText()).trim();
      const url = (texto.match(/https:\/\/\S+/) || [])[0];
      if (!url) { toastError(new Error('No hay ningún enlace copiado. En iCloud usa «Compartir → Copiar enlace» y vuelve a intentarlo.')); return; }
      const r = await post('/enlaces', { obra_id: obraId, tipo, url });
      toast(`«${r.nombre}» enlazado.`); olvidarEspera(); onSaved(); onClose();
    } catch (e) {
      if (e?.name === 'NotAllowedError') { olvidarEspera(); onClose(); onManual(); } else toastError(e);
    } finally { setBusy(false); }
  };
  return (
    <ActionSheet onClose={() => { olvidarEspera(); onClose(); }}
      titulo={<div className="cuenta-cab"><span className="icono-nube grande"><Cloud size={28} /></span><b>¿Has copiado el enlace en iCloud?</b><span>Añádelo con un toque</span></div>}
      opciones={[
        { value: 'pegar', label: busy ? 'Añadiendo…' : 'Añadir lo que has copiado', icon: ClipboardPaste, onClick: pegar },
        { value: 'otra', label: 'Volver a iCloud', icon: Cloud, onClick: () => abrirICloud(obraId, tipo) },
        { value: 'manual', label: 'Escribir el enlace a mano', icon: Link2, onClick: () => { olvidarEspera(); onManual(); } },
      ]} />
  );
}

/** Lista de planos o documentos enlazados desde iCloud (no se sube ningún archivo) */
export default function Enlaces({ obraId, tipo }) {
  const { can, toast, toastError } = useApp();
  const { data, loading, reload } = useData(`/enlaces${qs({ obra_id: obraId, tipo })}`);
  const [form, setForm] = useState(null);
  const [menu, setMenu] = useState(null);
  const [volver, setVolver] = useState(false);
  const t = TXT[tipo];
  useEffect(() => {
    // Al volver a la app desde iCloud, ofrecer añadir el enlace copiado
    const comprobar = () => { const v = leerEspera(); if (document.visibilityState === 'visible' && v && v.obraId === obraId && v.tipo === tipo) setVolver(true); };
    comprobar();
    document.addEventListener('visibilitychange', comprobar); window.addEventListener('focus', comprobar);
    return () => { document.removeEventListener('visibilitychange', comprobar); window.removeEventListener('focus', comprobar); };
  }, [obraId, tipo]);
  if (loading && !data) return <Loading />;
  const borrar = async (e) => {
    if (!confirm(`¿Quitar el enlace «${e.nombre}»? El archivo de iCloud no se borra.`)) return;
    try { await del(`/enlaces/${e.id}`); toast('Enlace quitado.'); reload(); } catch (er) { toastError(er); }
  };
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div><h2>{t.titulo}</h2><p>Enlaces a iCloud Drive: los archivos siguen en tu iCloud y siempre se abre la última versión.</p></div>
          {can('archivos.subir') && (
            <div className="btn-row">
              <button className="btn primary" onClick={() => abrirICloud(obraId, tipo)}><Cloud size={18} />Elegir en iCloud</button>
              <button className="btn" onClick={() => setForm({})}><Plus size={18} />Pegar enlace</button>
            </div>
          )}
        </div>
        {!data?.length ? <Empty icon={Cloud} title={t.vacio}>Enlaza un archivo o una carpeta entera de iCloud.</Empty> : (
          <div className="lista lista-plana">
            {data.map((e) => {
              const I = esCarpeta(e.url) ? FolderOpen : FileText;
              return (
                <div key={e.id} className="lista-fila enlace-fila">
                  <a className="row grow" style={{ gap: 14, color: 'var(--text)', minWidth: 0 }} href={e.url} target="_blank" rel="noopener noreferrer">
                    <span className={`icono-doc ${tipo}`}><I size={20} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="lista-titulo" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</span>
                      <span className="lista-sub"><Cloud size={13} style={{ verticalAlign: -2 }} /> {origen(e.url)} · {f.fecha(e.creado_en)}</span>
                    </span>
                    <ExternalLink size={18} className="muted" />
                  </a>
                  {can('archivos.subir') && <button className="btn ghost icon" onClick={() => setMenu(e)} aria-label={`Opciones de ${e.nombre}`}><MoreHorizontal size={20} /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {volver && <AlVolver obraId={obraId} tipo={tipo} onClose={() => setVolver(false)} onSaved={reload} onManual={() => setForm({})} />}
      {form && <Formulario obraId={obraId} tipo={tipo} enlace={form.id ? form : null} onClose={() => setForm(null)} onSaved={reload} />}
      {menu && (
        <ActionSheet titulo={menu.nombre} onClose={() => setMenu(null)} opciones={[
          { value: 'abrir', label: 'Abrir en iCloud', icon: ExternalLink, onClick: () => window.open(menu.url, '_blank', 'noopener') },
          { value: 'editar', label: 'Cambiar nombre o enlace', icon: Pencil, onClick: () => setForm(menu) },
          { value: 'quitar', label: 'Quitar enlace', icon: Trash2, danger: true, onClick: () => borrar(menu) },
        ]} />
      )}
    </div>
  );
}
