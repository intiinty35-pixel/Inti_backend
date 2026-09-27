import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePriceAlertDto, CreateSearchAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  createSearch(user: AuthUser, dto: CreateSearchAlertDto) {
    return this.prisma.searchAlert.create({
      data: { userId: user.id, name: dto.name, filters: dto.filters },
    });
  }

  createPrice(user: AuthUser, dto: CreatePriceAlertDto) {
    return this.prisma.priceAlert.upsert({
      where: { userId_propertyId: { userId: user.id, propertyId: dto.propertyId } },
      update: { targetPrice: dto.targetPrice, isActive: true },
      create: { userId: user.id, propertyId: dto.propertyId, targetPrice: dto.targetPrice },
    });
  }
}
