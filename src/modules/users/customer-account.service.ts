import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@Injectable()
export class CustomerAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        biography: true,
        avatarUrl: true,
      },
    });
    if (!user) throw new NotFoundException('Cuenta no encontrada');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        biography: dto.biography,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        biography: true,
        avatarUrl: true,
      },
    });
    return user;
  }

  async changePassword(userId: string, dto: ChangeCustomerPasswordDto) {
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
}
