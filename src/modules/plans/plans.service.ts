import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PropertyStatus, SubscriptionStatus } from '../../generated/prisma/enums';
import { RequestPlanDto } from './dto/request-plan.dto';
import { ReviewSubscriptionDto } from './dto/review-subscription.dto';
import { UpsertPlanDto } from './dto/upsert-plan.dto';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireAgent(userId: string) {
    const agent = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!agent) throw new ForbiddenException('Tu cuenta no tiene un perfil profesional');
    return agent;
  }

  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  listAll() {
    return this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
  }

  async createPlan(dto: UpsertPlanDto) {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        slug,
        price: dto.price,
        currency: dto.currency,
        durationDays: dto.durationDays,
        propertyLimit: dto.propertyLimit,
        projectLimit: dto.projectLimit ?? 0,
        features: dto.features ?? [],
        isFree: dto.isFree ?? dto.price === 0,
        isDefault: dto.isDefault ?? false,
        highlight: dto.highlight ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePlan(id: string, dto: UpsertPlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
        currency: dto.currency,
        durationDays: dto.durationDays,
        propertyLimit: dto.propertyLimit,
        projectLimit: dto.projectLimit,
        features: dto.features,
        isFree: dto.isFree ?? dto.price === 0,
        isDefault: dto.isDefault,
        highlight: dto.highlight,
        isActive: dto.isActive,
      },
    });
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'plan';
    let slug = base;
    let attempt = 1;
    while (await this.prisma.plan.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }
    return slug;
  }

  async getMySubscription(userId: string) {
    const agent = await this.requireAgent(userId);
    await this.expireMemberships(agent.id);

    return this.prisma.planSubscription.findFirst({
      where: { agentProfileId: agent.id, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  async requestPlan(userId: string, planId: string, dto: RequestPlanDto) {
    const agent = await this.requireAgent(userId);
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan no encontrado');

    const isFree = Number(plan.price) === 0;
    if (!isFree && !dto.receiptUrl) {
      throw new BadRequestException('Sube el comprobante de pago para solicitar este plan');
    }

    const now = new Date();
    return this.prisma.planSubscription.create({
      data: {
        agentProfileId: agent.id,
        planId: plan.id,
        status: isFree ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING_PAYMENT,
        receiptUrl: dto.receiptUrl,
        startedAt: isFree ? now : null,
        expiresAt: isFree ? new Date(now.getTime() + plan.durationDays * 86_400_000) : null,
      },
      include: { plan: true },
    });
  }

  async assignDefaultPlanIfNone(agentProfileId: string) {
    const hasAny = await this.prisma.planSubscription.findFirst({
      where: { agentProfileId },
      select: { id: true },
    });
    if (hasAny) return;

    const defaultPlan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!defaultPlan) return;

    const now = new Date();
    await this.prisma.planSubscription.create({
      data: {
        agentProfileId,
        planId: defaultPlan.id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: now,
        expiresAt: new Date(now.getTime() + defaultPlan.durationDays * 86_400_000),
      },
    });
  }

  async listPendingSubscriptions() {
    await this.expireMemberships();

    return this.prisma.planSubscription.findMany({
      where: { status: SubscriptionStatus.PENDING_PAYMENT },
      orderBy: { createdAt: 'asc' },
      include: {
        plan: true,
        agentProfile: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  async reviewSubscription(id: string, dto: ReviewSubscriptionDto) {
    await this.expireMemberships();

    const subscription = await this.prisma.planSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Solicitud no encontrada');
    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Esta solicitud ya fue revisada');
    }

    const now = new Date();
    return this.prisma.planSubscription.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.status === 'REJECTED' ? dto.rejectionReason : null,
        reviewedAt: now,
        startedAt: dto.status === 'ACTIVE' ? now : null,
        expiresAt:
          dto.status === 'ACTIVE'
            ? new Date(now.getTime() + subscription.plan.durationDays * 86_400_000)
            : null,
      },
    });
  }

  async expireMemberships(agentProfileId?: string) {
    const now = new Date();
    const expiredSubscriptions = await this.prisma.planSubscription.findMany({
      where: {
        agentProfileId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lt: now },
      },
      select: { id: true, agentProfileId: true },
    });

    if (expiredSubscriptions.length === 0) return;

    const subscriptionIds = expiredSubscriptions.map((subscription) => subscription.id);
    const agentIds = [...new Set(expiredSubscriptions.map((subscription) => subscription.agentProfileId))];

    await this.prisma.$transaction([
      this.prisma.planSubscription.updateMany({
        where: { id: { in: subscriptionIds } },
        data: { status: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.property.updateMany({
        where: {
          agentProfileId: { in: agentIds },
          status: PropertyStatus.PUBLISHED,
        },
        data: { status: PropertyStatus.PAUSED },
      }),
    ]);
  }
}
