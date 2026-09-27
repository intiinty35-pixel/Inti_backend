import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus } from '../../generated/prisma/enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { OwnerLeadQueryDto } from './dto/owner-lead-query.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: AuthUser, query: OwnerLeadQueryDto = {}) {
    const agent = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException('Tu cuenta no tiene un perfil profesional');
    }

    if (!query.page) {
      return this.prisma.lead.findMany({
        where: { agentProfileId: agent.id },
        orderBy: { createdAt: 'desc' },
        include: { property: { select: { id: true, slug: true, title: true } } },
      });
    }

    const page = query.page;
    const pageSize = Math.min(query.pageSize ?? 10, 50);
    const where = { agentProfileId: agent.id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { property: { select: { id: true, slug: true, title: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: page * pageSize < total };
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
