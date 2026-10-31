import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InvestmentOpportunityDto } from './dto/investment-opportunity.dto';
import { InvestmentTypeDto } from './dto/investment-type.dto';

@Injectable()
export class InvestmentOpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    const opportunities = await this.prisma.investmentOpportunity.findMany({
      where: { isPublished: true },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      include: { investmentType: true },
    });
    return opportunities.map((opportunity) => this.toResponse(opportunity));
  }

  async getPublicBySlug(slug: string) {
    const opportunity = await this.prisma.investmentOpportunity.findFirst({
      where: { slug, isPublished: true },
      include: { investmentType: true },
    });
    if (!opportunity) throw new NotFoundException('Oportunidad no encontrada');
    return this.toResponse(opportunity);
  }

  async listAdmin() {
    const opportunities = await this.prisma.investmentOpportunity.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      include: { investmentType: true },
    });
    return opportunities.map((opportunity) => this.toResponse(opportunity));
  }

  async getAdmin(id: string) {
    const opportunity = await this.prisma.investmentOpportunity.findUnique({
      where: { id },
      include: { investmentType: true },
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

  async listTypes(admin = false) {
    const types = await this.prisma.investmentType.findMany({
      where: admin ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return types.map((type) => ({ ...type }));
  }

  async createType(dto: InvestmentTypeDto) {
    const type = await this.prisma.investmentType.create({
      data: {
        ...this.toTypeData(dto),
        slug: await this.createUniqueTypeSlug(dto.name),
      },
    });
    return type;
  }

  async updateType(id: string, dto: InvestmentTypeDto) {
    const current = await this.prisma.investmentType.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!current) throw new NotFoundException('Tipo de inversión no encontrado');

    const slug =
      dto.name === current.name
        ? current.slug
        : await this.createUniqueTypeSlug(dto.name, id);

    return this.prisma.investmentType.update({
      where: { id },
      data: { ...this.toTypeData(dto), slug },
    });
  }

  async deleteType(id: string) {
    const result = await this.prisma.investmentType.deleteMany({ where: { id } });
    if (result.count === 0)
      throw new NotFoundException('Tipo de inversión no encontrado');
    return { id, deleted: true };
  }

  private toData(dto: InvestmentOpportunityDto) {
    return {
      name: dto.name.trim(),
      summary: dto.summary.trim(),
      description: dto.description.trim(),
      areaLabel: dto.areaLabel.trim(),
      investmentTypeId: dto.investmentTypeId || null,
      investmentKind: dto.investmentKind?.trim() || 'Inversión inmobiliaria',
      assetType: dto.assetType?.trim() || 'Proyecto',
      initialInvestment: dto.initialInvestment,
      currency: Currency.BOB,
      roiPercent: dto.roiPercent,
      estimatedReturnLabel: dto.estimatedReturnLabel?.trim() || null,
      estimatedTermMonths: dto.estimatedTermMonths ?? null,
      investmentGoal: dto.investmentGoal,
      status: dto.status ?? 'AVAILABLE',
      riskLevel: dto.riskLevel ?? null,
      featured: dto.featured ?? false,
      sortOrder: dto.sortOrder ?? 0,
      ctaLabel: dto.ctaLabel?.trim() || 'Solicitar información',
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
    investmentTypeId: string | null;
    investmentKind: string;
    assetType: string;
    initialInvestment: { toNumber(): number };
    currency: Currency;
    roiPercent: { toNumber(): number };
    estimatedReturnLabel: string | null;
    estimatedTermMonths: number | null;
    investmentGoal: string;
    status: string;
    riskLevel: string | null;
    featured: boolean;
    sortOrder: number;
    ctaLabel: string;
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
    investmentType?: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      isActive: boolean;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }) {
    return {
      ...opportunity,
      initialInvestment: opportunity.initialInvestment.toNumber(),
      roiPercent: opportunity.roiPercent.toNumber(),
      latitude: opportunity.latitude.toNumber(),
      longitude: opportunity.longitude.toNumber(),
    };
  }

  private toTypeData(dto: InvestmentTypeDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
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

  private async createUniqueTypeSlug(name: string, excludeId?: string) {
    const base = this.slugify(name);
    let slug = base || 'tipo-inversion';
    let suffix = 2;

    while (
      await this.prisma.investmentType.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
    ) {
      slug = `${base || 'tipo-inversion'}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
