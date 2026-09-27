import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus } from '../../generated/prisma/enums';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto, user?: AuthUser) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, status: PropertyStatus.PUBLISHED },
      select: { id: true, agentProfileId: true },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    return this.prisma.lead.create({
      data: {
        propertyId: property.id,
        agentProfileId: property.agentProfileId,
        userId: user?.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: dto.message,
        source: dto.source,
      },
    });
  }
}
