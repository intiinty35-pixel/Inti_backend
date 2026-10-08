import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { ClaimQueryDto } from './dto/claim-query.dto';

@Injectable()
export class ClaimsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

