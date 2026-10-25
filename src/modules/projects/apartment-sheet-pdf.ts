import PDFDocument from 'pdfkit';
import type { PlanApartmentDto } from './dto/site-plan.dto';

export async function renderApartmentSheetPdf(unit: PlanApartmentDto, project: { name: string; currency: string }, building: string, floor: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `Departamento ${unit.code} - ${project.name}`, Author: 'ARIZ Proyectos' } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const navy = '#00124f', gold = '#d49a19';
  const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: project.currency }).format(value);
  const statuses = { AVAILABLE: 'Disponible', RESERVED: 'Separado', SOLD: 'Vendido', RENTED: 'Alquilado', BLOCKED: 'Bloqueado' };
  doc.rect(0, 0, 596, 9).fill(navy);
  doc.font('Helvetica-Bold').fontSize(24).fillColor(navy).text('ARIZ', 44, 35);
  doc.fontSize(9).fillColor(gold).text('FICHA DEL DEPARTAMENTO', 290, 44, { width: 260, align: 'right' });
  doc.fontSize(18).fillColor(navy).text(project.name, 44, 90, { width: 507 });
  doc.moveDown(.4).font('Helvetica').fontSize(11).fillColor('#71809b').text(`${building} / ${floor}`);
  doc.moveDown().font('Helvetica-Bold').fontSize(28).fillColor(navy).text(`Departamento ${unit.code}`);
  doc.font('Helvetica').fontSize(12).fillColor('#71809b').text(statuses[unit.status]);
  doc.moveDown().fontSize(10).text(unit.operation === 'RENT' ? 'ALQUILER MENSUAL' : 'PRECIO DE VENTA');
  doc.font('Helvetica-Bold').fontSize(25).fillColor(navy).text(money(unit.price));
  const y = doc.y + 22;
  doc.roundedRect(44, y, 507, 165, 12).fill('#f0f4fa');
  const rows = [ ['Área total', `${unit.areaM2} m²`], ['Dormitorios', String(unit.bedrooms)], ['Baños', String(unit.bathrooms)], ['Mantenimiento mensual', money(unit.maintenanceFee)] ];
  rows.forEach(([label, value], index) => {
    doc.font('Helvetica').fontSize(11).fillColor('#71809b').text(label, 60, y + 18 + index * 36);
    doc.font('Helvetica-Bold').fillColor(navy).text(value, 300, y + 18 + index * 36, { width: 230, align: 'right' });
  });
  const points = unit.path;
  if (points.length >= 3) {
    const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
    const dx = Math.max(...points.map(p => p.x)) - minX, dy = Math.max(...points.map(p => p.y)) - minY;
    const scale = Math.min(210 / Math.max(dx, .0001), 120 / Math.max(dy, .0001));
    doc.fontSize(10).fillColor(navy).text('DISTRIBUCIÓN REFERENCIAL', 44, y + 187);
    points.forEach((point, index) => {
      const x = 190 + (point.x - minX) * scale, top = y + 215 + (point.y - minY) * scale;
      if (index === 0) doc.moveTo(x, top); else doc.lineTo(x, top);
    });
    doc.closePath().lineWidth(2).fillAndStroke('#edf2fb', navy);
  }
  doc.y = y + 355;
  if (unit.notes.trim()) doc.font('Helvetica').fontSize(10).fillColor('#162342').text(unit.notes, 44, doc.y, { width: 507 });
  doc.moveDown().fontSize(9).fillColor('#71809b').text('Disponibilidad y condiciones sujetas a confirmación.', { width: 507 });
  doc.end();
  return done;
}
