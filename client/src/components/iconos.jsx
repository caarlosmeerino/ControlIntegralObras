// Iconos propios del sector de la estructura metálica.
// Trazo recto, remates cuadrados, inspirados en perfiles, planos y señalética de taller.
const I = ({ size = 24, children, title, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="square" strokeLinejoin="miter" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} {...p}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);

/** Manómetro: panel principal */
export const Manometro = (p) => <I {...p}><path d="M3.5 16a8.5 8.5 0 1 1 17 0" /><path d="M12 16l4.5-5" /><circle cx="12" cy="16" r="1.4" fill="currentColor" /><path d="M6 12.5l1 .6M12 7.6V9M18 12.5l-1 .6" /><path d="M3 20h18" /></I>;
/** Línea de producción: estaciones unidas */
export const Linea = (p) => <I {...p}><path d="M2 12h20" /><rect x="3" y="8.5" width="4" height="7" /><rect x="10" y="8.5" width="4" height="7" fill="currentColor" fillOpacity=".25" /><rect x="17" y="8.5" width="4" height="7" /><path d="M5 4v2M12 4v2M19 4v2" /></I>;
/** Nave industrial con pórtico */
export const Nave = (p) => <I {...p}><path d="M3 20V9l9-5 9 5v11" /><path d="M3 20h18" /><path d="M7 20v-6h4v6M14 13h4v3h-4z" /><path d="M3 9h18" strokeDasharray="2 2" /></I>;
/** Plano de taller con cotas */
export const Plano = (p) => <I {...p}><path d="M4 3h12l4 4v14H4z" /><path d="M16 3v4h4" /><path d="M7 16h10M7 14.5v3M17 14.5v3" /><path d="M8 7h5M8 10h7" /></I>;
/** Sección de perfil HEB */
export const PerfilH = (p) => <I {...p}><path d="M4 4h16v3.2h-6.4v9.6H20V20H4v-3.2h6.4V7.2H4z" /></I>;
/** Viga IPE en alzado */
export const Viga = (p) => <I {...p}><path d="M2 8h20M2 16h20M2 8v8M22 8v8" /><path d="M6 8v8M18 8v8" strokeDasharray="1.5 2" /></I>;
/** Soplete y chispa: soldadura / taller */
export const Soldadura = (p) => <I {...p}><path d="M3 21l8-8" /><path d="M9.5 11.5l3 3" /><path d="M11 13l3-3 3 3-3 3z" /><path d="M18 3v3M21 6h-3M16 5l1.2 1.2M20.5 9.5l-1.6-.6" /></I>;
/** Gancho de grúa: montaje */
export const Grua = (p) => <I {...p}><path d="M3 4h18M7 4v0M12 4v6" /><path d="M5 4l3 3M19 4l-3 3" /><path d="M12 10a3 3 0 1 1-3 3" /><path d="M9 13v1" /><path d="M5 21h14" /><path d="M12 16v5" strokeDasharray="1.5 1.5" /></I>;
/** Casco de obra */
export const Casco = (p) => <I {...p}><path d="M3 17h18v2.5H3z" /><path d="M5 17v-3a7 7 0 0 1 14 0v3" /><path d="M10 7.3V12M14 7.3V12" /></I>;
/** Operario */
export const Operario = (p) => <I {...p}><path d="M7.5 8.5a4.5 4.5 0 0 1 9 0z" /><path d="M6.5 8.5h11" /><path d="M8.5 9.5a3.5 3.5 0 0 0 7 0" /><path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2" /></I>;
/** Cuadrilla */
export const Cuadrilla = (p) => <I {...p}><path d="M5 9a3 3 0 0 1 6 0zM13 9a3 3 0 0 1 6 0z" /><path d="M2 20v-1.5A3.5 3.5 0 0 1 5.5 15h3a3.5 3.5 0 0 1 3.5 3.5V20M12 20v-1.5a3.5 3.5 0 0 1 3.5-3.5h3a3.5 3.5 0 0 1 3.5 3.5V20" /><path d="M6 11.5a2 2 0 0 0 4 0M14 11.5a2 2 0 0 0 4 0" /></I>;
/** Albarán sellado: informes */
export const Albaran = (p) => <I {...p}><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21z" /><path d="M8 7h8M8 10h8M8 13h4" /><circle cx="15.5" cy="15" r="1.8" /></I>;
/** Báscula: toneladas y rendimientos */
export const Bascula = (p) => <I {...p}><path d="M7 9h10l3 11H4z" /><path d="M9.5 9a2.5 2.5 0 1 1 5 0" /><path d="M10 15h4" /></I>;
/** Marco de lectura QR */
export const Escaner = (p) => <I {...p}><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" /><path d="M7 7h4v4H7zM13 13h4v4h-4zM13 7h4v2M7 15h2v2" /></I>;
/** Llave: usuarios y permisos */
export const Llave = (p) => <I {...p}><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v2" /></I>;
/** Bidón / archivo: copias */
export const Archivo = (p) => <I {...p}><ellipse cx="12" cy="5" rx="8" ry="2.5" /><path d="M4 5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5" /><path d="M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" /></I>;
/** Disco de corte */
export const Corte = (p) => <I {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 4v3M20 12h-3M12 20v-3M4 12h3" /></I>;
/** Rodillo de pintura */
export const Pintura = (p) => <I {...p}><rect x="4" y="3" width="13" height="5" /><path d="M17 5.5h3v5h-8v3" /><path d="M10.5 13.5h3V21h-3z" /></I>;
/** Camión de transporte */
export const Camion = (p) => <I {...p}><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /><path d="M2 9h12" /></I>;
/** Señal de peligro */
export const Peligro = (p) => <I {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 17.5v.5" /></I>;
/** Calibre / control de calidad */
export const Calibre = (p) => <I {...p}><path d="M3 5h18v4H3z" /><path d="M6 9v10l2-2V9M15 9v6h3V9" /><path d="M7 5v2M11 5v2M15 5v2M19 5v2" /></I>;
/** Perno: ajustes */
export const Perno = (p) => <I {...p}><path d="M12 2l7 4v8l-7 4-7-4V6z" /><circle cx="12" cy="10" r="2.5" /><path d="M10 18v4h4v-4" /></I>;
/** Menú de zonas */
export const Zonas = (p) => <I {...p}><path d="M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v5H3zM14 15h7v5h-7z" /></I>;
/** Luna / sol para el tema */
export const Luna = (p) => <I {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></I>;
export const Sol = (p) => <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>;
export const Salir = (p) => <I {...p}><path d="M10 4H4v16h6" /><path d="M14 8l4 4-4 4M18 12H9" /></I>;
export const Lupa = (p) => <I {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></I>;

// Icono por clave de fase
export const ICONO_FASE = { ingenieria: Plano, compras: Camion, corte: Corte, armado: Soldadura, calidad: Calibre, pintura: Pintura, expedicion: Camion, montaje: Grua, entrega: Casco };
