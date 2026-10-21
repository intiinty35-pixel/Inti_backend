import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { SitePlanDto } from './dto/site-plan.dto';

export async function exportLotTable(plan: SitePlanDto, project: { name: string; currency: string }, format: 'xlsx' | 'pdf') {
  const states = { AVAILABLE: 'Disponible', RESERVED: 'Reservado', SOLD: 'Vendido', BLOCKED: 'Bloqueado' };
  const headers = ['N.º de lote', 'Manzana', 'Dirección', 'Tipo', 'Área m²', 'Perímetro m', 'Dimensiones', 'Frente m', `Precio m² (${project.currency})`, `Precio venta (${project.currency})`, 'Estado', 'Pago'];
  const rows = plan.lots.filter(l => l.path.length >= 3).map(l => [l.code, l.block, l.address || l.street, l.type, l.areaM2, l.perimeterM, l.dimensions, l.frontM, l.priceM2, l.cashAllowed ? l.price : l.financedPrice, states[l.status], [l.cashAllowed && 'Contado', l.financingAllowed && 'Financiado'].filter(Boolean).join(' / ')]);
  if (format === 'xlsx') {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Lotes');
    sheet.addRow(headers);
    rows.forEach(row => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    sheet.columns.forEach((col, i) => { col.width = [2, 6, 11].includes(i) ? 28 : 18; });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'L1' };
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 30 });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const widths = [60, 65, 145, 65, 70, 75, 115, 65, 90, 100, 85, 110];
  let y = 0;
  const heading = () => {
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#0f2854').text(`Lotes · ${project.name}`, 30, 28);
    doc.font('Helvetica').fontSize(9).text(`${rows.length} lotes · ${project.currency}`, 30, 52);
    y = 76;
    drawRow(headers, true);
  };
  const drawRow = (row: (string | number)[], header = false) => {
    doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    const height = Math.max(30, ...row.map((cell, i) => doc.heightOfString(String(cell || '—'), { width: widths[i] - 10 }) + 12));
    if (!header && y + height > doc.page.height - 35) { doc.addPage(); heading(); }
    let x = 30;
    row.forEach((cell, i) => {
      doc.rect(x, y, widths[i], height).fill(header ? '#334155' : '#f8fafc');
      doc.fillColor(header ? '#ffffff' : '#172033').text(String(cell ?? ''), x + 5, y + 6, { width: widths[i] - 10, height: height - 10 });
      x += widths[i];
    });
    y += height;
  };
  heading();
  rows.forEach(row => drawRow(row));
  doc.end();
  return result;
}
