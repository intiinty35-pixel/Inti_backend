import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { IncentiveStatus } from '../../generated/prisma/enums';
import { CreateIncentiveDto } from './dto/create-incentive.dto';
import { IncentiveQueryDto } from './dto/incentive-query.dto';
import { UpdateIncentiveDto } from './dto/update-incentive.dto';

@Injectable()
export class IncentivesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: IncentiveQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = {
      isDeleted: false,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [incentives, total] = await Promise.all([
      this.prisma.incentive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incentive.count({ where }),
    ]);

    return {
      items: incentives,
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const incentive = await this.prisma.incentive.findUnique({
      where: { id },
    });
    if (!incentive || incentive.isDeleted) {
      throw new NotFoundException('Incentivo no encontrado');
    }
    return incentive;
  }

  async create(dto: CreateIncentiveDto) {
    return this.prisma.incentive.create({
      data: {
        name: dto.name.trim(),
        description: dto.description.trim(),
        promotion: dto.promotion?.trim(),
        imageUrl: dto.imageUrl,
        publicId: dto.publicId,
        pointsRequired: dto.pointsRequired,
        stock: dto.stock,
        status: IncentiveStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateIncentiveDto) {
    const incentive = await this.prisma.incentive.findUnique({
      where: { id },
    });

    if (!incentive || incentive.isDeleted) {
      throw new NotFoundException('Incentivo no encontrado');
    }

    return this.prisma.incentive.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        promotion: dto.promotion?.trim(),
        imageUrl: dto.imageUrl,
        publicId: dto.publicId,
        pointsRequired: dto.pointsRequired,
        stock: dto.stock,
      },
    });
  }

  async updateStatus(id: string, status: IncentiveStatus) {
    const incentive = await this.prisma.incentive.findUnique({
      where: { id },
    });

    if (!incentive || incentive.isDeleted) {
      throw new NotFoundException('Incentivo no encontrado');
    }

    return this.prisma.incentive.update({
      where: { id },
      data: { status },
    });
  }

  async softDelete(id: string) {
    const incentive = await this.prisma.incentive.findUnique({
      where: { id },
    });

    if (!incentive || incentive.isDeleted) {
      throw new NotFoundException('Incentivo no encontrado');
    }

    const hasRedemptions = await this.prisma.redemption.count({
      where: { incentiveId: id },
    });

    if (hasRedemptions > 0) {
      throw new ConflictException(
        'No se puede eliminar un incentivo con canjes asociados',
      );
    }

    return this.prisma.incentive.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async getActiveIncentives() {
    return this.prisma.incentive.findMany({
      where: {
        status: IncentiveStatus.ACTIVE,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
