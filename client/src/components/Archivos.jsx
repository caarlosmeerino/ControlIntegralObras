import { useRef, useState } from 'react';
import { Camera, Paperclip, FileText, Trash2, Download, Image as ImageIcon } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { api, del, qs } from '../lib/api.js';
import { Loading, Empty, Sheet } from './ui.jsx';
import * as f from '../lib/format.js';

const url = (a, d) => `/api/archivos/${a.id}/contenido${d ? '?descargar=1' : ''}`;

/** Reduce fotos grandes antes de subirlas (ahorra datos en obra) */
async function comprimir(file) {
  if (!file.type.startsWith('image/') || file.size < 600 * 1024 || /heic|heif|gif/.test(file.type)) return file;
  try {
    const img = await createImageBitmap(file);
    const s = Math.min(1, 1920 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

export function Subir({ entidad, entidadId, tipo, onDone, label = 'Añadir foto', camera = true }) {
  const { toast, toastError, can } = useApp();
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  if (!can('archivos.subir')) return null;
  const subir = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('entidad', entidad); fd.append('entidad_id', entidadId); if (tipo) fd.append('tipo', tipo);
      for (const fl of files) fd.append('archivos', await comprimir(fl));
      const r = await api('/archivos', { method: 'POST', form: fd });
      toast(r.mensaje); onDone?.();
    } catch (e) { toastError(e); } finally { setBusy(false); ref.current.value = ''; }
  };
  return (
    <>
      <input ref={ref} type="file" hidden multiple accept={camera ? 'image/*' : undefined} capture={camera ? 'environment' : undefined} onChange={(e) => subir(e.target.files)} />
      <button className="btn" disabled={busy} onClick={() => ref.current.click()}>{camera ? <Camera size={20} /> : <Paperclip size={20} />}{busy ? 'Subiendo…' : label}</button>
    </>
  );
}

export function Galeria({ archivos, onDelete }) {
  const [ver, setVer] = useState(null);
  const fotos = archivos.filter((a) => a.mime.startsWith('image/'));
  const docs = archivos.filter((a) => !a.mime.startsWith('image/'));
  const { can, user, toast, toastError } = useApp();
  const borrar = async (a) => {
    if (!confirm(`¿Eliminar «${a.nombre}»?`)) return;
    try { await del(`/archivos/${a.id}`); toast('Archivo eliminado.'); setVer(null); onDelete?.(); } catch (e) { toastError(e); }
  };
  return (
    <>
      {fotos.length > 0 && <div className="photos mb">{fotos.map((a) => <button key={a.id} className="photo" onClick={() => setVer(a)} style={{ padding: 0, cursor: 'zoom-in' }} aria-label={a.nombre}><img src={url(a)} alt={a.descripcion || a.nombre} loading="lazy" /></button>)}</div>}
      {docs.map((a) => (
        <div key={a.id} className="file-row">
          <FileText size={22} className="muted" />
          <div className="grow"><a href={url(a)} target="_blank" rel="noreferrer" className="strong">{a.nombre}</a>
            <div className="xs muted">{a.tipo === 'plano' ? 'Plano' : 'Documento'}{a.marca ? ` · ${a.marca}` : ''} · {f.tamano(a.tamano)} · {a.usuario || ''} · {f.fecha(a.creado_en)}</div></div>
          <a className="btn ghost icon" href={url(a, true)} aria-label="Descargar"><Download size={20} /></a>
          {(can('obras.editar') || a.usuario_id === user.id) && <button className="btn ghost icon danger" onClick={() => borrar(a)} aria-label="Eliminar"><Trash2 size={20} /></button>}
        </div>
      ))}
      {!archivos.length && <Empty icon={ImageIcon} title="Sin fotos ni documentos" />}
      {ver && (
        <Sheet title={ver.nombre} onClose={() => setVer(null)} wide footer={<>
          {(can('obras.editar') || ver.usuario_id === user.id) && <button className="btn danger" onClick={() => borrar(ver)}><Trash2 size={18} />Eliminar</button>}
          <a className="btn" href={url(ver, true)}><Download size={18} />Descargar</a></>}>
          <img src={url(ver)} alt={ver.nombre} style={{ width: '100%', borderRadius: 12 }} />
          <div className="small muted mt-s">{ver.marca ? `${ver.marca} · ` : ''}{ver.usuario} · {f.fechaHora(ver.creado_en)}</div>
        </Sheet>
      )}
    </>
  );
}

export function ArchivosObra({ obraId }) {
  const { data, loading, reload } = useData(`/archivos${qs({ obra_id: obraId })}`);
  if (loading && !data) return <Loading />;
  const planos = data.filter((a) => a.tipo === 'plano');
  const docs = data.filter((a) => a.tipo === 'documento');
  const fotos = data.filter((a) => a.tipo === 'foto');
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div><h2>Planos</h2><p>Planos de proyecto y de taller</p></div><Subir entidad="obra" entidadId={obraId} tipo="plano" camera={false} label="Subir planos" onDone={reload} /></div>
        <Galeria archivos={planos} onDelete={reload} />
      </div>
      <div className="card">
        <div className="card-head"><div><h2>Documentación</h2><p>Certificados, albaranes, calidad, contratos…</p></div><Subir entidad="obra" entidadId={obraId} tipo="documento" camera={false} label="Subir documentos" onDone={reload} /></div>
        <Galeria archivos={docs} onDelete={reload} />
      </div>
      <div className="card">
        <div className="card-head"><div><h2>Fotografías</h2><p>De la obra, de piezas y de partes de montaje</p></div><Subir entidad="obra" entidadId={obraId} onDone={reload} /></div>
        <Galeria archivos={fotos} onDelete={reload} />
      </div>
    </div>
  );
}
