import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ChangeProfessionalPasswordDto } from './dto/change-professional-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

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
    const { firstName, phone, avatarUrl, ...profileFields } = dto;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
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

  async changePassword(userId: string, dto: ChangeProfessionalPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Cuenta no encontrada');
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
      select: { id: true },
    });
  }

  getNotificationSettings(userId: string) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
