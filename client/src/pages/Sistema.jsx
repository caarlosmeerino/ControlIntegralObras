import { Database, Download, HardDrive, ShieldCheck } from 'lucide-react';
import { useApp, useData } from '../lib/app.jsx';
import { post } from '../lib/api.js';
import { Loading, ErrorBox, Kpi, Empty, BotonMas } from '../components/ui.jsx';
import * as f from '../lib/format.js';

export default function Sistema() {
  const { toast, toastError } = useApp();
  const { data, error, loading, reload } = useData('/sistema/estado');
  const hist = useData('/sistema/historial');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const backup = async () => { try { const r = await post('/sistema/backup'); toast(r.mensaje); reload(); } catch (e) { toastError(e); } };
  return (
    <>
      <div className="page-head"><div><h1>Copias de seguridad</h1></div>
        <BotonMas texto="Hacer copia ahora" icon={Database} onClick={backup} /></div>
      <div className="grid g4 mb">
        <Kpi icon={Database} label="Base de datos" value={data.db.tamano} sub="PostgreSQL" />
        <Kpi icon={HardDrive} label="Almacenamiento" value={data.almacenamiento === 's3' ? 'S3 / Bucket' : 'Volumen'} tone="idle" sub={`${data.cuentas.archivos} archivos`} />
        <Kpi icon={ShieldCheck} label="Copias automáticas" value={data.backup_cron ? 'Activas' : 'Desactivadas'} tone={data.backup_cron ? 'ok' : 'bad'} sub={data.backup_cron ? `cron «${data.backup_cron}» · se guardan ${data.conservar}` : ''} />
        <Kpi label="Registros" value={f.num(data.cuentas.movimientos)} tone="idle" sub={`${data.cuentas.obras} obras · ${data.cuentas.piezas} piezas · ${data.cuentas.usuarios} usuarios`} />
      </div>
      <div className="grid g2">
        <div className="card"><h2 className="mb">Copias de seguridad</h2>
          {data.backups.length ? data.backups.map((b) => <div key={b.id} className="file-row"><Database size={20} className="muted" /><span className="grow small mono">{b.nombre}</span><span className="xs muted">{f.tamano(b.tamano)}</span><a className="btn ghost icon" href={`/api/archivos/${b.id}/contenido?descargar=1`} aria-label="Descargar"><Download size={20} /></a></div>)
            : <Empty title="Todavía no hay copias" />}
          <div className="hint mt">Restaurar: <span className="mono">npm run restaurar -- archivo.json.gz</span> sobre una base de datos vacía (ver README).</div>
        </div>
        <div className="card"><h2 className="mb">Registro de cambios (últimos 300)</h2>
          {!hist.data ? <Loading /> : <ul className="timeline" style={{ maxHeight: 520, overflowY: 'auto' }}>{hist.data.map((h) => <li key={h.id}><span className="dot" style={{ background: 'var(--primary)' }} /><div><div className="small">{h.obra && <span className="code">{h.obra}</span>} {h.detalle}</div><div className="xs muted">{f.fechaHora(h.fecha)} · {h.usuario || 'Sistema'} · {h.entidad}/{h.accion}</div></div></li>)}</ul>}
        </div>
      </div>
    </>
  );
}
