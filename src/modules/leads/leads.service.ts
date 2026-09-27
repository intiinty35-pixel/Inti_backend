import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus } from '../../generated/prisma/enums';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: AuthUser) {
    const agent = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException('Tu cuenta no tiene un perfil profesional');
    }

    return this.prisma.lead.findMany({
      where: { agentProfileId: agent.id },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { id: true, slug: true, title: true } } },
    });
  }

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
