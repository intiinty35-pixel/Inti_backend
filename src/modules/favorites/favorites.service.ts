import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { id: true, slug: true, title: true } } },
    });
  }

  async toggle(user: AuthUser, propertyId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId: user.id, propertyId } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { active: false };
    }
    await this.prisma.favorite.create({ data: { userId: user.id, propertyId } });
    return { active: true };
  }
}
