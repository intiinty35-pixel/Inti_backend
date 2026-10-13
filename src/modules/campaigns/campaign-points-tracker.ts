import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ReferralStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class CampaignPointsTracker {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la campaña activa para un proyecto específico en un momento dado.
   */
  async getActiveCampaignForProject(projectId: string): Promise<string | null> {
    const now = new Date();

    const campaign = await this.prisma.campaign.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        projects: {
          some: {
            projectId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return campaign?.id || null;
  }

  /**
   * Obtiene los puntos de campaña para un estado específico.
   */
  async getCampaignPoints(
    campaignId: string,
    status: ReferralStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx || this.prisma;
    const point = await client.campaignPoint.findUnique({
      where: {
        campaignId_status: {
          campaignId,
          status,
        },
      },
      select: {
        points: true,
      },
    });

    return point?.points || 0;
  }

  /**
   * Registra los puntos de campaña para un referido cuando cambia de estado.
   */
  async recordCampaignPoints(
    referrerId: string,
    campaignId: string,
    referralId: string,
    status: ReferralStatus,
    points: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    await client.campaignReferralPoints.upsert({
      where: {
        campaignId_referralId_status: {
          campaignId,
          referralId,
          status,
        },
      },
      update: {
        points,
      },
      create: {
        referrerId,
        campaignId,
        referralId,
        status,
        points,
      },
    });
  }

  /**
   * Procesa los puntos de campaña cuando un referido cambia de estado.
   * Retorna los puntos de campaña otorgados (si aplica).
   * Siempre crea el registro para que el referente pueda ver sus referidos de campaña.
   */
  async processReferralStatusChange(
    referrerId: string,
    referralId: string,
    campaignId: string,
    status: ReferralStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const points = await this.getCampaignPoints(campaignId, status, tx);

    // Siempre registrar (incluso con 0 puntos) para que el referente pueda ver sus referidos de campaña
    await this.recordCampaignPoints(
      referrerId,
      campaignId,
      referralId,
      status,
      points,
      tx,
    );

    return points;
  }

  /**
   * Obtiene el total de puntos de campaña para un referrer.
   */
  async getReferrerCampaignPoints(referrerId: string): Promise<number> {
    const result = await this.prisma.campaignReferralPoints.aggregate({
      where: {
        referrerId,
      },
      _sum: {
        points: true,
      },
    });

    return result._sum.points || 0;
  }

  /**
   * Obtiene los puntos de campaña desglosados por campaña para un referrer.
   */
  async getReferrerCampaignPointsBreakdown(referrerId: string) {
    const points = await this.prisma.campaignReferralPoints.findMany({
      where: {
        referrerId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        referral: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const byCampaign = points.reduce(
      (acc, point) => {
        const campaignId = point.campaignId;
        if (!acc[campaignId]) {
          acc[campaignId] = {
            campaign: point.campaign,
            totalPoints: 0,
            referrals: [],
          };
        }
        acc[campaignId].totalPoints += point.points;
        acc[campaignId].referrals.push({
          referralId: point.referralId,
          referralName: point.referral.name,
          status: point.status,
          points: point.points,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          campaign: { id: string; name: string };
          totalPoints: number;
          referrals: Array<{
            referralId: string;
            referralName: string;
            status: ReferralStatus;
            points: number;
          }>;
        }
      >,
    );

    return Object.values(byCampaign);
  }
}
