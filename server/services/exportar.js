// Exportación genérica de informes a PDF (pdfkit) y Excel (exceljs)
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const nf = (d = 0) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
export const fmt = {
  kg: (v) => (v == null ? '—' : `${nf(0).format(v)} kg`),
  t: (v) => (v == null ? '—' : `${nf(2).format(v / 1000)} t`),
  tt: (v) => (v == null ? '—' : `${nf(2).format(v)} t`),
  pct: (v) => (v == null ? '—' : `${nf(1).format(v)} %`),
  eur: (v) => (v == null ? '—' : `${nf(2).format(v)} €`),
  num: (v) => (v == null ? '—' : nf(Number.isInteger(v) ? 0 : 2).format(v)),
  date: (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—'),
  text: (v) => (v == null ? '' : String(v)),
};

export function pdfInforme(inf, res) {
  const doc = new PDFDocument({ size: 'A4', layout: inf.columnas.length > 6 ? 'landscape' : 'portrait', margin: 36, bufferPages: true,
    info: { Title: inf.titulo, Author: 'Control Integral de Obras' } });
  doc.pipe(res);
  const W = doc.page.width - 72;
  doc.rect(0, 0, doc.page.width, 64).fill('#1e293b');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(16).text(inf.titulo, 36, 18, { width: W });
  doc.font('Helvetica').fontSize(9).fill('#cbd5e1').text(inf.subtitulo || '', 36, 40, { width: W });
  doc.moveDown(2).fill('#0f172a');
  let y = 84;
  if (inf.kpis?.length) {
    const kw = W / inf.kpis.length;
    inf.kpis.forEach((k, i) => {
      doc.roundedRect(36 + i * kw + 2, y, kw - 4, 44, 4).fill('#f1f5f9');
      doc.fill('#475569').fontSize(7.5).text(k.label.toUpperCase(), 44 + i * kw, y + 7, { width: kw - 16 });
      doc.fill('#0f172a').font('Helvetica-Bold').fontSize(12).text(k.valor, 44 + i * kw, y + 21, { width: kw - 16 });
      doc.font('Helvetica');
    });
    y += 56;
  }
  const cols = inf.columnas;
  const totalW = cols.reduce((s, c) => s + (c.w || 1), 0);
  const widths = cols.map((c) => ((c.w || 1) / totalW) * W);
  const header = () => {
    doc.rect(36, y, W, 18).fill('#334155');
    let x = 36;
    cols.forEach((c, i) => { doc.fill('#ffffff').font('Helvetica-Bold').fontSize(8).text(c.label, x + 3, y + 5, { width: widths[i] - 6, align: c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? 'right' : 'left', lineBreak: false, ellipsis: true }); x += widths[i]; });
    doc.font('Helvetica'); y += 18;
  };
  header();
  const filas = inf.totales ? [...inf.filas, { ...inf.totales, __total: true }] : inf.filas;
  filas.forEach((f, ri) => {
    if (y > doc.page.height - 60) { doc.addPage(); y = 36; header(); }
    if (f.__total) doc.rect(36, y, W, 16).fill('#e2e8f0'); else if (ri % 2) doc.rect(36, y, W, 16).fill('#f8fafc');
    let x = 36;
    cols.forEach((c, i) => {
      const v = (fmt[c.fmt || 'text'] || fmt.text)(f[c.key]);
      doc.fill('#0f172a').font(f.__total ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(v, x + 3, y + 4, { width: widths[i] - 6, align: c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? 'right' : 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    y += 16;
  });
  if (!filas.length) doc.fill('#64748b').fontSize(10).text('No hay datos para el periodo seleccionado.', 36, y + 10);
  if (inf.nota) { doc.fill('#475569').fontSize(8).text(inf.nota, 36, Math.min(y + 14, doc.page.height - 70), { width: W }); }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fill('#94a3b8').fontSize(7).text(`Control Integral de Obras · Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} · Página ${i + 1} de ${range.count}`,
      36, doc.page.height - 28, { width: W, align: 'center', lineBreak: false });
  }
  doc.end();
}

export async function xlsxInforme(inf) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control Integral de Obras';
  const ws = wb.addWorksheet(inf.titulo.slice(0, 31).replace(/[\\/*?:[\]]/g, ''));
  ws.addRow([inf.titulo]).font = { bold: true, size: 14 };
  ws.addRow([inf.subtitulo || '']).font = { color: { argb: 'FF64748B' } };
  ws.addRow([]);
  const hr = ws.addRow(inf.columnas.map((c) => c.label + (c.fmt === 'kg' ? ' (kg)' : c.fmt === 't' || c.fmt === 'tt' ? ' (t)' : c.fmt === 'eur' ? ' (€)' : c.fmt === 'pct' ? ' (%)' : '')));
  hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; });
  const numFmt = { kg: '#,##0', t: '#,##0.00', tt: '#,##0.00', pct: '0.0', eur: '#,##0.00', num: '#,##0.##' };
  const filas = inf.totales ? [...inf.filas, { ...inf.totales, __total: true }] : inf.filas;
  for (const f of filas) {
    const row = ws.addRow(inf.columnas.map((c) => {
      const v = f[c.key];
      if (v == null) return null;
      if (c.fmt === 't') return Math.round(v) / 1000;
      if (c.fmt === 'date') return v ? new Date(String(v).slice(0, 10) + 'T00:00:00Z') : null;
      return v;
    }));
    inf.columnas.forEach((c, i) => { const cell = row.getCell(i + 1); if (numFmt[c.fmt]) cell.numFmt = numFmt[c.fmt]; if (c.fmt === 'date') cell.numFmt = 'dd/mm/yyyy'; });
    if (f.__total) row.font = { bold: true };
  }
  inf.columnas.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(12, c.label.length + 6, (c.w || 1) * 10); });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  if (inf.nota) { ws.addRow([]); ws.addRow([inf.nota]).font = { italic: true, color: { argb: 'FF64748B' } }; }
  return wb.xlsx.writeBuffer();
}
