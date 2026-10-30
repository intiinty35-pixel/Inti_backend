import PDFDocument from 'pdfkit';
import type { PlanLotDto } from './dto/site-plan.dto';

const NAVY = '#00124f';
const GOLD = '#d49a19';
const INK = '#162342';
const MUTED = '#71809b';
const EDGE = '#dfe5ef';
const STATUS = { AVAILABLE: 'Disponible', RESERVED: 'Reservado', SOLD: 'Vendido', BLOCKED: 'Bloqueado' };

export async function renderLotSheetPdf({ lot, project, draft, appLogo, projectLogo }: {
  lot: PlanLotDto; project: { name: string; currency: string; location?: { street?: string; streetNumber?: string; zone?: string | null; district?: string; province?: string; department?: string; country?: string } | null }; draft: boolean; appLogo: Buffer | null; projectLogo: Buffer | null;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Ficha del lote ${lot.code} - ${project.name}`, Author: 'INTI Proyectos', Subject: 'Información comercial y técnica del lote' } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const left = 40;
  const width = doc.page.width - 80;
  let y = 0;
  const money = (amount: number) => `${project.currency === 'USD' ? 'US$' : 'S/'} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const text = (value: string, x: number, top: number, size = 10, color = INK, bold = false, options: PDFKit.Mixins.TextOptions = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(value, x, top, options);
  };
  function brand(continuation = false) {
    doc.rect(0, 0, doc.page.width, 5).fill(NAVY);
    doc.rect(left, 5, 68, 3).fill(GOLD);
    doc.rect(left, 23, width, 62).fillAndStroke('#ffffff', EDGE);
    if (appLogo) doc.image(appLogo, left + 12, 31, { fit: [115, 45] });
    else text('INTI', left, 30, 23, NAVY, true);
    if (projectLogo) {
      try { doc.image(projectLogo, doc.page.width - 152, 31, { fit: [100, 45], align: 'right' }); }
      catch { /* Keep the lot sheet usable when an optional logo is invalid. */ }
    }
    text('FICHA DEL LOTE', left + 145, 40, 12, NAVY, true, { width: 210, align: 'center' });
    text(draft ? 'BORRADOR ADMINISTRATIVO' : 'INFORMACIÓN COMERCIAL', left + 145, 60, 7, MUTED, false, { width: 210, align: 'center' });
    if (continuation) {
      text(`LOTE ${lot.code} / ${project.name}`, left, 88, 9, MUTED, false, { width, height: 28, ellipsis: true });
      y = 127;
    }
  }
  function ensureRoom(height: number) {
    if (y + height > doc.page.height - 62) { doc.addPage(); brand(true); }
  }
  function section(title: string) {
    ensureRoom(65);
    y += 12;
    doc.rect(left, y, width, 25).fill(NAVY);
    doc.rect(left, y, 4, 25).fill(GOLD);
    text(title.toUpperCase(), left + 12, y + 8, 9, '#ffffff', true, { width: width - 24 });
    y += 25;
  }
  function row(label: string, value: string, index: number) {
    const labelWidth = 147;
    const valueWidth = width - labelWidth - 30;
    doc.font('Helvetica').fontSize(10);
    const height = Math.max(25, doc.heightOfString(value || 'No especificado', { width: valueWidth, lineGap: 3 }) + 11);
    ensureRoom(height);
    doc.rect(left, y, width, height).fillAndStroke('#ffffff', EDGE);
    doc.rect(left, y, labelWidth - 12, height).fillAndStroke(index % 2 ? '#edf3f9' : '#f3f6fb', EDGE);
    text(label, left + 12, y + 8, 9, MUTED, false, { width: labelWidth - 24 });
    text(value || 'No especificado', left + labelWidth, y + 7, 10, INK, true, { width: valueWidth, lineGap: 3 });
    doc.moveTo(left, y + height).lineTo(left + width, y + height).lineWidth(.5).strokeColor(EDGE).stroke();
    y += height;
  }
  brand();
  const location = project.location;
  const address = location ? [[location.street, location.streetNumber].filter(Boolean).join(' '), location.zone, location.district, location.province, location.department, location.country === 'PE' ? 'Perú' : location.country].filter(value => value?.trim()).join(', ') : '';
  const addressText = address || lot.address || 'Dirección no informada';
  doc.font('Helvetica-Bold').fontSize(17);
  const nameHeight = doc.heightOfString(project.name, { width: width - 32, lineGap: 2 });
  doc.font('Helvetica').fontSize(9);
  const addressHeight = doc.heightOfString(addressText, { width: width - 32, lineGap: 2 });
  const headerHeight = nameHeight + addressHeight + 83;
  doc.rect(left, 100, width, headerHeight).fillAndStroke('#f0f4fa', EDGE);
  text(project.name, left + 16, 114, 17, NAVY, true, { width: width - 32, lineGap: 2 });
  text('DIRECCIÓN DEL PROYECTO', left + 16, 123 + nameHeight, 7, MUTED, true);
  text(addressText, left + 16, 136 + nameHeight, 9, INK, false, { width: width - 32, lineGap: 2 });
  text(`Lote ${lot.code}${lot.block ? ` / Manzana ${lot.block}` : ''} · ${STATUS[lot.status]}`, left + 16, 149 + nameHeight + addressHeight, 11, NAVY, true, { width: width - 32 });
  const metricsY = 110 + headerHeight;
  const half = (width - 12) / 2;
  doc.rect(left, metricsY, half, 65).fillAndStroke('#edf2fb', EDGE);
  doc.rect(left + half + 12, metricsY, half, 65).fillAndStroke('#edf6f4', EDGE);
  text('PRECIO DE VENTA', left + 15, metricsY + 12, 8, MUTED, true);
  text(lot.cashAllowed ? money(lot.price) : lot.financingAllowed ? money(lot.financedPrice) : 'Consultar', left + 15, metricsY + 31, 19, NAVY, true, { width: half - 30 });
  text('ÁREA DEL LOTE', left + half + 27, metricsY + 12, 8, MUTED, true);
  text(`${lot.areaM2.toLocaleString('es-PE', { maximumFractionDigits: 2 })} m²`, left + half + 27, metricsY + 31, 19, NAVY, true, { width: half - 30 });
  y = metricsY + 70;
  section('Características del lote');
  [
    ['Manzana', lot.block], ['Calle', lot.street], ['Dirección', lot.address], ['Tipo de lote', lot.type],
    ['Perímetro', `${lot.perimeterM} m`], ['Frente', `${lot.frontM} m`], ['Dimensiones', lot.dimensions], ['Precio por m²', money(lot.priceM2)],
  ].forEach(([label, value], index) => row(label, value, index));
  section('Condiciones de venta');
  row('Pago al contado', lot.cashAllowed ? money(lot.price) : 'No disponible', 0);
  row('Financiamiento', lot.financingAllowed ? 'Disponible' : 'No disponible', 1);
  if (lot.financingAllowed) {
    const total = lot.interestRateMonthly ? lot.downPayment + lot.installments * lot.monthlyPayment : lot.financedPrice;
    row('Cuota inicial', money(lot.downPayment), 2);
    row('Plan de cuotas', `${lot.installments} cuotas de ${money(lot.monthlyPayment)}`, 3);
    if (lot.interestRateMonthly) row('Interés mensual', `${lot.interestRateMonthly}%`, 4);
    row('Total financiado', money(total), 5);
  }
  if (lot.notes?.trim()) { section('Observaciones'); row('Información adicional', lot.notes.trim(), 0); }
  ensureRoom(draft ? 43 : 28);
  y += 10;
  text('Disponibilidad y condiciones sujetas a confirmación.', left, y, 9, MUTED, false, { width });
  if (draft) text('Documento administrativo de borrador. No acredita publicación ni reserva.', left, y + 16, 8, MUTED, false, { width });
  const range = doc.bufferedPageRange();
  const issued = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(left, doc.page.height - 43).lineTo(left + width, doc.page.height - 43).strokeColor(EDGE).lineWidth(.6).stroke();
    text(`INTI PROYECTOS / ${issued}`, left, doc.page.height - 31, 8, MUTED, false, { lineBreak: false });
    text(`${index + 1} / ${range.count}`, doc.page.width - 85, doc.page.height - 31, 8, MUTED, false, { lineBreak: false, width: 45, align: 'right' });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return done;
}
