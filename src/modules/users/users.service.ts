import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ApprovalStatus } from '../../generated/prisma/enums';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async listProfessionals(status?: ApprovalStatus, page?: number, pageSize?: number) {
    const where = status ? { status } : undefined;
    const include = {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
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

  async setProfessionalStatus(profileId: string, status: ApprovalStatus) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Perfil profesional no encontrado');
    const updated = await this.prisma.professionalProfile.update({
      where: { id: profileId },
      data: { status },
    });

    if (status === ApprovalStatus.APPROVED) {
      await this.plans.assignDefaultPlanIfNone(profileId);
    }

    return updated;
  }
}
