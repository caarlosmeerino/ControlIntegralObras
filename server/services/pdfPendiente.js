// PDF de trabajo: orden de fabricación / material / montaje / tareas, agrupado por obra
import PDFDocument from 'pdfkit';

const nf = (d = 0) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const kg = (v) => `${nf(0).format(v || 0)} kg`;
const fecha = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

export const TITULOS = {
  fabricar: 'Orden de fabricación',
  material: 'Material pendiente de recibir',
  montar: 'Piezas pendientes de montar',
  tareas: 'Tareas pendientes',
};

const AZUL = '#1d4ed8'; const TINTA = '#111827'; const GRIS = '#6b7280'; const LINEA = '#d1d5db'; const SUAVE = '#f3f4f6';

/**
 * grupos: [{ obra: {nombre, cliente, direccion, ciudad, codigo}, limite, piezas?: [], etapas?: [] }]
 */
export function pdfPendiente(res, { tipo, periodo, filtros, grupos, generado }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `${TITULOS[tipo]} · ${periodo}`, Author: 'Control Integral de Obras' } });
  doc.pipe(res);
  const X = 40; const W = doc.page.width - 80; const BOTTOM = doc.page.height - 60;
  let y = 40;

  // ---- Cabecera del documento ----
  doc.rect(0, 0, doc.page.width, 6).fill(AZUL);
  doc.fill(AZUL).font('Helvetica-Bold').fontSize(9).text('CONTROL INTEGRAL · OBRAS', X, 24, { characterSpacing: 1 });
  doc.fill(TINTA).font('Helvetica-Bold').fontSize(20).text(TITULOS[tipo], X, 40, { width: W });
  y = doc.y + 4;
  const datos = [['Periodo', periodo], ...filtros, ['Generado', generado]];
  datos.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').fontSize(9).fill(GRIS).text(`${k}:`, X, y, { continued: true }).font('Helvetica').fill(TINTA).text(`  ${v}`);
    y = doc.y + 2;
  });
  y += 8;

  if (!grupos.length) {
    doc.font('Helvetica').fontSize(11).fill(GRIS).text('No hay nada pendiente con estos filtros.', X, y + 10);
  }

  const nuevaPagina = () => { doc.addPage(); y = 40; };
  const asegurar = (h) => { if (y + h > BOTTOM) nuevaPagina(); };

  // Columnas de las tablas de piezas
  const colsP = [
    { t: '', w: 18 }, { t: 'Marca', w: 52 }, { t: 'Pieza', w: 150 }, { t: 'Cant.', w: 38, r: true },
    { t: 'Medida', w: 60, r: true }, { t: 'Peso', w: 62, r: true }, { t: 'Fase', w: 0 }, { t: 'Límite', w: 56, r: true },
  ];
  const fija = colsP.reduce((s, c) => s + c.w, 0);
  colsP[6].w = W - fija;

  const cabTabla = () => {
    doc.rect(X, y, W, 18).fill(SUAVE);
    let x = X;
    colsP.forEach((c) => { doc.fill(GRIS).font('Helvetica-Bold').fontSize(7.5).text(c.t.toUpperCase(), x + 4, y + 6, { width: c.w - 8, align: c.r ? 'right' : 'left', lineBreak: false }); x += c.w; });
    y += 18;
  };

  grupos.forEach((g, gi) => {
    asegurar(90);
    if (gi > 0) y += 10;
    // ---- Cabecera de la obra ----
    doc.rect(X, y, 3, 34).fill(AZUL);
    doc.fill(TINTA).font('Helvetica-Bold').fontSize(13).text(g.obra.nombre, X + 10, y, { width: W - 150 });
    doc.font('Helvetica').fontSize(8.5).fill(GRIS)
      .text([g.obra.codigo, g.obra.cliente, [g.obra.direccion, g.obra.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · '), X + 10, doc.y + 1, { width: W - 150 });
    if (g.limite) {
      doc.roundedRect(X + W - 132, y, 132, 34, 4).fill('#fef2f2');
      doc.fill('#991b1b').font('Helvetica-Bold').fontSize(7).text('FECHA LÍMITE', X + W - 124, y + 6, { width: 116 });
      doc.fontSize(13).text(fecha(g.limite), X + W - 124, y + 15, { width: 116 });
    }
    y = Math.max(doc.y, y + 34) + 8;

    if (tipo === 'tareas') {
      g.etapas.forEach((e) => {
        asegurar(40);
        doc.fill(TINTA).font('Helvetica-Bold').fontSize(10).text(e.nombre, X, y, { width: W - 140, continued: false });
        doc.font('Helvetica').fontSize(8.5).fill(GRIS).text(`${fecha(e.fecha_inicio)} – ${fecha(e.fecha_fin)}`, X + W - 140, y + 1, { width: 140, align: 'right' });
        y = Math.max(doc.y, y + 12) + 4;
        const lista = e.pendientes.length ? e.pendientes.map((t) => t.texto) : ['Confirmar la fase como terminada'];
        lista.forEach((t) => {
          asegurar(20);
          doc.rect(X + 4, y + 1, 9, 9).lineWidth(0.8).stroke(TINTA);
          doc.fill(TINTA).font('Helvetica').fontSize(9.5).text(t, X + 20, y, { width: W - 20 });
          y = doc.y + 5;
        });
        y += 4;
      });
      return;
    }

    cabTabla();
    g.piezas.forEach((p, i) => {
      if (y + 20 > BOTTOM) { nuevaPagina(); cabTabla(); }
      if (i % 2) doc.rect(X, y, W, 20).fill('#fafafa');
      const medida = p.ml_unitario ? `${nf(2).format(p.ml_unitario)} m` : p.m2_unitario ? `${nf(2).format(p.m2_unitario)} m²` : '—';
      const vals = ['', p.marca, p.catalogo_nombre || p.perfil || 'Pieza', String(p.cantidad), medida, kg(p.kg), p.etapa_nombre || 'Sin fase', fecha(p.fecha_fin)];
      let x = X;
      colsP.forEach((c, k) => {
        if (k === 0) doc.rect(x + 5, y + 5, 9, 9).lineWidth(0.8).stroke(TINTA);
        else doc.fill(TINTA).font(k === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(vals[k], x + 4, y + 6, { width: c.w - 8, height: 10, align: c.r ? 'right' : 'left', lineBreak: false, ellipsis: true });
        x += c.w;
      });
      doc.moveTo(X, y + 20).lineTo(X + W, y + 20).lineWidth(0.4).stroke(LINEA);
      y += 20;
    });
    // Total de la obra
    asegurar(22);
    const tKg = g.piezas.reduce((s, p) => s + p.kg, 0); const tUd = g.piezas.reduce((s, p) => s + p.cantidad, 0);
    doc.fill(TINTA).font('Helvetica-Bold').fontSize(9)
      .text(`Total: ${g.piezas.length} marcas · ${nf(0).format(tUd)} unidades · ${kg(tKg)}`, X, y + 6, { width: W, align: 'right' });
    y += 22;
  });

  // ---- Firma ----
  if (grupos.length) {
    asegurar(70);
    y += 24;
    const ancho = (W - 40) / 3;
    ['Responsable', 'Fecha de entrega', 'Firma'].forEach((t, i) => {
      const x = X + i * (ancho + 20);
      doc.moveTo(x, y + 30).lineTo(x + ancho, y + 30).lineWidth(0.6).stroke(GRIS);
      doc.fill(GRIS).font('Helvetica').fontSize(8).text(t, x, y + 34, { width: ancho });
    });
  }

  // ---- Pie con número de página ----
  const r = doc.bufferedPageRange();
  for (let i = r.start; i < r.start + r.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // el pie va por debajo del margen sin crear páginas nuevas
    doc.fill(GRIS).font('Helvetica').fontSize(7.5).text(`${TITULOS[tipo]} · ${periodo}`, X, doc.page.height - 32, { width: W / 2, lineBreak: false });
    doc.text(`Página ${i - r.start + 1} de ${r.count}`, X + W / 2, doc.page.height - 32, { width: W / 2, align: 'right', lineBreak: false });
  }
  doc.end();
}
