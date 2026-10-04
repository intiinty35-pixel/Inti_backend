import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InvestmentOpportunityDto } from './dto/investment-opportunity.dto';

@Injectable()
export class InvestmentOpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    const opportunities = await this.prisma.investmentOpportunity.findMany({
      where: { isPublished: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return opportunities.map((opportunity) => this.toResponse(opportunity));
  }

  async getPublicBySlug(slug: string) {
    const opportunity = await this.prisma.investmentOpportunity.findFirst({
      where: { slug, isPublished: true },
    });
    if (!opportunity) throw new NotFoundException('Oportunidad no encontrada');
    return this.toResponse(opportunity);
  }

  async listAdmin() {
    const opportunities = await this.prisma.investmentOpportunity.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
    return opportunities.map((opportunity) => this.toResponse(opportunity));
  }

  async getAdmin(id: string) {
    const opportunity = await this.prisma.investmentOpportunity.findUnique({
      where: { id },
    });
    if (!opportunity) throw new NotFoundException('Oportunidad no encontrada');
    return this.toResponse(opportunity);
  }

  async create(dto: InvestmentOpportunityDto) {
    const opportunity = await this.prisma.investmentOpportunity.create({
      data: {
        ...this.toData(dto),
        slug: await this.createUniqueSlug(dto.name),
      },
    });
    return this.toResponse(opportunity);
  }

  async update(id: string, dto: InvestmentOpportunityDto) {
    const current = await this.prisma.investmentOpportunity.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true },
    });
    if (!current) throw new NotFoundException('Oportunidad no encontrada');

    const slug =
      dto.name === current.name
        ? current.slug
        : await this.createUniqueSlug(dto.name, id);
    const opportunity = await this.prisma.investmentOpportunity.update({
      where: { id },
      data: { ...this.toData(dto), slug },
    });
    return this.toResponse(opportunity);
  }

  async delete(id: string) {
    const result = await this.prisma.investmentOpportunity.deleteMany({
      where: { id },
    });
    if (result.count === 0)
      throw new NotFoundException('Oportunidad no encontrada');
    return { id, deleted: true };
  }

  private toData(dto: InvestmentOpportunityDto) {
    return {
      name: dto.name.trim(),
      summary: dto.summary.trim(),
      description: dto.description.trim(),
      areaLabel: dto.areaLabel.trim(),
      initialInvestment: dto.initialInvestment,
      currency: Currency.PEN,
      roiPercent: dto.roiPercent,
      investmentGoal: dto.investmentGoal,
      location: dto.location.trim(),
      department: dto.department.trim(),
      province: dto.province.trim(),
      district: dto.district.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      coverImageUrl: dto.coverImageUrl,
      coverImagePublicId: dto.coverImagePublicId,
      galleryImages: dto.galleryImages ?? [],
      highlights: dto.highlights ?? [],
      isPublished: dto.isPublished ?? true,
    };
  }

  private toResponse(opportunity: {
    id: string;
    name: string;
    slug: string;
    summary: string;
    description: string;
    areaLabel: string;
    initialInvestment: { toNumber(): number };
    currency: Currency;
    roiPercent: { toNumber(): number };
    investmentGoal: string;
    location: string;
    department: string;
    province: string;
    district: string;
    latitude: { toNumber(): number };
    longitude: { toNumber(): number };
    coverImageUrl: string;
    coverImagePublicId: string | null;
    galleryImages: string[];
    highlights: string[];
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...opportunity,
      initialInvestment: opportunity.initialInvestment.toNumber(),
      roiPercent: opportunity.roiPercent.toNumber(),
      latitude: opportunity.latitude.toNumber(),
      longitude: opportunity.longitude.toNumber(),
    };
  }

  private async createUniqueSlug(name: string, excludeId?: string) {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    let slug = base || 'oportunidad';
    let suffix = 2;

    while (
      await this.prisma.investmentOpportunity.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
    ) {
      slug = `${base || 'oportunidad'}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }
}
