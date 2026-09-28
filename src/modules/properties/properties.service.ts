import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  ApprovalStatus,
  AmenityCategory,
  OperationType,
  PropertyStatus,
  PropertyType,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { OwnerPropertyQueryDto } from './dto/owner-property-query.dto';
import { PropertyQueryDto, PropertySort } from './dto/property-query.dto';

const PROPERTY_INCLUDE = {
  location: true,
  details: true,
  media: { orderBy: [{ isCover: 'desc' }, { position: 'asc' }] },
  amenities: { include: { amenity: true } },
  agentProfile: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  },
} satisfies Prisma.PropertyInclude;

type PropertyWithRelations = Prisma.PropertyGetPayload<{ include: typeof PROPERTY_INCLUDE }>;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: PropertyQueryDto) {
    await this.expireMembershipIfNeeded();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const where = this.buildPublicWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        orderBy,
        include: PROPERTY_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((property) => this.toListing(property)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getPublicBySlug(slug: string) {
    await this.expireMembershipIfNeeded();

    const property = await this.prisma.property.findFirst({
      where: { slug, status: PropertyStatus.PUBLISHED },
      include: PROPERTY_INCLUDE,
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    return this.toDetail(property);
  }

  async listMine(user: AuthUser, query: OwnerPropertyQueryDto = {}) {
    const agent = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) return query.page ? { items: [], total: 0, page: 1, pageSize: query.pageSize ?? 9, hasMore: false } : [];

    if (!query.page) {
      const properties = await this.prisma.property.findMany({
        where: { agentProfileId: agent.id },
        orderBy: [{ updatedAt: 'desc' }],
        include: PROPERTY_INCLUDE,
      });
      return properties.map((property) => this.toDetail(property));
    }

    const page = query.page;
    const pageSize = Math.min(query.pageSize ?? 9, 50);
    const where = { agentProfileId: agent.id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        include: PROPERTY_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((property) => this.toDetail(property)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async createDraft(user: AuthUser, dto: CreatePropertyDto) {
    const agent = await this.requireApprovedAgent(user.id);
    this.validateProperty(dto);

    const slug = await this.createUniqueSlug(dto.title);
    const property = await this.prisma.property.create({
      data: {
        agentProfileId: agent.id,
        operationType: dto.operationType,
        propertyType: dto.propertyType,
        slug,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        negotiable: dto.negotiable ?? false,
        maintenanceFee: dto.maintenanceFee,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        contactWhatsapp: dto.contactWhatsapp,
        location: { create: dto.location },
        details: {
          create: {
            totalArea: dto.details.totalArea,
            constructedArea: dto.details.constructedArea,
            bedrooms: dto.details.bedrooms,
            bathrooms: dto.details.bathrooms,
            halfBathrooms: dto.details.halfBathrooms,
            parkingSpaces: dto.details.parkingSpaces,
            floor: dto.details.floor,
            floors: dto.details.floors,
            constructionYear: dto.details.constructionYear,
            conservationStatus: dto.details.conservationStatus,
            specificDetails: dto.details.specificDetails as Prisma.InputJsonValue | undefined,
          },
        },
        media: {
          create: dto.media.map((media, index) => ({
            url: media.url,
            publicId: media.publicId,
            position: media.position ?? index,
            isCover: media.isCover ?? index === 0,
          })),
        },
        amenities: dto.amenityCodes?.length
          ? {
              create: dto.amenityCodes.map((code) => ({
                amenity: {
                  connectOrCreate: {
                    where: { code },
                    create: {
                      code,
                      name: this.humanizeAmenity(code),
                      category: AmenityCategory.INTERIOR,
                    },
                  },
                },
              })),
            }
          : undefined,
      },
      include: PROPERTY_INCLUDE,
    });

    return this.toDetail(property);
  }

  async publish(user: AuthUser, id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { agentProfile: true, location: true, details: true, media: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');
    if (property.agentProfile.userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('No puedes publicar esta propiedad');
    }
    if (property.agentProfile.status !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu perfil anunciante debe estar aprobado');
    }
    if (!property.location || !property.details || property.media.length === 0) {
      throw new BadRequestException('Falta completar ubicación, características o fotos');
    }

    await this.expireMembershipIfNeeded(property.agentProfile.id);
    await this.ensureCanPublish(property.agentProfile.id, property.id);

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.PUBLISHED, publishedAt: new Date() },
      include: PROPERTY_INCLUDE,
    });
    return this.toDetail(updated);
  }

  private buildPublicWhere(query: PropertyQueryDto): Prisma.PropertyWhereInput {
    return {
      status: PropertyStatus.PUBLISHED,
      operationType: query.operationType,
      propertyType: query.propertyType,
      currency: query.currency,
      price: {
        gte: query.priceMin,
        lte: query.priceMax,
      },
      location: {
        department: query.department,
        province: query.province,
        district: query.district,
      },
      details: {
        bedrooms: query.bedroomsMin === undefined ? undefined : { gte: query.bedroomsMin },
        bathrooms: query.bathroomsMin === undefined ? undefined : { gte: query.bathroomsMin },
        totalArea:
          query.areaMin === undefined && query.areaMax === undefined
            ? undefined
            : { gte: query.areaMin, lte: query.areaMax },
      },
    };
  }

  private buildOrderBy(sort?: PropertySort): Prisma.PropertyOrderByWithRelationInput[] {
    if (sort === PropertySort.PRICE_ASC) return [{ price: 'asc' }];
    if (sort === PropertySort.PRICE_DESC) return [{ price: 'desc' }];
    if (sort === PropertySort.FEATURED) return [{ featured: 'desc' }, { publishedAt: 'desc' }];
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }

  private async requireApprovedAgent(userId: string) {
    const agent = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!agent) throw new ForbiddenException('Completa tu perfil anunciante para publicar');
    if (agent.status !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu perfil anunciante debe estar aprobado');
    }
    return agent;
  }

  private async expireMembershipIfNeeded(agentProfileId?: string) {
    const now = new Date();
    const expiredSubscriptions = await this.prisma.planSubscription.findMany({
      where: {
        agentProfileId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lt: now },
      },
      select: { id: true, agentProfileId: true },
    });

    if (expiredSubscriptions.length === 0) return;

    await this.prisma.$transaction([
      this.prisma.planSubscription.updateMany({
        where: { id: { in: expiredSubscriptions.map((subscription) => subscription.id) } },
        data: { status: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.property.updateMany({
        where: {
          agentProfileId: { in: [...new Set(expiredSubscriptions.map((subscription) => subscription.agentProfileId))] },
          status: PropertyStatus.PUBLISHED,
        },
        data: { status: PropertyStatus.PAUSED },
      }),
    ]);
  }

  private async ensureCanPublish(agentProfileId: string, propertyId: string) {
    const now = new Date();
    const subscription = await this.prisma.planSubscription.findFirst({
      where: {
        agentProfileId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) {
      throw new ForbiddenException('Necesitas una membresia activa para publicar propiedades');
    }

    const publishedCount = await this.prisma.property.count({
      where: {
        agentProfileId,
        id: { not: propertyId },
        status: PropertyStatus.PUBLISHED,
      },
    });

    if (publishedCount >= subscription.plan.propertyLimit) {
      throw new BadRequestException(
        `Tu paquete permite publicar hasta ${subscription.plan.propertyLimit} propiedades activas`,
      );
    }
  }

  private validateProperty(dto: CreatePropertyDto) {
    if (dto.details.constructedArea && dto.details.totalArea && dto.details.constructedArea > dto.details.totalArea) {
      throw new BadRequestException('El área construida no puede superar el área total');
    }
    const requiresBedrooms: PropertyType[] = [PropertyType.APARTMENT, PropertyType.HOUSE, PropertyType.ROOM];
    if (requiresBedrooms.includes(dto.propertyType) && dto.details.bedrooms === undefined) {
      throw new BadRequestException('Falta completar dormitorios');
    }
    if (dto.media.filter((media) => media.isCover).length > 1) {
      throw new BadRequestException('Solo una foto puede ser portada');
    }
  }

  private async createUniqueSlug(title: string) {
    const base = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'propiedad'}-${suffix}`;
  }

  private humanizeAmenity(code: string) {
    return code
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private toListing(property: PropertyWithRelations) {
    const cover = property.media.find((media) => media.isCover) ?? property.media[0];
    return {
      id: property.id,
      slug: property.slug,
      title: property.title,
      description: property.description,
      operation: this.toFrontendOperation(property.operationType),
      type: this.toFrontendType(property.propertyType),
      price: {
        amount: Number(property.price),
        currency: property.currency,
        period: property.operationType === OperationType.RENT ? 'mensual' : 'total',
      },
      location: property.location
        ? {
            department: property.location.department,
            province: property.location.province,
            district: property.location.district,
            address: property.location.approximateLocation ? undefined : property.location.address,
            lat: property.location.latitude ? Number(property.location.latitude) : undefined,
            lng: property.location.longitude ? Number(property.location.longitude) : undefined,
          }
        : { department: '', province: '', district: '' },
      images: property.media.map((media) => media.url),
      rooms: property.details?.bedrooms ?? 0,
      bathrooms: property.details?.bathrooms ?? 0,
      parkingSpaces: property.details?.parkingSpaces ?? 0,
      areaM2: Number(property.details?.totalArea ?? property.details?.constructedArea ?? 0),
      status: this.toFrontendStatus(property.status),
      publishedAt: property.publishedAt?.toISOString() ?? property.createdAt.toISOString(),
      featured: property.featured,
      coverImage: cover?.url,
    };
  }

  private toDetail(property: PropertyWithRelations) {
    return {
      ...this.toListing(property),
      maintenanceFee: property.maintenanceFee ? Number(property.maintenanceFee) : null,
      negotiable: property.negotiable,
      details: property.details,
      amenities: property.amenities.map(({ amenity }) => amenity),
      agent: {
        id: property.agentProfile.id,
        name: property.agentProfile.businessName ?? `${property.agentProfile.user.firstName} ${property.agentProfile.user.lastName ?? ''}`.trim(),
        type: property.agentProfile.type,
        status: property.agentProfile.status,
        whatsapp: property.agentProfile.whatsapp,
        phone: property.agentProfile.user.phone,
        email: property.agentProfile.user.email,
      },
    };
  }

  private toFrontendOperation(operation: OperationType) {
    if (operation === OperationType.RENT) return 'rent';
    if (operation === OperationType.SALE) return 'buy';
    return 'invest';
  }

  private toFrontendType(type: PropertyType) {
    const map = {
      [PropertyType.APARTMENT]: 'apartments',
      [PropertyType.HOUSE]: 'houses',
      [PropertyType.LAND]: 'land',
      [PropertyType.OFFICE]: 'commercial',
      [PropertyType.COMMERCIAL]: 'commercial',
      [PropertyType.WAREHOUSE]: 'commercial',
      [PropertyType.ROOM]: 'apartments',
      [PropertyType.PARKING]: 'commercial',
    } as const;
    return map[type];
  }

  private toFrontendStatus(status: PropertyStatus) {
    if (status === PropertyStatus.SOLD) return 'vendido';
    if (status === PropertyStatus.RENTED) return 'alquilado';
    if (status === PropertyStatus.PAUSED) return 'reservado';
    return 'disponible';
  }
}
