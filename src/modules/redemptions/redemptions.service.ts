import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  IncentiveStatus,
  PointMovementType,
  RedemptionStatus,
} from '../../generated/prisma/enums';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionQueryDto } from './dto/redemption-query.dto';

@Injectable()
export class RedemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async validateReferrerAccess(referralCode: string) {
    const normalizedCode = referralCode.trim().toUpperCase();

    const referrer = await this.prisma.referrer.findUnique({
      where: { code: normalizedCode },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!referrer) {
      return { valid: false, message: 'Código de referente no válido' };
    }

    const totalPoints = await this.calculateReferrerPoints(referrer.id);

    return {
      valid: true,
      referrer: {
        ...referrer,
        totalPoints,
      },
    };
  }

  async getActiveIncentives() {
    return this.prisma.incentive.findMany({
      where: {
        status: IncentiveStatus.ACTIVE,
        isDeleted: false,
        stock: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRedemption(dto: CreateRedemptionDto, processedById?: string | null) {
    const normalizedCode = dto.referralCode.trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const referrer = await tx.referrer.findUnique({
        where: { code: normalizedCode },
      });

      if (!referrer) {
        throw new NotFoundException('Referente no encontrado');
      }

      const incentive = await tx.incentive.findUnique({
        where: { id: dto.incentiveId },
      });

      if (!incentive || incentive.isDeleted) {
        throw new NotFoundException('Incentivo no encontrado');
      }

      if (incentive.status !== IncentiveStatus.ACTIVE) {
        throw new BadRequestException('El incentivo no está activo');
      }

      if (incentive.stock <= 0) {
        throw new ConflictException('Incentivo agotado');
      }

      const totalPoints = await this.calculateReferrerPoints(referrer.id);
      const totalRequired = incentive.pointsRequired * dto.quantity;

      if (totalPoints < totalRequired) {
        throw new BadRequestException(
          `Puntos insuficientes. Tienes ${totalPoints} puntos, necesitas ${totalRequired}`,
        );
      }

      const redemption = await tx.redemption.create({
        data: {
          referrerId: referrer.id,
          referralCode: normalizedCode,
          incentiveId: incentive.id,
          incentiveName: incentive.name,
          incentiveImageUrl: incentive.imageUrl,
          pointsSpent: totalRequired,
          status: RedemptionStatus.PENDING,
          requestedAt: new Date(),
        },
      });

      await tx.pointMovement.create({
        data: {
          referrerId: referrer.id,
          points: -totalRequired,
          type: PointMovementType.POINTS_REDEEMED,
          referenceId: redemption.id,
          description: `Canje: ${incentive.name} x${dto.quantity}`,
        },
      });

      await tx.incentive.update({
        where: { id: incentive.id },
        data: { stock: { decrement: dto.quantity } },
      });

      const updatedPoints = await this.calculateReferrerPoints(referrer.id);

      await this.mail.sendRedemptionRequested({
        referrerName: referrer.name,
        referrerEmail: referrer.email,
        incentiveName: incentive.name,
        pointsSpent: totalRequired,
        remainingPoints: updatedPoints,
      });

      return redemption;
    });
  }

  async list(query: RedemptionQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: any = {
      isDeleted: false,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.minPoints !== undefined || query.maxPoints !== undefined) {
      where.pointsSpent = {};
      if (query.minPoints !== undefined) where.pointsSpent.gte = query.minPoints;
      if (query.maxPoints !== undefined) where.pointsSpent.lte = query.maxPoints;
    }

    const [redemptions, total] = await Promise.all([
      this.prisma.redemption.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
              email: true,
              code: true,
            },
          },
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.redemption.count({ where }),
    ]);

    return {
      items: redemptions,
      total,
      page,
      pageSize,
    };
  }

  async getRedemption(id: string) {
    const redemption = await this.prisma.redemption.findUnique({
      where: { id },
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            code: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        pointMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!redemption || redemption.isDeleted) {
      throw new NotFoundException('Canje no encontrado');
    }

    return redemption;
  }

  async getMyRedemptions(referralCode: string) {
    const normalizedCode = referralCode.trim().toUpperCase();

    const referrer = await this.prisma.referrer.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    });

    if (!referrer) {
      throw new NotFoundException('Referente no encontrado');
    }

    return this.prisma.redemption.findMany({
      where: {
        referrerId: referrer.id,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        pointMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async approveRedemption(id: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.redemption.findUnique({
        where: { id },
        include: { referrer: true },
      });

      if (!redemption || redemption.isDeleted) {
        throw new NotFoundException('Canje no encontrado');
      }

      if (redemption.status !== RedemptionStatus.PENDING) {
        throw new ConflictException(
          `No se puede aprobar un canje en estado ${redemption.status}`,
        );
      }

      const updated = await tx.redemption.update({
        where: { id },
        data: {
          status: RedemptionStatus.APPROVED,
          processedAt: new Date(),
          processedById: adminId,
        },
        include: { referrer: true },
      });

      await this.mail.sendRedemptionApproved({
        referrerName: updated.referrer.name,
        referrerEmail: updated.referrer.email,
        incentiveName: updated.incentiveName,
        pointsSpent: updated.pointsSpent,
      });

      return updated;
    });
  }

  async rejectRedemption(id: string, adminId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.redemption.findUnique({
        where: { id },
        include: { referrer: true },
      });

      if (!redemption || redemption.isDeleted) {
        throw new NotFoundException('Canje no encontrado');
      }

      if (redemption.status !== RedemptionStatus.PENDING) {
        throw new ConflictException(
          `No se puede rechazar un canje en estado ${redemption.status}`,
        );
      }

      const updated = await tx.redemption.update({
        where: { id },
        data: {
          status: RedemptionStatus.REJECTED,
          rejectedAt: new Date(),
          processedAt: new Date(),
          processedById: adminId,
          rejectionReason: reason,
        },
        include: { referrer: true },
      });

      await tx.pointMovement.create({
        data: {
          referrerId: redemption.referrerId,
          points: redemption.pointsSpent,
          type: PointMovementType.POINTS_REFUNDED,
          referenceId: redemption.id,
          description: `Devolución por canje rechazado: ${redemption.incentiveName}`,
        },
      });

      await tx.incentive.update({
        where: { id: redemption.incentiveId },
        data: { stock: { increment: 1 } },
      });

      const updatedPoints = await this.calculateReferrerPoints(redemption.referrerId);

      await this.mail.sendRedemptionRejected({
        referrerName: updated.referrer.name,
        referrerEmail: updated.referrer.email,
        incentiveName: updated.incentiveName,
        pointsRefunded: redemption.pointsSpent,
        newBalance: updatedPoints,
        reason,
      });

      return updated;
    });
  }

  async deliverRedemption(id: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.redemption.findUnique({
        where: { id },
        include: { referrer: true },
      });

      if (!redemption || redemption.isDeleted) {
        throw new NotFoundException('Canje no encontrado');
      }

      if (redemption.status !== RedemptionStatus.APPROVED) {
        throw new ConflictException(
          `No se puede marcar como entregado un canje en estado ${redemption.status}`,
        );
      }

      const updated = await tx.redemption.update({
        where: { id },
        data: {
          status: RedemptionStatus.DELIVERED,
          deliveredAt: new Date(),
          processedById: adminId,
        },
        include: { referrer: true },
      });

      await this.mail.sendRedemptionDelivered({
        referrerName: updated.referrer.name,
        referrerEmail: updated.referrer.email,
        incentiveName: updated.incentiveName,
      });

      return updated;
    });
  }

  private async calculateReferrerPoints(referrerId: string): Promise<number> {
    const [earned, movements] = await Promise.all([
      this.prisma.referralStatusHistory.findMany({
        where: { referral: { referrerId } },
        select: { pointsAwarded: true },
      }),
      this.prisma.pointMovement.findMany({
        where: { referrerId },
        select: { points: true },
      }),
    ]);

    const pointsEarned = earned.reduce((sum, entry) => sum + entry.pointsAwarded, 0);
    const pointsFromMovements = movements.reduce((sum, m) => sum + m.points, 0);

    return pointsEarned + pointsFromMovements;
  }
}
