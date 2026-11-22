// Icono con la sección real de cada tipo de pieza (vigas I/H, U, angulares, tubos, chapas, tornillería…)
export const FAMILIAS = {
  ipe: 'IPE', ipn: 'IPN', hea: 'HEA', heb: 'HEB', hem: 'HEM', upn: 'UPN', upe: 'UPE', t: 'Perfil T',
  l: 'Angular L', lu: 'Angular L desigual', shs: 'Tubo cuadrado', rhs: 'Tubo rectangular', chs: 'Tubo redondo',
  redondo: 'Redondo macizo', cuadrado: 'Cuadrado macizo', pletina: 'Pletina', chapa: 'Chapa', lagrimada: 'Chapa lagrimada',
  grecada: 'Chapa grecada', tramex: 'Rejilla tramex', corrugado: 'Corrugado', malla: 'Mallazo', correa_c: 'Correa C',
  correa_z: 'Correa Z', omega: 'Omega', placa: 'Placa de anclaje', perno: 'Tornillería y pernos', varilla: 'Varilla roscada', propia: 'Pieza propia',
};
export const GRUPOS = [
  ['Vigas y pilares', ['ipe', 'ipn', 'hea', 'heb', 'hem', 'upn', 'upe', 't']],
  ['Angulares', ['l', 'lu']],
  ['Tubos', ['shs', 'rhs', 'chs']],
  ['Barras y pletinas', ['redondo', 'cuadrado', 'pletina']],
  ['Chapas', ['chapa', 'lagrimada', 'grecada', 'tramex']],
  ['Conformados', ['correa_c', 'correa_z', 'omega']],
  ['Armaduras', ['corrugado', 'malla']],
  ['Uniones', ['placa', 'perno', 'varilla']],
];
export const UNIDAD = { m: 'kg/m', m2: 'kg/m²', ud: 'kg/ud' };

// Proporciones (ancho de ala relativo) para distinguir IPE, HEA, HEB…
const ALA = { ipe: 0.5, ipn: 0.42, hea: 0.96, heb: 1, hem: 1, t: 1 };

function Seccion({ f }) {
  const st = { fill: 'currentColor' };
  if (['ipe', 'ipn', 'hea', 'heb', 'hem'].includes(f)) {
    const b = 26 * ALA[f]; const tf = f === 'hem' ? 6 : f === 'heb' ? 5 : 4; const tw = f === 'hem' ? 5 : 3.5;
    return <path {...st} d={`M${20 - b / 2} 6h${b}v${tf}h${-(b - tw) / 2}v${28 - 2 * tf}h${(b - tw) / 2}v${tf}h${-b}v${-tf}h${(b - tw) / 2}v${-(28 - 2 * tf)}h${-(b - tw) / 2}z`} />;
  }
  switch (f) {
    case 't': return <path {...st} d="M7 8h26v5H22.5v19h-5V13H7z" />;
    case 'upn': case 'upe': return <path {...st} d="M10 6h16v5H15v18h11v5H10z" />;
    case 'correa_c': return <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="M27 11V7H12v26h15v-4" />;
    case 'correa_z': return <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="M8 10V7h12v26h12v-3" />;
    case 'omega': return <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="M4 30h8V12h16v18h8" />;
    case 'l': return <path {...st} d="M10 6h5v23h18v5H10z" />;
    case 'lu': return <path {...st} d="M12 4h5v25h12v5H12z" />;
    case 'shs': return <path {...st} fillRule="evenodd" d="M8 8h24v24H8zM12 12v16h16V12z" />;
    case 'rhs': return <path {...st} fillRule="evenodd" d="M6 11h28v18H6zM10 15v10h20V15z" />;
    case 'chs': return <path {...st} fillRule="evenodd" d="M20 6a14 14 0 1 1 0 28a14 14 0 1 1 0-28zm0 4a10 10 0 1 0 0 20a10 10 0 1 0 0-20z" />;
    case 'redondo': return <circle {...st} cx="20" cy="20" r="12" />;
    case 'cuadrado': return <rect {...st} x="9" y="9" width="22" height="22" rx="1" />;
    case 'pletina': return <rect {...st} x="5" y="16" width="30" height="8" rx="1" />;
    case 'chapa': return <path {...st} d="M4 26l10-10h22l-10 10z" />;
    case 'lagrimada': return <g><path {...st} d="M4 26l10-10h22l-10 10z" /><g fill="var(--surface)"><ellipse cx="13" cy="22" rx="2" ry=".8" transform="rotate(-30 13 22)" /><ellipse cx="20" cy="20" rx="2" ry=".8" transform="rotate(30 20 20)" /><ellipse cx="26" cy="22" rx="2" ry=".8" transform="rotate(-30 26 22)" /><ellipse cx="25" cy="18" rx="2" ry=".8" transform="rotate(30 25 18)" /></g></g>;
    case 'grecada': return <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="M3 26h5l3-10h5l3 10h4l3-10h5l3 10h3" />;
    case 'tramex': return <g fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="6" y="8" width="28" height="24" rx="1" /><path d="M13 8v24M20 8v24M27 8v24M6 16h28M6 24h28" /></g>;
    case 'corrugado': return <g><rect {...st} x="17" y="4" width="6" height="32" rx="3" /><path stroke="var(--surface)" strokeWidth="1.5" d="M17 10l6-3M17 16l6-3M17 22l6-3M17 28l6-3M17 34l6-3" /></g>;
    case 'malla': return <g fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 10h30M5 20h30M5 30h30M10 5v30M20 5v30M30 5v30" /></g>;
    case 'placa': return <path {...st} fillRule="evenodd" d="M7 7h26v26H7zm5 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4zm16 0a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12 26a2 2 0 1 0 0 4a2 2 0 1 0 0-4zm16 0a2 2 0 1 0 0 4a2 2 0 1 0 0-4z" />;
    case 'perno': return <g {...st}><path d="M12 5h16v7H12z" /><rect x="17" y="12" width="6" height="22" rx="1" /><path stroke="var(--surface)" strokeWidth="1.2" d="M17 22h6M17 25h6M17 28h6M17 31h6" /></g>;
    case 'varilla': return <g><rect {...st} x="17" y="4" width="6" height="32" rx="1" /><path stroke="var(--surface)" strokeWidth="1.2" d="M17 8h6M17 12h6M17 16h6M17 20h6M17 24h6M17 28h6M17 32h6" /></g>;
    default: return <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"><path d="M20 5l13 7.5v15L20 35 7 27.5v-15z" /><path d="M7 12.5L20 20l13-7.5M20 20v15" /></g>;
  }
}

/** Cuadradito de color con la sección dibujada */
export default function IconoPieza({ familia, size = 40 }) {
  const grupo = GRUPOS.findIndex(([, fs]) => fs.includes(familia));
  const colores = ['#0a84ff', '#5e5ce6', '#30b0c7', '#8e8e93', '#ff9f0a', '#34c759', '#a2845e', '#ff375f'];
  const c = colores[grupo] ?? '#636366';
  return (
    <span className="icono-pieza" style={{ width: size, height: size, color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72}><Seccion f={familia} /></svg>
    </span>
  );
}
