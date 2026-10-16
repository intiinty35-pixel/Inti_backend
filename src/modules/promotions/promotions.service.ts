import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.promotion.findMany({ orderBy: { startsAt: 'desc' } });
  }

  async get(id: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw new NotFoundException('Promoción no encontrada');
    return promotion;
  }

  create(dto: CreatePromotionDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertRange(startsAt, endsAt);

    return this.prisma.promotion.create({
      data: {
        title: dto.title.trim(),
        imageUrl: dto.imageUrl,
        publicId: dto.publicId,
        startsAt,
        endsAt,
      },
    });
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const current = await this.get(id);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.assertRange(startsAt, endsAt);

    return this.prisma.promotion.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        imageUrl: dto.imageUrl,
        publicId: dto.publicId,
        startsAt,
        endsAt,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.promotion.delete({ where: { id } });
    return { ok: true };
  }

  /** Promociones vigentes ahora: activas y dentro de su rango de fechas. */
  listCurrent() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: 'desc' },
      select: { id: true, title: true, imageUrl: true },
    });
  }

  private assertRange(startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la de inicio');
    }
  }
}
