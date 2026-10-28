import PDFDocument from 'pdfkit';
import type { PlanApartmentDto, PlanBuildingDto, PlanFloorDto, SitePlanDto } from './dto/site-plan.dto';

type Point = { x: number; y: number };
type Context = { plan: SitePlanDto; building: PlanBuildingDto; floor: PlanFloorDto };

async function loadImage(url?: string): Promise<Buffer | undefined> {
  if (!url || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return undefined;
  try {
    const response = await fetch(url.replace('/image/upload/', '/image/upload/f_png,w_1800,c_limit/'), { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length < 12_000_000 ? bytes : undefined;
  } catch { return undefined; }
}

export async function renderApartmentSheetPdf(unit: PlanApartmentDto, project: { name: string; currency: string }, building: string, floor: string, context?: Context): Promise<Buffer> {
  const floorImage = context?.floor.image ?? (context?.plan.image ? { url: context.plan.image.url, width: 1000, height: 1000 * context.plan.image.heightM / context.plan.image.widthM, crop: context.plan.image.crop } : undefined);
  const urls = [...new Set([context?.plan.image?.url, floorImage?.url].filter((url): url is string => Boolean(url)))];
  const images = new Map(await Promise.all(urls.map(async url => [url, await loadImage(url)] as const)));
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 64, left: 40, right: 40 }, bufferPages: true, info: { Title: `Departamento ${unit.code} - ${project.name}`, Author: 'ARIZ Proyectos' } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const navy = '#122b50', blue = '#195cc4', muted = '#69788e', gold = '#d49a19';
  const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: project.currency }).format(value);
  const statuses = { AVAILABLE: 'Disponible', RESERVED: 'Separado', SOLD: 'Vendido', RENTED: 'Alquilado', BLOCKED: 'Bloqueado' };
  const header = (title: string, subtitle: string) => {
    doc.rect(0, 0, doc.page.width, 8).fill(blue);
    doc.font('Helvetica-Bold').fontSize(23).fillColor(navy).text('ARIZ', 40, 30);
    doc.fontSize(8).fillColor(blue).text('PROYECTOS INMOBILIARIOS', 40, 58);
    doc.fontSize(9).fillColor(muted).text('FICHA DEL DEPARTAMENTO', 310, 37, { width: 245, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(22).fillColor(navy).text(title, 40, 94, { width: 515 });
    doc.moveDown(.3).font('Helvetica').fontSize(11).fillColor(muted).text(subtitle, { width: 515 });
  };
  const section = (title: string) => {
    if (doc.y > 690) { doc.addPage(); doc.y = 40; }
    doc.moveDown(.9).font('Helvetica-Bold').fontSize(11).fillColor(blue).text(title, 40, doc.y, { width: 515, align: 'left' });
    const y = doc.y + 6;
    doc.moveTo(40, y).lineTo(555, y).lineWidth(.6).strokeColor('#dce4ef').stroke();
    doc.y = y + 12;
  };
  const row = (label: string, value: string, emphasis = false) => {
    if (doc.y > 735) { doc.addPage(); doc.y = 40; }
    const y = doc.y;
    const labelHeight = doc.font('Helvetica').fontSize(10).heightOfString(label, { width: 245 });
    const valueHeight = doc.font(emphasis ? 'Helvetica-Bold' : 'Helvetica').heightOfString(value, { width: 245 });
    const height = Math.max(25, labelHeight + 10, valueHeight + 10);
    if (emphasis) doc.roundedRect(40, y - 4, 515, height, 5).fill('#edf4ff');
    doc.font('Helvetica').fontSize(10).fillColor(muted).text(label, 50, y + 2, { width: 235 });
    doc.font(emphasis ? 'Helvetica-Bold' : 'Helvetica').fillColor(navy).text(value, 300, y + 2, { width: 245, align: 'right' });
    doc.y = y + height;
  };
  header(`Departamento ${unit.code}`, `${project.name} / ${building} / ${floor}`);
  section('CARACTERÍSTICAS');
  row('Estado', statuses[unit.status]);
  row('Operación', unit.operation === 'RENT' ? 'Alquiler mensual' : 'Venta');
  row('Área total', `${unit.areaM2} m²`);
  row('Dormitorios / Baños', `${unit.bedrooms} / ${unit.bathrooms}`);
  row('Mantenimiento mensual', money(unit.maintenanceFee));
  section('PRECIO Y CONDICIONES DE PAGO');
  row(unit.operation === 'RENT' ? 'Alquiler mensual' : 'Precio al contado', money(unit.price), true);
  if (unit.operation === 'SALE' && unit.financingAllowed) {
    const total = (unit.installments ?? 0) * (unit.monthlyPayment ?? 0);
    row('Precio al crédito', money(unit.financedPrice ?? 0));
    row('Cuota inicial', money(unit.downPayment ?? 0));
    row('Saldo a financiar', money(Math.max(0, (unit.financedPrice ?? 0) - (unit.downPayment ?? 0))));
    row('Número de cuotas mensuales', String(unit.installments ?? 0));
    row('Interés mensual', unit.interestRateMonthly ? `${unit.interestRateMonthly}%` : 'Sin interés');
    row('Monto de cada cuota', money(unit.monthlyPayment ?? 0), true);
    row('Total de cuotas', money(total));
    row('Total a pagar con inicial', money((unit.downPayment ?? 0) + total), true);
    doc.font('Helvetica').fontSize(8).fillColor(muted).text('La última cuota puede ajustarse por redondeo.', 40, doc.y + 5, { width: 515 });
  }
  if (unit.notes.trim()) {
    section('DESCRIPCIÓN Y CONDICIONES');
    doc.font('Helvetica').fontSize(10).fillColor(navy).text(unit.notes, 40, doc.y, { width: 515, lineGap: 3 });
  }

  doc.addPage();
  header('Ubicación en plano', `${building} / ${floor} / Departamento ${unit.code}`);
  doc.y += 18;
  const panelsY = doc.y;
  // Fit each view independently, maintaining the original sheet proportions.
  const panel = (x: number, title: string, subtitle: string, paths: { points: Point[]; selected: boolean }[], aspect: number, url?: string, crop?: { left: number; top: number; right: number; bottom: number }, zoom = false) => {
    const y = panelsY, w = 249, h = 475;
    doc.roundedRect(x, y, w, h, 10).fillAndStroke('#f7f9fc', '#dce4ef');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(navy).text(title, x + 12, y + 15, { width: w - 24 });
    doc.font('Helvetica').fontSize(8).fillColor(muted).text(subtitle, x + 12, y + 33, { width: w - 24 });
    const box = { x: x + 10, y: y + 65, w: w - 20, h: h - 90 };
    const selected = paths.find(p => p.selected)?.points ?? unit.path;
    const minX = zoom ? Math.min(...selected.map(p => p.x)) : 0;
    const maxX = zoom ? Math.max(...selected.map(p => p.x)) : 1;
    const minY = zoom ? Math.min(...selected.map(p => p.y)) : 0;
    const maxY = zoom ? Math.max(...selected.map(p => p.y)) : 1;
    const width = Math.max(maxX - minX, .025) * (zoom ? 1.8 : 1);
    const height = Math.max(maxY - minY, .025) * (zoom ? 1.8 : 1);
    const scale = Math.min(box.w / width, box.h / (height * aspect));
    const ox = box.x + box.w / 2 - (minX + maxX) / 2 * scale;
    const oy = box.y + box.h / 2 - (minY + maxY) / 2 * aspect * scale;
    doc.save().rect(box.x, box.y, box.w, box.h).clip();
    doc.rect(box.x, box.y, box.w, box.h).fill('#ffffff');
    const bytes = url ? images.get(url) : undefined;
    if (bytes) {
      const c = crop ?? { left: 0, top: 0, right: 1, bottom: 1 };
      doc.save().rect(ox, oy, scale, scale * aspect).clip();
      try { doc.image(bytes, ox - c.left * scale / (c.right - c.left), oy - c.top * scale * aspect / (c.bottom - c.top), { width: scale / (c.right - c.left), height: scale * aspect / (c.bottom - c.top) }); } catch { /* Vector outlines remain visible if the source cannot be decoded. */ }
      doc.restore();
    }
    for (const path of paths) {
      if (path.points.length < 3) continue;
      path.points.forEach((p, i) => { const px = ox + p.x * scale, py = oy + p.y * aspect * scale; if (i) doc.lineTo(px, py); else doc.moveTo(px, py); });
      doc.closePath().lineWidth(path.selected ? 2 : .6).fillOpacity(path.selected ? .28 : .05).fillAndStroke(path.selected ? gold : blue, path.selected ? '#dc2626' : '#69788e').fillOpacity(1);
    }
    if (zoom && selected.length) {
      const cx = selected.reduce((sum, p) => sum + p.x, 0) / selected.length;
      const cy = selected.reduce((sum, p) => sum + p.y, 0) / selected.length;
      const label = `Dpto. ${unit.code}`;
      doc.font('Helvetica-Bold').fontSize(9);
      const labelWidth = Math.min(box.w - 12, doc.widthOfString(label) + 16);
      const lx = Math.max(box.x + 4, Math.min(box.x + box.w - labelWidth - 4, ox + cx * scale - labelWidth / 2));
      const ly = Math.max(box.y + 4, Math.min(box.y + box.h - 25, oy + cy * aspect * scale - 10));
      doc.roundedRect(lx, ly, labelWidth, 21, 4).fillAndStroke('#ffffff', '#dc2626');
      doc.fillColor(navy).text(label, lx + 5, ly + 6, { width: labelWidth - 10, height: 11, align: 'center', ellipsis: true });
    }
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(blue).text(zoom ? `DEPARTAMENTO ${unit.code}` : building, x + 12, y + h - 17, { width: w - 24, align: 'center' });
    if (!bytes) doc.font('Helvetica').fontSize(7).fillColor(muted).text('Contornos referenciales \u00b7 imagen no disponible', x + 10, y + 49, { width: w - 20 });
  };
  const plan = context?.plan;
  const allBuildings = plan?.buildings ?? [];
  const all = allBuildings.flatMap(b => b.path);
  const west = Math.min(...all.map(p => p.lng)), east = Math.max(...all.map(p => p.lng));
  const south = Math.min(...all.map(p => p.lat)), north = Math.max(...all.map(p => p.lat));
  const projectPoint = (p: { lat: number; lng: number }): Point => {
    const image = plan?.image;
    if (!image) return { x: .05 + .9 * (p.lng - west) / Math.max(east - west, .000001), y: .05 + .9 * (north - p.lat) / Math.max(north - south, .000001) };
    const eastM = (p.lng - image.center.lng) * 111320 * Math.cos(image.center.lat * Math.PI / 180);
    const northM = (p.lat - image.center.lat) * 111320;
    const angle = image.rotation * Math.PI / 180;
    return { x: (eastM * Math.cos(angle) - northM * Math.sin(angle)) / image.widthM + .5, y: .5 - (eastM * Math.sin(angle) + northM * Math.cos(angle)) / image.heightM };
  };
  panel(40, 'PROYECTO COMPLETO', 'Edificio seleccionado resaltado', allBuildings.map(b => ({ points: b.path.map(projectPoint), selected: b.id === context?.building.id })), plan?.image ? plan.image.heightM / plan.image.widthM : 1, plan?.image?.url, plan?.image?.crop);
  panel(306, 'ZOOM AL DEPARTAMENTO', `${floor} \u00b7 Departamento ${unit.code}`, (context?.floor.apartments ?? [unit]).map(a => ({ points: a.path, selected: a.id === unit.id })), floorImage ? floorImage.height / floorImage.width : 1, floorImage?.url, floorImage?.crop, true);
  doc.font('Helvetica').fontSize(9).fillColor(muted).text('Ubicación y distribución referenciales. Disponibilidad y condiciones sujetas a confirmación.', 40, panelsY + 493, { width: 515, lineGap: 3 });
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(muted).text(`ARIZ Proyectos \u00b7 Departamento ${unit.code}`, 40, 784, { width: 410, lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, 490, 784, { width: 65, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return done;
}
