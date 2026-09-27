import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) throw new NotFoundException('Perfil profesional no encontrado');
    return profile;
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const profile = await this.getMe(userId);
    const { firstName, phone, ...profileFields } = dto;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
      }),
      this.prisma.professionalProfile.update({
        where: { id: profile.id },
        data: profileFields,
        include: { user: true },
      }),
    ]);

    return updated;
  }
}
