import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Undo2, ArrowRight } from 'lucide-react';
import { Sheet, Stepper, Field, Seg } from './ui.jsx';
import { useApp } from '../lib/app.jsx';
import { get, registrarAvance } from '../lib/api.js';
import * as f from '../lib/format.js';

const PERM = { oficina: 'avance.oficina', taller: 'avance.taller', obra: 'avance.obra' };

let cacheTrab = null;
async function trabajadores() {
  if (!cacheTrab) cacheTrab = get('/personal/trabajadores').catch(() => []);
  return cacheTrab;
}

/** Hoja para registrar el avance de una pieza: por defecto completa todas las unidades disponibles de su fase actual. */
export function AvanceSheet({ pieza, onClose, onDone, origen = 'web' }) {
  const { user, can, toast, toastError } = useApp();
  const [modo, setModo] = useState('avanzar');
  // Fases con unidades esperando (puede haber varias si la marca avanza por partes)
  const abiertas = pieza.avance.filter((a) => a.disponibles > 0);
  const [faseSel, setFaseSel] = useState(() => (abiertas.find((a) => can(PERM[a.ambito])) || abiertas[0])?.fase_id);
  const fase = abiertas.find((a) => a.fase_id === faseSel);
  const disp = fase?.disponibles || 0;
  const [cant, setCant] = useState(Math.max(1, disp));
  const [nota, setNota] = useState('');
  const [trab, setTrab] = useState(user.trabajador?.id || '');
  const [lista, setLista] = useState([]);
  const [faseCorr, setFaseCorr] = useState(() => [...pieza.avance].reverse().find((a) => a.completadas > 0)?.fase_id || '');
  const [busy, setBusy] = useState(false);
  const puede = fase && can(PERM[fase.ambito]);
  const puedeCorregir = can('avance.corregir', 'avance.obra');
  useEffect(() => { trabajadores().then(setLista); }, []);
  const idxCorr = pieza.avance.findIndex((a) => a.fase_id === Number(faseCorr));
  const maxCorr = idxCorr >= 0 ? pieza.avance[idxCorr].completadas - (pieza.avance[idxCorr + 1]?.completadas || 0) : 0;

  const enviar = async () => {
    setBusy(true);
    try {
      const body = modo === 'avanzar'
        ? { fase_id: faseSel, cantidad: cant, nota, trabajador_id: trab || null, origen }
        : { fase_id: Number(faseCorr), cantidad: -cant, nota: nota || 'Corrección', trabajador_id: null, origen };
      const r = await registrarAvance(pieza.id, body, pieza.marca);
      toast(r.mensaje, r.encolado ? 'info' : 'ok');
      onDone?.(r.pieza);
      onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  const seccionFase = fase?.clave;
  const candidatos = lista.filter((t) => !seccionFase || t.operaciones?.includes(seccionFase) || t.id === user.trabajador?.id);

  return (
    <Sheet title={<span>Registrar avance · <span className="marca">{pieza.marca}</span></span>} onClose={onClose}
      footer={<>
        <button className="btn big" onClick={onClose}>Cancelar</button>
        {modo === 'avanzar'
          ? <button className="btn big ok" disabled={busy || !puede || disp < 1} onClick={enviar}><CheckCircle2 />Confirmar {cant} ud · {f.t(cant * pieza.peso_unitario_kg)}</button>
          : <button className="btn big danger solid" disabled={busy || maxCorr < 1} onClick={enviar}><Undo2 />Quitar {cant} ud</button>}
      </>}>
      <div className="stack">
        <div className="small muted">{pieza.obra_codigo} · {f.ELEMENTOS[pieza.elemento]} {pieza.perfil} · {pieza.cantidad} ud × {f.kg(pieza.peso_unitario_kg)}</div>
        {puedeCorregir && <Seg value={modo} onChange={(m) => { setModo(m); setCant(1); }} options={[['avanzar', 'Avanzar'], ['corregir', 'Corregir error']]} />}
        {modo === 'avanzar' ? (
          <>
            {!abiertas.length ? <div className="banner ok"><CheckCircle2 />Esta pieza ha completado todas las fases.</div> : (
              <div className="card flat" style={{ background: 'var(--surface-2)' }}>
                <div className="label">Fase a completar</div>
                {abiertas.length > 1 && (
                  <div className="chips mt-s">{abiertas.map((a) => <button key={a.fase_id} type="button" className={`chip ${a.fase_id === faseSel ? 'on' : ''}`} onClick={() => { setFaseSel(a.fase_id); setCant(a.disponibles); }}>{a.orden}. {a.nombre} · {a.disponibles} ud</button>)}</div>
                )}
                <div className="row mt-s" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  <span className="phase-n warn">{fase?.orden}</span>{fase?.nombre}
                </div>
                <div className="small muted mt-s">{disp} de {pieza.cantidad} unidad(es) disponibles en esta fase · {fase?.completadas} ya completada(s)</div>
                {!puede && <div className="banner bad mt">Tu perfil no puede registrar avances en esta fase ({f.AMBITOS[fase?.ambito]}).</div>}
              </div>
            )}
            {disp > 1 && <Field label="Unidades completadas"><Stepper value={cant} onChange={setCant} min={1} max={disp} /></Field>}
            {candidatos.length > 0 && (
              <Field label="Realizado por" hint="Sirve para calcular el rendimiento de cada trabajador.">
                <select className="input" value={trab} onChange={(e) => setTrab(e.target.value)}>
                  <option value="">— Sin indicar —</option>
                  {candidatos.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {f.SECCIONES[t.seccion]}</option>)}
                </select>
              </Field>
            )}
          </>
        ) : (
          <>
            <div className="banner">Usa esta opción solo para corregir un error de registro. Queda anotado en el historial.</div>
            <Field label="Fase a corregir">
              <select className="input" value={faseCorr} onChange={(e) => { setFaseCorr(e.target.value); setCant(1); }}>
                {pieza.avance.filter((a) => a.completadas > 0).map((a) => <option key={a.fase_id} value={a.fase_id}>{a.orden}. {a.nombre} ({a.completadas} completadas)</option>)}
              </select>
            </Field>
            {maxCorr < 1 ? <div className="banner bad">No se puede corregir esta fase: hay unidades en la fase siguiente. Corrige primero la última fase.</div>
              : <Field label="Unidades a quitar"><Stepper value={cant} onChange={setCant} min={1} max={maxCorr} /></Field>}
          </>
        )}
        <Field label="Observación (opcional)"><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: soldadura revisada por calidad" maxLength={300} /></Field>
      </div>
    </Sheet>
  );
}

/** Botón grande de avance para tarjetas y fichas */
export function BotonAvance({ pieza, onClick, block }) {
  if (!pieza.fase_actual_id) return <span className="badge ok"><CheckCircle2 size={15} />Completada</span>;
  const abiertas = pieza.avance.filter((a) => a.disponibles > 0);
  return (
    <button className={`btn primary ${block ? 'block big' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(pieza); }} disabled={!abiertas.length}>
      <ArrowRight size={20} />{block ? (abiertas.length > 1 ? 'Registrar avance' : `Completar ${abiertas[0]?.nombre || pieza.fase_actual_nombre}`) : 'Avanzar'}
    </button>
  );
}

/** Lector de QR con la cámara (BarcodeDetector si existe; si no, jsQR) */
export function QrScanner({ onCode }) {
  const video = useRef(); const canvas = useRef();
  const [error, setError] = useState(null);
  useEffect(() => {
    let stream, raf, stop = false, detector;
    (async () => {
      try {
        if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch { detector = null; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stop) return;
          const v = video.current;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            let code = null;
            if (detector) { try { const r = await detector.detect(v); code = r[0]?.rawValue; } catch { detector = null; } }
            else {
              const jsQR = (await import('jsqr')).default;
              const c = canvas.current; const w = 480; const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
              c.width = w; c.height = h; const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, w, h);
              code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data;
            }
            if (code) { if (navigator.vibrate) navigator.vibrate(80); stop = true; onCode(code); return; }
          }
          raf = setTimeout(tick, 160);
        };
        tick();
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Necesitamos permiso para usar la cámara. Actívalo en los ajustes del navegador.' : 'No se ha podido abrir la cámara de este dispositivo.');
      }
    })();
    return () => { stop = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  if (error) return <div className="banner bad">{error}</div>;
  return (
    <div className="video-wrap">
      <video ref={video} playsInline muted />
      <div className="video-frame" />
      <canvas ref={canvas} hidden />
    </div>
  );
}
