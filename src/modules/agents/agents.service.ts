import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus } from '../../generated/prisma/enums';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(slugOrId: string) {
    const profile = await this.prisma.professionalProfile.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        properties: {
          where: { status: PropertyStatus.PUBLISHED },
          orderBy: { publishedAt: 'desc' },
          include: {
            location: true,
            details: true,
            media: { orderBy: [{ isCover: 'desc' }, { position: 'asc' }] },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Agente no encontrado');

    return {
      id: profile.id,
      slug: profile.slug ?? profile.id,
      name: profile.businessName ?? `${profile.user.firstName} ${profile.user.lastName ?? ''}`.trim(),
      type: profile.type,
      status: profile.status,
      whatsapp: profile.whatsapp,
      phone: profile.user.phone,
      email: profile.user.email,
      city: profile.city,
      districts: profile.districts,
      address: profile.address,
      website: profile.website,
      properties: profile.properties.map((property) => ({
        id: property.id,
        slug: property.slug,
        title: property.title,
        description: property.description,
        price: { amount: Number(property.price), currency: property.currency },
        location: property.location
          ? {
              department: property.location.department,
              province: property.location.province,
              district: property.location.district,
            }
          : { department: '', province: '', district: '' },
        images: property.media.map((media) => media.url),
        rooms: property.details?.bedrooms ?? 0,
        bathrooms: property.details?.bathrooms ?? 0,
        parkingSpaces: property.details?.parkingSpaces ?? 0,
        areaM2: Number(property.details?.totalArea ?? property.details?.constructedArea ?? 0),
        operation: property.operationType === 'RENT' ? 'rent' : 'buy',
        type: 'apartments',
        status: 'disponible',
        publishedAt: property.publishedAt?.toISOString() ?? property.createdAt.toISOString(),
      })),
    };
  }
}
