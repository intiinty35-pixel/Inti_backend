import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { ClaimQueryDto } from './dto/claim-query.dto';

@Injectable()
export class ClaimsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateClaimDto) {
    const claimCode = await this.generateClaimCode();

    return this.prisma.claim.create({
      data: {
        claimCode,
        fullName: dto.fullName.trim(),
        address: dto.address.trim(),
        dniOrCe: dto.dniOrCe.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email.trim().toLowerCase(),
        parentGuardian: dto.parentGuardian?.trim() || null,
        assetType: dto.assetType.trim(),
        claimedAmount: dto.claimedAmount,
        assetDescription: dto.assetDescription.trim(),
        type: dto.type,
        claimDetails: dto.claimDetails.trim(),
        consumerRequest: dto.consumerRequest.trim(),
      },
    });
  }

  async list(query: ClaimQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = { isDeleted: false };

    const [items, total] = await Promise.all([
      this.prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.claim.count({ where }),
    ]);

    return {
      items: items.map((claim) => this.toClaimResponse(claim)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, isDeleted: false },
    });

    if (!claim) {
      throw new NotFoundException('Reclamo no encontrado');
    }

    return this.toClaimResponse(claim);
  }

  async softDelete(id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, isDeleted: false },
    });

    if (!claim) {
      throw new NotFoundException('Reclamo no encontrado');
    }

    await this.prisma.claim.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async generateClaimCode(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<{ max: string | null }[]>`
        SELECT MAX("claimCode") as max FROM "claims"
      `;
      const lastCode = result[0]?.max;
      let nextNum = 1;
      if (lastCode) {
        const match = lastCode.match(/REC-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      return `REC-${String(nextNum).padStart(4, '0')}`;
    });
  }

  private toClaimResponse(claim: any) {
    return {
      id: claim.id,
      claimCode: claim.claimCode,
      fullName: claim.fullName,
      address: claim.address,
      dniOrCe: claim.dniOrCe,
      phone: claim.phone,
      email: claim.email,
      parentGuardian: claim.parentGuardian,
      assetType: claim.assetType,
      claimedAmount: claim.claimedAmount,
      assetDescription: claim.assetDescription,
      type: claim.type,
      claimDetails: claim.claimDetails,
      consumerRequest: claim.consumerRequest,
      createdAt: claim.createdAt.toISOString(),
    };
  }

  async exportPdf(): Promise<Buffer> {
    const claims = await this.prisma.claim.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const typeLabels: Record<string, string> = { Claim: 'Reclamo', Complaint: 'Queja' };

      const startX = 40;
      const colWidths = [110, 240, 110, 170, 131]; // Suma 761 pt (ocupa el ancho útil)
      const headers = ['Código', 'Consumidor', 'Tipo', 'Bien', 'Fecha'];
      const rowHeight = 26;

      const renderHeader = (currentY: number) => {
        doc.save();
        doc.rect(startX, currentY, 761, rowHeight).fill('#0f2e5c');
        doc.restore();

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
        let xPos = startX;
        headers.forEach((header, i) => {
          doc.text(header, xPos, currentY + 8, {
            width: colWidths[i],
            align: 'center',
          });
          xPos += colWidths[i];
        });
        doc.fillColor('#000000');
      };

      doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f2e5c').text('Libro de Reclamaciones', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#555555').text(`Generado: ${new Date().toLocaleDateString('es-BO')}`, { align: 'center' });
      doc.moveDown(1.5);

      let currentY = doc.y;
      renderHeader(currentY);
      currentY += rowHeight;

      doc.fontSize(9).font('Helvetica');

      claims.forEach((claim, index) => {
        if (currentY > 500) {
          doc.addPage();
          currentY = 40;
          renderHeader(currentY);
          currentY += rowHeight;
        }

        if (index % 2 === 0) {
          doc.save();
          doc.rect(startX, currentY, 761, rowHeight).fill('#f8f9fa');
          doc.restore();
        }

        const values = [
          claim.claimCode,
          claim.fullName,
          typeLabels[claim.type] || claim.type,
          claim.assetType,
          new Date(claim.createdAt).toLocaleDateString('es-BO'),
        ];

        let xPos = startX;
        values.forEach((val, i) => {
          const align = i === 0 || i === 2 || i === 4 ? 'center' : 'left';
          const paddingLeft = align === 'left' ? 8 : 0;

          doc.fillColor('#333333').text(val || '-', xPos + paddingLeft, currentY + 7, {
            width: colWidths[i] - (paddingLeft * 2),
            align,
            height: rowHeight - 7,
            ellipsis: true,
          });
          xPos += colWidths[i];
        });

        doc.save();
        doc.moveTo(startX, currentY + rowHeight)
          .lineTo(startX + 761, currentY + rowHeight)
          .strokeColor('#e5e7eb')
          .lineWidth(0.5)
          .stroke();
        doc.restore();

        currentY += rowHeight;
      });

      if (claims.length === 0) {
        doc.moveDown(2);
        doc.fontSize(11).fillColor('#777777').text('No hay reclamos registrados.', { align: 'center' });
      }

      doc.end();
    });
  }
}

