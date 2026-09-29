import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ProjectStatus, PropertyStatus } from '../../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { OwnerLeadQueryDto } from './dto/owner-lead-query.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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
        include: {
          property: { select: { id: true, slug: true, title: true } },
          project: { select: { id: true, slug: true, name: true } },
        },
      });
    }

    const page = query.page;
    const pageSize = Math.min(query.pageSize ?? 10, 50);
    const where = { agentProfileId: agent.id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, slug: true, title: true } },
          project: { select: { id: true, slug: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: page * pageSize < total };
  }

  async create(dto: CreateLeadDto, user?: AuthUser) {
    if (Boolean(dto.propertyId) === Boolean(dto.projectId)) {
      throw new BadRequestException(
        'Indica una propiedad o un proyecto para enviar la consulta',
      );
    }

    const target = dto.propertyId
      ? await this.prisma.property.findFirst({
          where: { id: dto.propertyId, status: PropertyStatus.PUBLISHED },
          select: {
            id: true,
            slug: true,
            title: true,
            agentProfileId: true,
            contactEmail: true,
            contactName: true,
            agentProfile: {
              select: {
                businessName: true,
                user: {
                  select: { email: true, firstName: true, lastName: true },
                },
              },
            },
          },
        })
      : await this.prisma.project.findFirst({
          where: { id: dto.projectId!, status: ProjectStatus.PUBLISHED },
          select: {
            id: true,
            slug: true,
            name: true,
            agentProfileId: true,
            contactEmail: true,
            contactName: true,
            agentProfile: {
              select: {
                businessName: true,
                user: {
                  select: { email: true, firstName: true, lastName: true },
                },
              },
            },
          },
        });
    if (!target) {
      throw new NotFoundException(
        dto.propertyId ? 'Propiedad no encontrada' : 'Proyecto no encontrado',
      );
    }

    const publicationTitle = 'title' in target ? target.title : target.name;
    const publicationType = dto.projectId ? 'proyecto' : 'propiedad';
    const publicationUrl = dto.projectId
      ? `/project/${target.slug}`
      : `/propiedades/${target.slug}`;
    const ownerEmail = target.contactEmail ?? target.agentProfile.user.email;
    const ownerName =
      target.contactName ??
      target.agentProfile.businessName ??
      `${target.agentProfile.user.firstName} ${target.agentProfile.user.lastName ?? ''}`.trim();

    const lead = await this.prisma.lead.create({
      data: {
        propertyId: dto.propertyId ?? null,
        projectId: dto.projectId ?? null,
        agentProfileId: target.agentProfileId,
        userId: user?.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: dto.message,
        source: dto.source,
      },
    });

    void this.mail.sendLeadNotification({
      ownerEmail,
      ownerName,
      publicationType,
      publicationTitle,
      publicationUrl,
      leadName: dto.name,
      leadEmail: dto.email,
      leadPhone: dto.phone,
      message: dto.message,
    });

    return lead;
  }
}
