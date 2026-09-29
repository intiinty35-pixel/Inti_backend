import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus } from '../../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { CreatePriceAlertDto, CreateSearchAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  createSearch(user: AuthUser, dto: CreateSearchAlertDto) {
    return this.prisma.searchAlert.create({
      data: { userId: user.id, name: dto.name, filters: dto.filters },
    });
  }

  async createPrice(user: AuthUser, dto: CreatePriceAlertDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, status: PropertyStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        currency: true,
        contactEmail: true,
        contactName: true,
        agentProfile: {
          select: {
            businessName: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    const alert = await this.prisma.priceAlert.upsert({
      where: { userId_propertyId: { userId: user.id, propertyId: dto.propertyId } },
      update: { targetPrice: dto.targetPrice, isActive: true },
      create: { userId: user.id, propertyId: dto.propertyId, targetPrice: dto.targetPrice },
    });

    const ownerEmail = property.contactEmail ?? property.agentProfile.user.email;
    const ownerName =
      property.contactName ??
      property.agentProfile.businessName ??
      `${property.agentProfile.user.firstName} ${property.agentProfile.user.lastName ?? ''}`.trim();

    void this.mail.sendPriceAlertToOwner({
      ownerEmail,
      ownerName,
      propertyTitle: property.title,
      propertyUrl: `/propiedades/${property.slug}`,
      userName: user.name,
      userEmail: user.email,
      targetPrice: dto.targetPrice ? `${property.currency} ${dto.targetPrice}` : null,
    });

    return alert;
  }
}
