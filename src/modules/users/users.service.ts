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
import { DeveloperReviewQueryDto } from './dto/developer-review-query.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly mail: MailService,
  ) {}

  async listProfessionals(
    status?: ApprovalStatus,
    page?: number,
    pageSize?: number,
  ) {
    const where: Prisma.ProfessionalProfileWhereInput = {
      type: { not: ProfessionalType.INDIVIDUAL_OWNER },
      status,
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
        where: { status },
        orderBy: { updatedAt: 'desc' as const },
      },
      projects: {
        where: { status: projectStatus },
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
        properties: { where: { status }, orderBy: { updatedAt: 'desc' } },
        projects: {
          where: { status: projectStatus },
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
        where: { status },
        orderBy: { updatedAt: 'desc' as const },
        select: { id: true, title: true, status: true },
      },
      projects: {
        where: { status: projectStatus },
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
          where: { status },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, status: true },
        },
        projects: {
          where: { status: projectStatus },
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

  async notifyProfessional(profileId: string) {
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
    });

    return { ok: true, email: profile.user.email };
  }
}
