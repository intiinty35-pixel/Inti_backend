import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ReferralStatus } from '../../generated/prisma/enums';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { BatchUpdateProjectPointsDto } from './dto/project-points.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueCode(): Promise<string> {
    const code = `CAMP-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists = await this.prisma.campaign.findUnique({ where: { code } });
    return exists ? this.generateUniqueCode() : code;
  }

  async validateCampaignCode(code: string): Promise<{
    id: string;
    name: string;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    isValid: boolean;
  } | null> {
    const normalized = code.trim().toUpperCase();
    const campaign = await this.prisma.campaign.findUnique({
      where: { code: normalized },
      select: {
        id: true,
        name: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!campaign) return null;

    const now = new Date();
    const isValid =
      campaign.isActive &&
      campaign.startDate <= now &&
      campaign.endDate >= now;

    return { ...campaign, isValid };
  }

  async list(query: CampaignQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          points: true,
          projects: {
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.campaign.count(),
    ]);

    return {
      items: campaigns.map((campaign) => this.toCampaignResponse(campaign)),
      total,
      page,
      pageSize,
    };
  }

  async getActive() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        points: true,
        projects: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    return campaigns.map((campaign) => this.toCampaignResponse(campaign));
  }

  async get(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        points: true,
        projects: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaña no encontrada');
    }

    return this.toCampaignResponse(campaign);
  }

  async create(dto: CreateCampaignDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    const code = await this.generateUniqueCode();

    const campaign = await this.prisma.campaign.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        startDate,
        endDate,
        points: {
          create: [
            {
              status: ReferralStatus.CONTACTED,
              points: dto.points.CONTACTED,
            },
            {
              status: ReferralStatus.VISIT,
              points: dto.points.VISIT,
            },
            {
              status: ReferralStatus.OPERATION_COMPLETED,
              points: dto.points.OPERATION_COMPLETED,
            },
          ],
        },
        projects: {
          create: dto.projectIds.map((projectId) => ({
            projectId,
          })),
        },
      },
      include: {
        points: true,
        projects: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    return this.toCampaignResponse(campaign);
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Campaña no encontrada');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);

    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
      if (endDate <= startDate) {
        throw new BadRequestException(
          'La fecha de fin debe ser posterior a la fecha de inicio',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id },
        data: updateData,
      });

      if (dto.points) {
        const statuses = [
          ReferralStatus.CONTACTED,
          ReferralStatus.VISIT,
          ReferralStatus.OPERATION_COMPLETED,
        ];
        for (const status of statuses) {
          const pointsValue = dto.points[status];
          if (pointsValue !== undefined) {
            await tx.campaignPoint.upsert({
              where: {
                campaignId_status: {
                  campaignId: id,
                  status,
                },
              },
              update: { points: pointsValue },
              create: {
                campaignId: id,
                status,
                points: pointsValue,
              },
            });
          }
        }
      }

      if (dto.projectIds) {
        await tx.campaignProject.deleteMany({
          where: { campaignId: id },
        });
        await tx.campaignProject.createMany({
          data: dto.projectIds.map((projectId) => ({
            campaignId: id,
            projectId,
          })),
        });
      }
    });

    return this.get(id);
  }

  async delete(id: string) {
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Campaña no encontrada');
    }

    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async listProjectPoints() {
    const adminProjects = await this.prisma.adminProject.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const configs = await this.prisma.projectPointsConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.projectId, c]));

    return adminProjects.map((ap) => {
      const config = configMap.get(ap.project.id);
      return {
        id: ap.project.id,
        name: ap.project.name,
        slug: ap.project.slug,
        points: {
          CONTACTED: config?.contactedPoints ?? 0,
          VISIT: config?.visitPoints ?? 0,
          OPERATION_COMPLETED: config?.operationCompletedPoints ?? 0,
        },
      };
    });
  }

  async updateProjectPoints(projectId: string, points: { CONTACTED: number; VISIT: number; OPERATION_COMPLETED: number }) {
    const adminProject = await this.prisma.adminProject.findFirst({
      where: { projectId },
    });

    if (!adminProject) {
      throw new NotFoundException('Proyecto ARIZ no encontrado');
    }

    const config = await this.prisma.projectPointsConfig.upsert({
      where: { projectId },
      update: {
        contactedPoints: points.CONTACTED,
        visitPoints: points.VISIT,
        operationCompletedPoints: points.OPERATION_COMPLETED,
      },
      create: {
        projectId,
        contactedPoints: points.CONTACTED,
        visitPoints: points.VISIT,
        operationCompletedPoints: points.OPERATION_COMPLETED,
      },
    });

    return {
      id: config.projectId,
      points: {
        CONTACTED: config.contactedPoints,
        VISIT: config.visitPoints,
        OPERATION_COMPLETED: config.operationCompletedPoints,
      },
    };
  }

  async batchUpdateProjectPoints(dto: BatchUpdateProjectPointsDto) {
    const results = await Promise.all(
      dto.updates.map((update) =>
        this.updateProjectPoints(update.projectId, update.points),
      ),
    );
    return results;
  }

  async getArizProjects() {
    const adminProjects = await this.prisma.adminProject.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return adminProjects.map((ap) => ({
      id: ap.project.id,
      name: ap.project.name,
    }));
  }

  private toCampaignResponse(campaign: any) {
    const pointsObj: any = {
      CONTACTED: 0,
      VISIT: 0,
      OPERATION_COMPLETED: 0,
    };

    campaign.points?.forEach((p: any) => {
      pointsObj[p.status] = p.points;
    });

    return {
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      isActive: campaign.isActive,
      points: pointsObj,
      projectIds: campaign.projects?.map((p: any) => p.projectId) ?? [],
      projects: campaign.projects?.map((p: any) => ({
        id: p.project.id,
        name: p.project.name,
      })) ?? [],
      status: this.getCampaignStatus(campaign.startDate, campaign.endDate, campaign.isActive),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private getCampaignStatus(startDate: Date, endDate: Date, isActive: boolean): string {
    const now = new Date();
    if (!isActive) return 'INACTIVE';
    if (now < startDate) return 'INACTIVE';
    if (now > endDate) return 'EXPIRED';
    return 'ACTIVE';
  }
}
