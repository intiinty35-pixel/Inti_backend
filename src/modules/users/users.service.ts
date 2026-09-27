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

  listProfessionals(status?: ApprovalStatus) {
    return this.prisma.professionalProfile.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
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
