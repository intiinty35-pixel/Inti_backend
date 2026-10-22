import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { SaveSitePlanDto, SitePlanDto } from './dto/site-plan.dto';
import ExcelJS from 'exceljs';
import { renderLotSheetPdf } from './lot-sheet-pdf';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validPolygon } from './site-plan-geometry';

@Injectable()
export class SitePlansService {
  constructor(private readonly prisma: PrismaService) {}

  async admin(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, isDeleted: false },
      include: {
        sitePlan: true,
        location: true,
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return {
      project: {
        id,
        name: project.name,
        currency: project.currency,
        location: project.location,
        status: project.status,
      },
      revision: project.sitePlan?.revision ?? 0,
      publishedAt: project.sitePlan?.publishedAt,
      plan: project.sitePlan?.draft ?? {
        logoUrl: '',
        zones: [],
        lots: [],
      },
    };
  }

  async publicPlan(slug: string) {
    const project = await this.prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED', isDeleted: false },
      include: { sitePlan: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project.sitePlan?.published
      ? {
          ...(project.sitePlan.published as Prisma.JsonObject),
          currency: project.currency,
        }
      : null;
  }

  async save(id: string, dto: SaveSitePlanDto) {
    if (dto.plan.image?.sourcePdfUrl && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\//.test(dto.plan.image.sourcePdfUrl)) throw new BadRequestException('Sube el PDF original a la biblioteca del proyecto');
    if (
      !dto.plan.image &&
      (dto.publish ||
        dto.plan.zones.length > 0 ||
        dto.plan.lots.some((lot) => lot.path.length > 0))
    )
      throw new BadRequestException(
        'Sube el plano del proyecto antes de dibujar o publicar.',
      );
    const codes = new Set<string>();
    const ids = new Set<string>();
    for (const lot of dto.plan.lots) {
      const code = `${lot.block.trim().toLowerCase()}|${lot.code.trim().toLowerCase()}`;
      if (!lot.code.trim() || codes.has(code) || ids.has(lot.id))
        throw new BadRequestException(
          'Código o identificador de lote duplicado o vacío',
        );
      if (lot.path.length > 0 && !validPolygon(lot.path))
        throw new BadRequestException(
          `Revisa el polígono de ${lot.code}: debe tener área y no cruzarse`,
        );
      if (!lot.cashAllowed && !lot.financingAllowed)
        throw new BadRequestException(
          'Elige al contado o financiado en cada lote',
        );
      if (
        lot.financingAllowed &&
        (!lot.installments || lot.downPayment > lot.financedPrice)
      )
        throw new BadRequestException(
          'Revisa las cuotas y el precio financiado',
        );
      if (
        dto.publish &&
        ((lot.cashAllowed && lot.price <= 0) ||
          (lot.financingAllowed &&
            (lot.financedPrice <= 0 || lot.monthlyPayment <= 0)))
      )
        throw new BadRequestException(
          `Completa los precios y cuotas de ${lot.code} antes de publicar`,
        );
      codes.add(code);
      ids.add(lot.id);
    }
    for (const zone of dto.plan.zones) {
      if (!zone.name.trim() || ids.has(zone.id))
        throw new BadRequestException(
          'Nombre de zona vacío o identificador duplicado',
        );
      if (!validPolygon(zone.path))
        throw new BadRequestException(`Revisa el polígono de ${zone.name}`);
      ids.add(zone.id);
    }
    for (const url of [dto.plan.logoUrl, dto.plan.image?.url].filter(
      Boolean,
    ) as string[]) {
      if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url))
        throw new BadRequestException(
          'Sube las imágenes a la biblioteca del proyecto',
        );
    }
    const json = JSON.parse(JSON.stringify(dto.plan)) as Prisma.InputJsonValue;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const project = await tx.project.findFirst({
            where: { id, isDeleted: false },
            include: { location: true },
          });
          if (!project) throw new NotFoundException('Proyecto no encontrado');
          if (
            dto.publish &&
            (project.location?.latitude == null ||
              project.location?.longitude == null)
          )
            throw new BadRequestException(
              'Define primero el punto exacto del proyecto',
            );
          if (dto.revision === 0) {
            await tx.projectSitePlan.create({
              data: { projectId: id, draft: json },
            });
          } else {
            const result = await tx.projectSitePlan.updateMany({
              where: { projectId: id, revision: dto.revision },
              data: { draft: json, revision: { increment: 1 } },
            });
            if (result.count !== 1)
              throw new ConflictException(
                'Otro administrador modificó el plano. Recarga antes de guardar.',
              );
          }
          if (dto.publish) {
            if (!dto.plan.lots.some((lot) => lot.path.length >= 3))
              throw new BadRequestException(
                'Dibuja al menos un lote antes de publicar',
              );
            await tx.projectSitePlan.update({
              where: { projectId: id },
              data: { published: json, publishedAt: new Date() },
            });
            // Stable IDs keep links and existing lot assignments intact across publications.
            const foreign = await tx.projectLot.count({
              where: {
                id: { in: dto.plan.lots.map((lot) => lot.id) },
                projectId: { not: id },
              },
            });
            if (foreign)
              throw new BadRequestException(
                'Un lote pertenece a otro proyecto',
              );
            await tx.projectLot.deleteMany({ where: { projectId: id } });
            await tx.projectLot.createMany({
              data: dto.plan.lots.map((lot, position) => ({
                id: lot.id,
                projectId: id,
                lotNumber: lot.code.trim(),
                block: lot.block || null,
                areaM2: lot.areaM2,
                frontM: lot.frontM || null,
                price: lot.cashAllowed ? lot.price : lot.financedPrice,
                status: lot.status,
                position,
                lotCount: null,
              })),
            });
            await tx.project.update({
              where: { id },
              data: {
                totalLots: dto.plan.lots.length,
                totalBlocks: dto.plan.zones.filter(
                  (zone) => zone.kind === 'BLOCK',
                ).length,
                lotMode: 'INDIVIDUAL',
              },
            });
          }
          return {
            revision: dto.revision + 1,
            publishedAt: dto.publish ? new Date().toISOString() : null,
          };
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'El plano ya cambió. Recarga antes de guardar.',
        );
      throw error;
    }
  }

  async template() {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Lotes');
    sheet.addRow([
      'codigo',
      'manzana',
      'calle',
      'direccion',
      'area_m2',
      'perimetro_m',
      'frente_m',
      'dimensiones',
      'tipo',
      'precio_contado',
      'precio_m2',
      'estado',
      'contado',
      'financiado',
      'precio_financiado',
      'inicial',
      'cuotas',
      'cuota_mensual',
      'notas',
    ]);
    sheet.addRow([
      'L-01',
      'A',
      'Los Pinos',
      '',
      120,
      46,
      8,
      '8 x 15 m',
      'Interior',
      50000,
      416.67,
      'disponible',
      'si',
      'si',
      55000,
      10000,
      36,
      1250,
      '',
    ]);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 20;
    });
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async importExcel(buffer: Buffer) {
    const book = new ExcelJS.Workbook();
    try {
      await book.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException(
        'El archivo debe ser un Excel .xlsx válido',
      );
    }
    const sheet = book.worksheets[0];
    if (!sheet || sheet.rowCount > 5001 || sheet.columnCount > 60)
      throw new BadRequestException('Máximo 5000 lotes y 60 columnas');
    const headers = sheet.getRow(1).values as unknown[];
    const normalize = (v: unknown) =>
      String(v ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    const names = headers.map(normalize);
    for (const required of ['codigo', 'area_m2', 'precio_contado'])
      if (!names.includes(required))
        throw new BadRequestException(
          `Falta la columna ${required}. Usa la plantilla.`,
        );
    const rows: Record<string, string>[] = [];
    const errors: string[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const data: Record<string, string> = {};
      names.forEach((name, index) => {
        if (name) data[name] = row.getCell(index).text.trim();
      });
      if (!Object.values(data).some(Boolean)) return;
      const numeric = [
        'area_m2',
        'perimetro_m',
        'frente_m',
        'precio_contado',
        'precio_m2',
        'precio_financiado',
        'inicial',
        'cuotas',
        'cuota_mensual',
      ];
      for (const key of numeric) {
        const val = data[key]?.replace(',', '.') || '0';
        if (!Number.isFinite(Number(val)) || Number(val) < 0)
          errors.push(`Fila ${number}: ${key} inválido`);
        data[key] = val;
      }
      if (!data.codigo || Number(data.area_m2) <= 0)
        errors.push(
          `Fila ${number}: código y área mayor que cero obligatorios`,
        );
      if (
        data.estado &&
        ![
          'disponible',
          'reservado',
          'vendido',
          'bloqueado',
          'available',
          'reserved',
          'sold',
          'blocked',
        ].includes(normalize(data.estado))
      )
        errors.push(`Fila ${number}: estado inválido`);
      for (const key of ['contado', 'financiado'])
        if (
          data[key] &&
          !['si', 'no', 'true', 'false', '1', '0'].includes(
            normalize(data[key]),
          )
        )
          errors.push(`Fila ${number}: ${key} debe ser si o no`);
      rows.push(data);
    });
    if (errors.length)
      throw new BadRequestException(errors.slice(0, 20).join(' · '));
    if (!rows.length)
      throw new BadRequestException('El Excel no contiene lotes');
    return { rows };
  }

  async pdf(slug: string, lotId: string) {
    const plan = (await this.publicPlan(slug)) as unknown as SitePlanDto | null;
    if (!plan) throw new NotFoundException('Lote no encontrado');
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { slug },
      include: { location: true },
    });
    return this.renderLotPdf(plan, project, lotId);
  }

  async adminPdf(id: string, lotId: string, plan: SitePlanDto) {
    const session = await this.admin(id);
    return this.renderLotPdf(plan, session.project, lotId, true);
  }

  private async renderLotPdf(
    plan: SitePlanDto,
    project: Parameters<typeof renderLotSheetPdf>[0]['project'],
    lotId: string,
    draft = false,
  ) {
    const lot = plan.lots.find((item) => item.id === lotId);
    if (!lot) throw new NotFoundException('Lote no encontrado');
    if (
      plan.logoUrl &&
      !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(
        plan.logoUrl,
      )
    )
      throw new BadRequestException(
        'Sube el logo a la biblioteca del proyecto',
      );
    const appLogo = await readFile(join(process.cwd(), 'assets/ariz-logo.png')).catch(() => null);
    let projectLogo: Buffer | null = null;
    if (plan.logoUrl) {
      try {
        const pngUrl = plan.logoUrl.replace('/image/upload/', '/image/upload/f_png,w_500,c_limit/');
        const response = await fetch(pngUrl, { redirect: 'error', signal: AbortSignal.timeout(5000) });
        const bytes = Buffer.from(await response.arrayBuffer());
        if (response.ok && bytes.length < 5_000_000) projectLogo = bytes;
      } catch {
        // Project details remain available even if its optional logo cannot load.
      }
    }
    return renderLotSheetPdf({ lot, project, draft, appLogo, projectLogo });
  }
}
