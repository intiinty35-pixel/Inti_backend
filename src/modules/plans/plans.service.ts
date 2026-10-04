import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  ProfessionalType,
  PropertyStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { RequestPlanDto } from './dto/request-plan.dto';
import { RequestCustomerMembershipDto } from './dto/request-customer-membership.dto';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async requireAgent(userId: string) {
    const agent = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!agent) throw new ForbiddenException('Tu cuenta no tiene un perfil profesional');
    return agent;
  }

  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true, isCustomerOnly: false },
      orderBy: { price: 'asc' },
    });
  }

  async listAll(page?: number, pageSize?: number) {
    if (!page) {
      return this.prisma.plan.findMany({
        where: { isCustomerOnly: false },
        orderBy: { price: 'asc' },
      });
    }

    const size = Math.min(pageSize ?? 10, 50);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where: { isCustomerOnly: false },
        orderBy: { price: 'asc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.plan.count({ where: { isCustomerOnly: false } }),
    ]);

    return { items, total, page, pageSize: size, hasMore: page * size < total };
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
    if (!plan || !plan.isActive || plan.isCustomerOnly) {
      throw new NotFoundException('Plan no encontrado');
    }

    const isFree = Number(plan.price) === 0;
    if (!isFree && !dto.receiptUrl) {
      throw new BadRequestException('Sube el comprobante de pago para solicitar este plan');
    }

    const now = new Date();
    const subscription = await this.prisma.planSubscription.create({
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

    if (isFree) {
      const owner = await this.prisma.professionalProfile.findUnique({
        where: { id: agent.id },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      });
      if (owner) {
        void this.mail.sendMembershipApproved({
          email: owner.user.email,
          name: owner.businessName ?? `${owner.user.firstName} ${owner.user.lastName ?? ''}`.trim(),
          planName: plan.name,
          expiresAt: subscription.expiresAt,
        });
      }
    }

    return subscription;
  }

  async getCustomerMembership(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true, type: true },
    });
    if (!profile) {
      return {
        subscription: null,
        trialAvailable: true,
        propertyCount: 0,
      };
    }
    if (profile.type !== ProfessionalType.INDIVIDUAL_OWNER) {
      throw new ForbiddenException(
        'Esta cuenta no es de un propietario particular',
      );
    }

    await this.expireMemberships(profile.id);
    const [subscription, previousMembership, propertyCount] =
      await this.prisma.$transaction([
        this.prisma.planSubscription.findFirst({
          where: { agentProfileId: profile.id },
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        }),
        this.prisma.planSubscription.findFirst({
          where: { agentProfileId: profile.id },
          select: { id: true },
        }),
        this.prisma.property.count({
          where: {
            agentProfileId: profile.id,
            status: PropertyStatus.PUBLISHED,
          },
        }),
      ]);

    return {
      subscription,
      trialAvailable: !previousMembership,
      propertyCount,
    };
  }

  async requestCustomerMembership(
    userId: string,
    dto: RequestCustomerMembershipDto,
  ) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true, type: true },
    });
    if (!profile || profile.type !== ProfessionalType.INDIVIDUAL_OWNER) {
      throw new ForbiddenException(
        'Publica primero tu propiedad gratuita para activar las membresías',
      );
    }

    await this.expireMemberships(profile.id);
    const current = await this.prisma.planSubscription.findFirst({
      where: {
        agentProfileId: profile.id,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (current?.status === SubscriptionStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Ya tienes un comprobante pendiente de revisión',
      );
    }
    if (current?.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Tu membresía actual sigue activa. Podrás solicitar otra cuando venza',
      );
    }

    const previousMembership = await this.prisma.planSubscription.findFirst({
      where: { agentProfileId: profile.id },
      select: { id: true },
    });
    if (!previousMembership) {
      throw new BadRequestException(
        'Primero publica tu propiedad gratuita durante 30 días',
      );
    }

    const { propertyLimit, receiptUrl } = dto;
    const slug = `particular-${propertyLimit}-propiedades-30-dias`;
    const price = propertyLimit * 20;
    const name = `Paquete ${propertyLimit} ${propertyLimit === 1 ? 'propiedad' : 'propiedades'}`;
    const features = [
      `${propertyLimit} ${propertyLimit === 1 ? 'propiedad activa' : 'propiedades activas'}`,
      '30 días de publicación',
    ];
    const plan = await this.prisma.plan.upsert({
      where: { slug },
      create: {
        name,
        slug,
        price,
        currency: 'PEN',
        durationDays: 30,
        propertyLimit,
        projectLimit: 0,
        features,
        isFree: false,
        isCustomerOnly: true,
        isActive: true,
      },
      update: {
        name,
        price,
        currency: 'PEN',
        durationDays: 30,
        propertyLimit,
        features,
        isFree: false,
        isCustomerOnly: true,
        isActive: true,
      },
    });

    return this.prisma.planSubscription.create({
      data: {
        agentProfileId: profile.id,
        planId: plan.id,
        status: SubscriptionStatus.PENDING_PAYMENT,
        receiptUrl,
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

  async listPendingSubscriptions(page?: number, pageSize?: number) {
    await this.expireMemberships();

    const where = { status: SubscriptionStatus.PENDING_PAYMENT };
    const include = {
      plan: true,
      agentProfile: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
    };

    if (!page) {
      return this.prisma.planSubscription.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include,
      });
    }

    const size = Math.min(pageSize ?? 10, 50);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.planSubscription.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.planSubscription.count({ where }),
    ]);

    return { items, total, page, pageSize: size, hasMore: page * size < total };
  }

  async reviewSubscription(id: string, dto: ReviewSubscriptionDto) {
    await this.expireMemberships();

    const subscription = await this.prisma.planSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        agentProfile: {
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!subscription) throw new NotFoundException('Solicitud no encontrada');
    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Esta solicitud ya fue revisada');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const updatedSubscription = await transaction.planSubscription.update({
        where: { id },
        data: {
          status: dto.status,
          rejectionReason:
            dto.status === 'REJECTED' ? dto.rejectionReason : null,
          reviewedAt: now,
          startedAt: dto.status === 'ACTIVE' ? now : null,
          expiresAt:
            dto.status === 'ACTIVE'
              ? new Date(
                  now.getTime() + subscription.plan.durationDays * 86_400_000,
                )
              : null,
        },
      });

      if (
        dto.status === 'ACTIVE' &&
        subscription.agentProfile.type === ProfessionalType.INDIVIDUAL_OWNER
      ) {
        const publishedCount = await transaction.property.count({
          where: {
            agentProfileId: subscription.agentProfileId,
            status: PropertyStatus.PUBLISHED,
          },
        });
        const slots = Math.max(
          0,
          subscription.plan.propertyLimit - publishedCount,
        );
        if (slots > 0) {
          const paused = await transaction.property.findMany({
            where: {
              agentProfileId: subscription.agentProfileId,
              status: PropertyStatus.PAUSED,
            },
            orderBy: { updatedAt: 'desc' },
            take: slots,
            select: { id: true },
          });
          if (paused.length > 0) {
            await transaction.property.updateMany({
              where: { id: { in: paused.map(({ id }) => id) } },
              data: { status: PropertyStatus.PUBLISHED, publishedAt: now },
            });
          }
        }
      }

      return updatedSubscription;
    });

    if (dto.status === 'ACTIVE') {
      void this.mail.sendMembershipApproved({
        email: subscription.agentProfile.user.email,
        name:
          subscription.agentProfile.businessName ??
          `${subscription.agentProfile.user.firstName} ${subscription.agentProfile.user.lastName ?? ''}`.trim(),
        planName: subscription.plan.name,
        expiresAt: updated.expiresAt,
      });
    }

    return updated;
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
