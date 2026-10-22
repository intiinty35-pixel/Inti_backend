import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  ApprovalStatus,
  ProfessionalType,
  ProjectStatus,
  PropertyStatus,
} from '../../generated/prisma/enums';
import { PlansService } from '../plans/plans.service';
import { NotifyProfessionalDto } from './dto/notify-professional.dto';
import { DeveloperReviewQueryDto } from './dto/developer-review-query.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly mail: MailService,
  ) {}

  async profileDistribution() {
    const groups = await this.prisma.professionalProfile.groupBy({
      by: ['type'], where: { isDeleted: false }, _count: { _all: true },
    });
    return groups.map(group => ({ type: group.type, count: group._count._all }));
  }

  async listProfessionals(
    status?: ApprovalStatus,
    page?: number,
    pageSize?: number,
  ) {
    const where: Prisma.ProfessionalProfileWhereInput = {
      type: { not: ProfessionalType.INDIVIDUAL_OWNER },
      status,
      isDeleted: false,
    };
    const include = {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    };

    if (!page) {
      return this.prisma.professionalProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include,
      });
    }

    const size = Math.min(pageSize ?? 10, 50);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.professionalProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.professionalProfile.count({ where }),
    ]);

    return { items, total, page, pageSize: size, hasMore: page * size < total };
  }

  async listDevelopers(query: DeveloperReviewQueryDto) {
    const status = query.status ?? PropertyStatus.PENDING_REVIEW;
    const projectStatus = status as unknown as ProjectStatus;
    const where: Prisma.ProfessionalProfileWhereInput = {
      type: ProfessionalType.DEVELOPER,
      isDeleted: false,
      OR: [
        { properties: { some: { status } } },
        { projects: { some: { status: projectStatus } } },
      ],
    };
    const include = {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      properties: {
        where: { status, isDeleted: false },
        orderBy: { updatedAt: 'desc' as const },
      },
      projects: {
        where: { status: projectStatus, isDeleted: false },
        orderBy: { updatedAt: 'desc' as const },
      },
    };

    if (!query.page) {
      return this.prisma.professionalProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include,
      });
    }

    const size = Math.min(query.pageSize ?? 10, 50);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.professionalProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include,
        skip: (query.page - 1) * size,
        take: size,
      }),
      this.prisma.professionalProfile.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: size,
      hasMore: query.page * size < total,
    };
  }

  async getDeveloper(id: string, query: DeveloperReviewQueryDto) {
    const status = query.status ?? PropertyStatus.PENDING_REVIEW;
    const projectStatus = status as unknown as ProjectStatus;
    const developer = await this.prisma.professionalProfile.findFirst({
      where: { id, type: ProfessionalType.DEVELOPER },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        properties: { where: { status, isDeleted: false }, orderBy: { updatedAt: 'desc' } },
        projects: {
          where: { status: projectStatus, isDeleted: false },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!developer) throw new NotFoundException('Desarrolladora no encontrada');
    return developer;
  }

  async listAgencies(query: DeveloperReviewQueryDto) {
    const status = query.status ?? PropertyStatus.PENDING_REVIEW;
    const projectStatus = status as unknown as ProjectStatus;
    const where: Prisma.ProfessionalProfileWhereInput = {
      type: ProfessionalType.REAL_ESTATE_AGENCY,
      isDeleted: false,
    };
    const select = {
      id: true,
      type: true,
      status: true,
      businessName: true,
      whatsapp: true,
      city: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      properties: {
        where: { status, isDeleted: false },
        orderBy: { updatedAt: 'desc' as const },
        select: { id: true, title: true, status: true },
      },
      projects: {
        where: { status: projectStatus, isDeleted: false },
        orderBy: { updatedAt: 'desc' as const },
        select: { id: true, name: true, status: true },
      },
    };

    const size = Math.min(query.pageSize ?? 10, 50);
    const page = query.page ?? 1;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.professionalProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.professionalProfile.count({ where }),
    ]);

    return { items, total, page, pageSize: size, hasMore: page * size < total };
  }

  async getAgency(id: string, query: DeveloperReviewQueryDto) {
    const status = query.status ?? PropertyStatus.PENDING_REVIEW;
    const projectStatus = status as unknown as ProjectStatus;
    const agency = await this.prisma.professionalProfile.findFirst({
      where: { id, type: ProfessionalType.REAL_ESTATE_AGENCY },
      select: {
        id: true,
        type: true,
        status: true,
        businessName: true,
        whatsapp: true,
        city: true,
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        properties: {
          where: { status, isDeleted: false },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, status: true },
        },
        projects: {
          where: { status: projectStatus, isDeleted: false },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, status: true },
        },
      },
    });
    if (!agency) throw new NotFoundException('Inmobiliaria no encontrada');
    return agency;
  }

  async setProfessionalStatus(profileId: string, status: ApprovalStatus) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true, type: true },
    });
    if (!profile)
      throw new NotFoundException('Perfil profesional no encontrado');
    if (profile.type === ProfessionalType.INDIVIDUAL_OWNER) {
      throw new BadRequestException(
        'Los perfiles de propietario particular no requieren aprobación profesional',
      );
    }
    const updated = await this.prisma.professionalProfile.update({
      where: { id: profileId },
      data: { status },
    });

    if (status === ApprovalStatus.APPROVED) {
      await this.plans.assignDefaultPlanIfNone(profileId);
    }

    return updated;
  }

  async setOfficialDeveloper(profileId: string, isOfficialDeveloper: boolean) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });
    if (!profile)
      throw new NotFoundException('Perfil profesional no encontrado');

    return this.prisma.professionalProfile.update({
      where: { id: profileId },
      data: { isOfficialDeveloper },
    });
  }

  /**
   * Baja logica de una cuenta profesional (agente/inmobiliaria/desarrolladora)
   * desde el admin: no se borra ninguna fila. Se marca el perfil y el usuario
   * como eliminados (isActive=false bloquea login y sesiones activas via
   * JwtAuthGuard), y en cascada se marcan como eliminadas todas sus
   * propiedades y proyectos, para que dejen de aparecer en cualquier listado.
   */
  async deleteProfessionalAccount(profileId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, isDeleted: true },
    });
    if (!profile) throw new NotFoundException('Perfil profesional no encontrado');
    if (profile.isDeleted) return { id: profileId, deleted: true };

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.professionalProfile.update({
        where: { id: profileId },
        data: { isDeleted: true, deletedAt: now },
      }),
      this.prisma.user.update({
        where: { id: profile.userId },
        data: { isActive: false, deletedAt: now },
      }),
      this.prisma.property.updateMany({
        where: { agentProfileId: profileId, isDeleted: false },
        data: { isDeleted: true, deletedAt: now },
      }),
      this.prisma.project.updateMany({
        where: { agentProfileId: profileId, isDeleted: false },
        data: { isDeleted: true, deletedAt: now },
      }),
    ]);

    return { id: profileId, deleted: true };
  }

  async notifyProfessional(profileId: string, dto: NotifyProfessionalDto = {}) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      select: {
        businessName: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    const fullName = `${profile.user.firstName} ${profile.user.lastName ?? ''}`.trim();
    const name = (profile.businessName ?? fullName) || 'Usuario';

    await this.mail.sendAdminNotice({
      email: profile.user.email,
      name,
      subject: dto.subject,
      message: dto.message,
    });

    return { ok: true, email: profile.user.email };
  }
}
