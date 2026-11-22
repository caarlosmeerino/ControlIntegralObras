import { useState } from 'react';
import { Navigation, Map as MapIcon, ExternalLink, Copy, MapPin } from 'lucide-react';
import { Sheet, ActionSheet } from './ui.jsx';
import { useApp } from '../lib/app.jsx';
import * as f from '../lib/format.js';

export const textoDireccion = (o) => [o.direccion, [o.codigo_postal, o.ciudad].filter(Boolean).join(' '), o.provincia && o.provincia !== o.ciudad ? o.provincia : ''].filter(Boolean).join(', ');
const hayCoords = (o) => o.lat != null && o.lng != null && o.lat !== '' && o.lng !== '';

/** Mapa de Google incrustado (sin clave) para comprobar el punto exacto */
export function urlMapaIncrustado(o) {
  const q = hayCoords(o) ? `${o.lat},${o.lng}` : `${textoDireccion(o)}, España`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${hayCoords(o) ? 17 : 15}&hl=es&output=embed`;
}

/** Tarjeta con el mapa y los botones de ruta */
export function MapaSheet({ obra, titulo, onClose }) {
  return (
    <Sheet title={titulo || 'Ubicación'} onClose={onClose} wide
      footer={<>
        <a className="btn" href={f.mapsUrl(obra)} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} />Abrir en Google Maps</a>
        <a className="btn primary" href={f.rutaUrl(obra)} target="_blank" rel="noopener noreferrer"><Navigation size={17} />Cómo llegar</a>
      </>}>
      <div className="mapa-dir"><MapPin size={16} /><span>{textoDireccion(obra) || 'Sin dirección'}</span></div>
      {!hayCoords(obra) && <div className="xs muted mb-s">Sin coordenadas exactas: el mapa busca por el texto de la dirección. Elige la dirección del buscador para fijar el punto exacto.</div>}
      <div className="mapa-marco">
        <iframe title="Mapa de Google" src={urlMapaIncrustado(obra)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      </div>
    </Sheet>
  );
}

/**
 * Dirección pulsable: al tocarla salen «Cómo llegar», «Ver en el mapa», «Abrir en Google Maps» y «Copiar».
 * children = lo que se muestra (texto de la dirección, un botón…)
 */
export function DireccionPulsable({ obra, titulo, className = 'enlace-mapa', children, ariaLabel }) {
  const { toast } = useApp();
  const [menu, setMenu] = useState(false);
  const [mapa, setMapa] = useState(false);
  const abrir = (url) => window.open(url, '_blank', 'noopener');
  const copiar = async () => {
    try { await navigator.clipboard.writeText(textoDireccion(obra)); toast('Dirección copiada.'); } catch { toast(textoDireccion(obra)); }
  };
  return (
    <>
      <button type="button" className={className} onClick={() => setMenu(true)} aria-haspopup="dialog" aria-label={ariaLabel}>{children}</button>
      {menu && (
        <ActionSheet onClose={() => setMenu(false)} titulo={textoDireccion(obra)} opciones={[
          { value: 'ruta', label: 'Cómo llegar', sub: 'Ruta desde donde estás en Google Maps', icon: Navigation, onClick: () => abrir(f.rutaUrl(obra)) },
          { value: 'mapa', label: 'Ver en el mapa', sub: 'Comprobar el punto exacto', icon: MapIcon, onClick: () => setMapa(true) },
          { value: 'maps', label: 'Abrir en Google Maps', icon: ExternalLink, onClick: () => abrir(f.mapsUrl(obra)) },
          { value: 'copiar', label: 'Copiar dirección', icon: Copy, onClick: copiar },
        ]} />
      )}
      {mapa && <MapaSheet obra={obra} titulo={titulo} onClose={() => setMapa(false)} />}
    </>
  );
}
