import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Prisma } from '../../generated/prisma/client';
import {
  ApprovalStatus,
  Currency,
  LotMode,
  LotStatus,
  MediaType,
  ProfessionalType,
  ProjectCategory,
  ProjectStatus,
  PropertyStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import type { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateProjectDto, ProjectLocationDto } from './dto/create-project.dto';
import { OwnerProjectQueryDto } from './dto/owner-project-query.dto';
import { AdminProjectQueryDto } from './dto/admin-project-query.dto';
import { ProjectQueryDto, ProjectSort } from './dto/project-query.dto';

const PROJECT_SUMMARY_INCLUDE = {
  location: true,
  lots: { orderBy: { position: 'asc' } },
  media: { orderBy: [{ isCover: 'desc' }, { position: 'asc' }] },
  agentProfile: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

const PROJECT_INCLUDE = {
  ...PROJECT_SUMMARY_INCLUDE,
  milestones: { orderBy: { position: 'asc' } },
  sitePlan: { select: { projectId: true, publishedAt: true } },
  adminProject: {
    include: {
      createdByAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;
type ProjectSummaryWithRelations = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_SUMMARY_INCLUDE;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async validateTourVideo(value?: string) {
    if (!value) return;
    const url = new URL(value);
    if (
      url.hostname !== 'res.cloudinary.com' ||
      !url.pathname.includes('/video/upload/')
    )
      return;
    const credentials = new URL(this.config.getOrThrow<string>('CLOUDINARY_URL'));
    const prefix = `/${credentials.hostname}/video/upload/`;
    if (!url.pathname.startsWith(prefix)) {
      throw new BadRequestException(
        'El video debe pertenecer a la biblioteca del proyecto',
      );
    }
    const publicId = decodeURIComponent(url.pathname.slice(prefix.length))
      .replace(/^v\d+\//, '')
      .replace(/\.[^/.]+$/, '');
    let duration: unknown;
    try {
      const resource = (await cloudinary.api.resource(publicId, {
        resource_type: 'video',
        media_metadata: true,
        cloud_name: credentials.hostname,
        api_key: decodeURIComponent(credentials.username),
        api_secret: decodeURIComponent(credentials.password),
      })) as { duration?: number | string };
      duration = typeof resource.duration === 'string' && resource.duration.trim() !== ''
        ? Number(resource.duration)
        : resource.duration;
    } catch {
      throw new BadRequestException('No se pudo verificar el video local');
    }
    if (
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      throw new BadRequestException('No se pudo leer la duración del video local. Intenta guardar nuevamente.');
    }
    if (duration > 120) {
      throw new BadRequestException(
        'El video local debe durar como máximo 2 minutos',
      );
    }
  }

  async listPublic(query: ProjectQueryDto) {
    await this.expireMembershipIfNeeded();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const where = this.buildPublicWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy,
        include: PROJECT_SUMMARY_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map((project) => this.toSummary(project)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getPublicBySlug(slug: string) {
    await this.expireMembershipIfNeeded();

    const project = await this.prisma.project.findFirst({
      where: { slug, status: ProjectStatus.PUBLISHED, isDeleted: false },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return this.toDetail(project);
  }

  async listMine(user: AuthUser, query: OwnerProjectQueryDto = {}) {
    const agent = await this.prisma.professionalProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) {
      return query.page
        ? {
            items: [],
            total: 0,
            page: 1,
            pageSize: query.pageSize ?? 9,
            hasMore: false,
          }
        : [];
    }

    if (!query.page) {
      const projects = await this.prisma.project.findMany({
        where: { agentProfileId: agent.id, isDeleted: false },
        orderBy: [{ updatedAt: 'desc' }],
        include: PROJECT_INCLUDE,
      });
      return projects.map((project) => this.toDetail(project));
    }

    const page = query.page;
    const pageSize = Math.min(query.pageSize ?? 9, 50);
    const where = { agentProfileId: agent.id, isDeleted: false };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        include: PROJECT_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map((project) => this.toDetail(project)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async listAdminProjects(query: AdminProjectQueryDto, all = false) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 9, 50);
    const where: Prisma.ProjectWhereInput = {
      ...(all ? {} : { adminProject: { isNot: null } }),
      status: query.status,
      isDeleted: false,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        include: PROJECT_SUMMARY_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: items.map((project) => this.toSummary(project)),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getAdminProject(id: string, all = false) {
    const project = await this.prisma.project.findFirst({
      where: { id, ...(all ? {} : { adminProject: { isNot: null } }), isDeleted: false },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return this.toDetail(project);
  }

  /** El inventario del proyecto se expone como "unidades" para el listado público. */
  async listUnits(slugOrId: string) {
    const project = await this.prisma.project.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true, currency: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const lots = await this.prisma.projectLot.findMany({
      where: { projectId: project.id },
      orderBy: { position: 'asc' },
    });

    return lots.map((lot) => ({
      id: lot.id,
      projectId: lot.projectId,
      label: lot.block
        ? `Mza. ${lot.block} · Lote ${lot.lotNumber}`
        : `Lote ${lot.lotNumber}`,
      operation: 'buy',
      price: { amount: Number(lot.price), currency: project.currency, period: 'total' },
      bedrooms: 0,
      bathrooms: 0,
      areaM2: Number(lot.areaM2),
      lotCount: lot.lotCount,
      status: this.toFrontendLotStatus(lot.status),
    }));
  }

  async createDraft(user: AuthUser, dto: CreateProjectDto) {
    const agent = await this.requireApprovedAgent(user.id);
    this.ensureCanManageProjects(agent.type);
    this.validateProject(dto);

    return this.createDraftRecord(dto, { agentProfileId: agent.id });
  }

  async createAdminDraft(user: AuthUser, dto: CreateProjectDto) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un administrador puede crear proyectos de ARIZ',
      );
    }
    this.validateProject(dto);

    return this.createDraftRecord(dto, { createdByAdminId: user.id });
  }

  /**
   * Edita un proyecto ya creado. El cuerpo reemplaza al anterior (lotes, hitos y
   * multimedia se recrean); el estado y la fecha de publicacion no cambian, asi
   * que una publicacion editada sigue visible.
   */
  async update(user: AuthUser, id: string, dto: CreateProjectDto) {
    await this.validateTourVideo(dto.tourUrl);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { agentProfile: true, adminProject: true },
    });
    if (!project || project.isDeleted) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner =
      project.agentProfile !== null && project.agentProfile.userId === user.id;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('No puedes editar este proyecto');
    }
    if (!isAdmin && project.adminProject !== null) {
      throw new ForbiddenException('Este proyecto lo administra ARIZ');
    }
    if (project.agentProfile && !isAdmin) {
      this.ensureCanManageProjects(project.agentProfile.type);
    }
    this.validateProject(dto);
    const location = this.normalizeLocation(dto.location);

    const updated = await this.prisma.$transaction(async (tx) => {
      const managedPlan = await tx.projectSitePlan.findUnique({ where: { projectId: id }, select: { projectId: true } });
      if (!managedPlan) await tx.projectLot.deleteMany({ where: { projectId: id } });
      await tx.projectMilestone.deleteMany({ where: { projectId: id } });
      await tx.projectMedia.deleteMany({ where: { projectId: id } });

      return tx.project.update({
        where: { id },
        data: {
          stage: dto.stage,
          name: dto.name,
          description: dto.description,
          currency: dto.currency ?? Currency.PEN,
          priceFrom: dto.priceFrom,
          priceTo: dto.priceTo,
          ruc: dto.ruc ?? null,
          businessName: dto.businessName ?? null,
          downPayment: dto.downPayment ?? null,
          monthlyPayment: dto.monthlyPayment ?? null,
          financing: dto.financing ?? ['cash'],
          totalBlocks: managedPlan ? project.totalBlocks : dto.totalBlocks ?? null,
          totalLots: managedPlan ? project.totalLots : dto.totalLots ?? null,
          social: (dto.social as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
          services: dto.services ?? [],
          urbanizationName: dto.urbanizationName ?? null,
          registryEntry: dto.registryEntry ?? null,
          amenities: dto.amenities ?? [],
          lotMode: managedPlan ? project.lotMode : dto.lotMode,
          constructionStart: dto.constructionStart
            ? new Date(dto.constructionStart)
            : null,
          estimatedDelivery: new Date(dto.estimatedDelivery),
          certifications: dto.certifications ?? [],
          tourUrl: dto.tourUrl ?? null,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          contactWhatsapp: dto.contactWhatsapp,
          location: {
            upsert: {
              create: location,
              update: {
                ...location,
                zone: location.zone ?? null,
                latitude: location.latitude ?? null,
                longitude: location.longitude ?? null,
              },
            },
          },
          ...(!managedPlan ? { lots: { create: this.buildLotRows(dto) } } : {}),
          milestones: { create: this.buildMilestoneRows(dto) },
          media: { create: this.buildMediaRows(dto) },
        },
        include: PROJECT_INCLUDE,
      });
    });

    return this.toDetail(updated);
  }

  private async createDraftRecord(
    dto: CreateProjectDto,
    owner: { agentProfileId?: string; createdByAdminId?: string },
  ) {
    await this.validateTourVideo(dto.tourUrl);
    const project = await this.prisma.project.create({
      data: {
        agentProfileId: owner.agentProfileId,
        category: dto.category ?? ProjectCategory.LOTIZACION,
        stage: dto.stage,
        slug: this.createUniqueSlug(dto.name),
        name: dto.name,
        description: dto.description,
        currency: dto.currency ?? Currency.PEN,
        priceFrom: dto.priceFrom,
        priceTo: dto.priceTo,
        ruc: dto.ruc,
        businessName: dto.businessName,
        downPayment: dto.downPayment,
        monthlyPayment: dto.monthlyPayment,
        financing: dto.financing ?? ['cash'],
        totalBlocks: dto.totalBlocks,
        totalLots: dto.totalLots,
        social: dto.social as Prisma.InputJsonValue | undefined,
        services: dto.services ?? [],
        urbanizationName: dto.urbanizationName,
        registryEntry: dto.registryEntry,
        amenities: dto.amenities ?? [],
        lotMode: dto.lotMode,
        constructionStart: dto.constructionStart
          ? new Date(dto.constructionStart)
          : undefined,
        estimatedDelivery: new Date(dto.estimatedDelivery),
        certifications: dto.certifications ?? [],
        tourUrl: dto.tourUrl,
        contactName:
          dto.contactName ??
          (owner.createdByAdminId ? 'ARIZ Proyectos' : undefined),
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        contactWhatsapp: dto.contactWhatsapp,
        adminProject: owner.createdByAdminId
          ? { create: { createdByAdminId: owner.createdByAdminId } }
          : undefined,
        location: { create: this.normalizeLocation(dto.location) },
        lots: { create: this.buildLotRows(dto) },
        milestones: { create: this.buildMilestoneRows(dto) },
        media: { create: this.buildMediaRows(dto) },
      },
      include: PROJECT_INCLUDE,
    });

    return this.toDetail(project);
  }

  async publish(user: AuthUser, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        agentProfile: true,
        adminProject: true,
        location: true,
        lots: true,
        media: true,
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (
      project.adminProject !== null ||
      !project.agentProfile ||
      (project.agentProfile.userId !== user.id && user.role !== 'ADMIN')
    ) {
      throw new ForbiddenException('No puedes publicar este proyecto');
    }
    if (project.agentProfile.status !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu perfil anunciante debe estar aprobado');
    }
    this.ensureCanManageProjects(project.agentProfile.type);
    this.validatePublishableProject(project);

    if (
      project.agentProfile.type === ProfessionalType.DEVELOPER ||
      project.agentProfile.type === ProfessionalType.REAL_ESTATE_AGENCY
    ) {
      const updated = await this.prisma.project.update({
        where: { id },
        data: { status: ProjectStatus.PENDING_REVIEW, publishedAt: null },
        include: PROJECT_INCLUDE,
      });
      return this.toDetail(updated);
    }

    await this.expireMembershipIfNeeded(project.agentProfile.id);
    await this.ensureCanPublish(project.agentProfile.id, project.id);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.PUBLISHED, publishedAt: new Date() },
      include: PROJECT_INCLUDE,
    });
    return this.toDetail(updated);
  }

  async remove(user: AuthUser, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { agentProfile: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const isOwner = project.agentProfile && project.agentProfile.userId === user.id;
    if (!isOwner && user.role !== 'ADMIN') {
      throw new ForbiddenException('No puedes eliminar este proyecto');
    }
    if (project.isDeleted) return { id, deleted: true };

    await this.prisma.project.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { id, deleted: true };
  }

  async removeAdminProject(user: AuthUser, id: string) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un administrador puede eliminar proyectos de ARIZ',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { adminProject: true },
    });
    if (!project || project.isDeleted) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    if (!project.adminProject) {
      throw new ForbiddenException('Este proyecto no pertenece a ARIZ');
    }

    await this.prisma.project.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { id, deleted: true };
  }

  /** Baja logica de todos los proyectos de un agente, usada al eliminar su cuenta desde el admin. */
  async removeAllByAgent(agentProfileId: string) {
    await this.prisma.project.updateMany({
      where: { agentProfileId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async reviewDeveloperProject(id: string, status: 'PUBLISHED' | 'REJECTED') {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { agentProfile: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (
      !project.agentProfile ||
      project.agentProfile.type !== ProfessionalType.DEVELOPER
    ) {
      throw new ForbiddenException(
        'Este proyecto no pertenece a una desarrolladora',
      );
    }

    if (project.status !== ProjectStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'El proyecto no está pendiente de revisión',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status,
        publishedAt: status === ProjectStatus.PUBLISHED ? new Date() : null,
      },
      include: PROJECT_INCLUDE,
    });
    return this.toDetail(updated);
  }

  async reviewAgencyProject(id: string, status: 'PUBLISHED' | 'REJECTED') {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { agentProfile: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (
      !project.agentProfile ||
      project.agentProfile.type !== ProfessionalType.REAL_ESTATE_AGENCY
    ) {
      throw new ForbiddenException(
        'Este proyecto no pertenece a una inmobiliaria',
      );
    }
    if (project.status !== ProjectStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'El proyecto no está pendiente de revisión',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status,
        publishedAt: status === ProjectStatus.PUBLISHED ? new Date() : null,
      },
      include: PROJECT_INCLUDE,
    });
    return this.toDetail(updated);
  }

  async getAgencyProjectReviewDetail(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (
      !project.agentProfile ||
      project.agentProfile.type !== ProfessionalType.REAL_ESTATE_AGENCY
    ) {
      throw new ForbiddenException(
        'Este proyecto no pertenece a una inmobiliaria',
      );
    }
    return this.toDetail(project);
  }

  async publishAdminProject(user: AuthUser, id: string) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un administrador puede publicar proyectos de ARIZ',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { adminProject: true, location: true, lots: true, media: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!project.adminProject) {
      throw new ForbiddenException('Este proyecto no pertenece a ARIZ');
    }
    this.validatePublishableProject(project);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.PUBLISHED, publishedAt: new Date() },
      include: PROJECT_INCLUDE,
    });
    return this.toDetail(updated);
  }

  async updateLocation(user: AuthUser, id: string, dto: ProjectLocationDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { agentProfile: true, adminProject: true },
    });
    if (!project || project.isDeleted) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const isOwner = project.agentProfile?.userId === user.id;
    if (!isOwner && user.role !== 'ADMIN') {
      throw new ForbiddenException('No puedes editar la ubicacion de este proyecto');
    }

    return this.saveLocation(id, dto);
  }

  async updateAdminLocation(user: AuthUser, id: string, dto: ProjectLocationDto) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un administrador puede editar proyectos de ARIZ',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { adminProject: true },
    });
    if (!project || project.isDeleted) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    if (!project.adminProject) {
      throw new ForbiddenException('Este proyecto no pertenece a ARIZ');
    }

    return this.saveLocation(id, dto);
  }

  private async saveLocation(id: string, dto: ProjectLocationDto) {
    const location = this.normalizeLocation(dto);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        location: {
          upsert: {
            create: location,
            update: location,
          },
        },
      },
      include: PROJECT_INCLUDE,
    });

    return this.toDetail(updated);
  }

  private normalizeLocation(dto: ProjectLocationDto) {
    return {
      ...dto,
      street: dto.street?.trim() ?? '',
      streetNumber: dto.streetNumber?.trim() ?? '',
    };
  }

  private validatePublishableProject(project: {
    location: { latitude?: unknown; longitude?: unknown } | null;
    lots: unknown[];
    media: Array<{ type: MediaType }>;
  }) {
    if (
      !project.location ||
      project.location.latitude === null ||
      project.location.latitude === undefined ||
      project.location.longitude === null ||
      project.location.longitude === undefined ||
      project.lots.length === 0 ||
      !project.media.some((media) => media.type === MediaType.IMAGE)
    ) {
      throw new BadRequestException(
        'Falta completar ubicacion con punto en el mapa, lotes o imagenes del proyecto',
      );
    }
  }

  private buildPublicWhere(query: ProjectQueryDto): Prisma.ProjectWhereInput {
    return {
      status: ProjectStatus.PUBLISHED,
      isDeleted: false,
      category: query.category,
      stage: query.stage,
      currency: query.currency,
      priceFrom: { gte: query.priceMin, lte: query.priceMax },
      ...this.buildOriginFilter(query.origin),
      location: {
        department: query.department,
        province: query.province,
        district: query.district,
      },
    };
  }

  /**
   * "ADMIN" = creado desde el panel de admin O publicado por un perfil con
   * el privilegio isOfficialDeveloper (desarrolladoras oficiales de Ariz).
   * "AGENT" es todo lo demas.
   */
  private buildOriginFilter(
    origin?: 'ADMIN' | 'AGENT',
  ): Prisma.ProjectWhereInput {
    if (!origin) return {};

    const isArizOrigin: Prisma.ProjectWhereInput = {
      OR: [
        { adminProject: { isNot: null } },
        { agentProfile: { isOfficialDeveloper: true } },
      ],
    };

    return origin === 'ADMIN' ? isArizOrigin : { NOT: isArizOrigin };
  }

  private buildOrderBy(
    sort?: ProjectSort,
  ): Prisma.ProjectOrderByWithRelationInput[] {
    if (sort === ProjectSort.PRICE_ASC) return [{ priceFrom: 'asc' }];
    if (sort === ProjectSort.PRICE_DESC) return [{ priceFrom: 'desc' }];
    if (sort === ProjectSort.FEATURED)
      return [{ featured: 'desc' }, { publishedAt: 'desc' }];
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }

  private async requireApprovedAgent(userId: string) {
    const agent = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });
    if (!agent)
      throw new ForbiddenException(
        'Completa tu perfil anunciante para publicar',
      );
    if (agent.status !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu perfil anunciante debe estar aprobado');
    }
    return agent;
  }

  private ensureCanManageProjects(type: ProfessionalType) {
    if (type === ProfessionalType.INDEPENDENT_AGENT) {
      throw new ForbiddenException(
        'Los agentes inmobiliarios solo pueden publicar propiedades.',
      );
    }
  }

  private async expireMembershipIfNeeded(agentProfileId?: string) {
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

    const agentIds = [
      ...new Set(
        expiredSubscriptions.map((subscription) => subscription.agentProfileId),
      ),
    ];

    await this.prisma.$transaction([
      this.prisma.planSubscription.updateMany({
        where: {
          id: {
            in: expiredSubscriptions.map((subscription) => subscription.id),
          },
        },
        data: { status: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.property.updateMany({
        where: {
          agentProfileId: { in: agentIds },
          status: PropertyStatus.PUBLISHED,
        },
        data: { status: PropertyStatus.PAUSED },
      }),
      this.prisma.project.updateMany({
        where: {
          agentProfileId: { in: agentIds },
          status: ProjectStatus.PUBLISHED,
        },
        data: { status: ProjectStatus.PAUSED },
      }),
    ]);
  }

  private async ensureCanPublish(agentProfileId: string, projectId: string) {
    const now = new Date();
    const subscriptions = await this.prisma.planSubscription.findMany({
      where: {
        agentProfileId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (subscriptions.length === 0) {
      throw new ForbiddenException(
        'No tienes una suscripción activa con crédito disponible para publicar. Solicita una nueva suscripción al administrador.',
      );
    }

    const publishedCount = await this.prisma.project.count({
      where: {
        agentProfileId,
        id: { not: projectId },
        status: ProjectStatus.PUBLISHED,
      },
    });

    const hasAvailableCredit = subscriptions.some(
      (subscription) => publishedCount < subscription.plan.projectLimit,
    );

    if (!hasAvailableCredit) {
      const maxProjectLimit = Math.max(
        ...subscriptions.map(({ plan }) => plan.projectLimit),
      );
      throw new ForbiddenException(
        `No tienes crédito disponible para publicar otro proyecto. Tus suscripciones activas permiten hasta ${maxProjectLimit} proyectos activos. Solicita una nueva suscripción al administrador.`,
      );
    }
  }

  private buildLotRows(dto: CreateProjectDto) {
    return dto.lots.map((lot, index) => ({
      lotNumber: lot.lotNumber,
      block: lot.block,
      areaM2: lot.areaM2,
      frontM: lot.frontM,
      price: lot.price,
      status: lot.status,
      planLocation: lot.planLocation,
      lotCount: dto.lotMode === LotMode.GROUP ? lot.lotCount : null,
      position: index,
    }));
  }

  private buildMilestoneRows(dto: CreateProjectDto) {
    return (dto.milestones ?? []).map((milestone, index) => ({
      title: milestone.title,
      date: new Date(milestone.date),
      note: milestone.note,
      position: index,
    }));
  }

  private buildMediaRows(dto: CreateProjectDto) {
    return dto.media.map((media, index) => ({
      type: media.type,
      url: media.url,
      publicId: media.publicId,
      position: media.position ?? index,
      isCover: media.isCover ?? false,
    }));
  }

  private validateProject(dto: CreateProjectDto) {
    if (dto.priceTo < dto.priceFrom) {
      throw new BadRequestException(
        'El precio hasta no puede ser menor que el precio desde',
      );
    }
    if (dto.media.filter((media) => media.isCover).length > 1) {
      throw new BadRequestException('Solo una imagen puede ser portada');
    }
    if (!dto.media.some((media) => media.type === MediaType.IMAGE)) {
      throw new BadRequestException('Agrega al menos una imagen del proyecto');
    }
    if (
      dto.lotMode === LotMode.GROUP &&
      dto.lots.some((lot) => !lot.lotCount)
    ) {
      throw new BadRequestException(
        'Cada grupo debe indicar cuántos lotes cubre',
      );
    }
    const numbers = dto.lots.map((lot) => lot.lotNumber.trim().toLowerCase());
    if (new Set(numbers).size !== numbers.length) {
      throw new BadRequestException(
        'Hay números de lote repetidos en el inventario',
      );
    }
  }

  private createUniqueSlug(name: string) {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'proyecto'}-${suffix}`;
  }

  private toSummary(project: ProjectSummaryWithRelations) {
    const cover =
      project.media.find((media) => media.isCover) ?? project.media[0];
    const lotPrices = project.lots.map((lot) => Number(lot.price));
    const lotAreas = project.lots.map((lot) => Number(lot.areaM2));
    return {
      id: project.id,
      origin:
        project.agentProfileId === null ||
        project.agentProfile?.isOfficialDeveloper
          ? 'ADMIN'
          : 'AGENT',
      slug: project.slug,
      name: project.name,
      description: project.description,
      category: project.category,
      stage: project.stage,
      lotMode: project.lotMode,
      currency: project.currency,
      priceFrom: Number(project.priceFrom),
      priceTo: Number(project.priceTo),
      totalLots: project.totalLots,
      lotsCount: project.lots.length,
      cheapestLotPrice: lotPrices.length ? Math.min(...lotPrices) : undefined,
      areaRange: {
        min: lotAreas.length ? Math.min(...lotAreas) : 0,
        max: lotAreas.length ? Math.max(...lotAreas) : 0,
      },
      developer:
        project.businessName ??
        project.agentProfile?.businessName ??
        (project.agentProfile
          ? `${project.agentProfile.user.firstName} ${project.agentProfile.user.lastName ?? ''}`.trim()
          : 'ARIZ Proyectos'),
      estimatedDelivery: project.estimatedDelivery.toISOString(),
      location: project.location
        ? {
            department: project.location.department,
            province: project.location.province,
            district: project.location.district,
            lat: project.location.latitude
              ? Number(project.location.latitude)
              : undefined,
            lng: project.location.longitude
              ? Number(project.location.longitude)
              : undefined,
          }
        : { department: '', province: '', district: '' },
      coverImage: cover?.url,
      images: project.media
        .filter((media) => media.type === MediaType.IMAGE)
        .map((media) => media.url),
      tourUrl: project.tourUrl,
      status: project.status,
      featured: project.featured,
      publishedAt:
        project.publishedAt?.toISOString() ?? project.createdAt.toISOString(),
      agent: project.agentProfile
        ? {
            id: project.agentProfile.id,
            type: project.agentProfile.type,
            status: project.agentProfile.status,
          }
        : {
            id: null,
            type: 'ADMIN',
            status: 'APPROVED',
          },
    };
  }

  private toDetail(project: ProjectWithRelations) {
    return {
      ...this.toSummary(project),
      hasSitePlan: Boolean(project.sitePlan),
      hasPublishedSitePlan: Boolean(project.sitePlan?.publishedAt),
      ruc: project.ruc,
      businessName: project.businessName,
      downPayment: project.downPayment ? Number(project.downPayment) : null,
      monthlyPayment: project.monthlyPayment
        ? Number(project.monthlyPayment)
        : null,
      financing: project.financing,
      totalBlocks: project.totalBlocks,
      social: project.social,
      services: project.services,
      urbanizationName: project.urbanizationName,
      registryEntry: project.registryEntry,
      amenities: project.amenities,
      tourUrl: project.tourUrl,
      constructionStart: project.constructionStart?.toISOString() ?? null,
      estimatedDelivery: project.estimatedDelivery.toISOString(),
      certifications: project.certifications,
      location: project.location
        ? {
            ...project.location,
            latitude: project.location.latitude
              ? Number(project.location.latitude)
              : null,
            longitude: project.location.longitude
              ? Number(project.location.longitude)
              : null,
          }
        : null,
      lots: project.lots.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        block: lot.block,
        areaM2: Number(lot.areaM2),
        frontM: lot.frontM ? Number(lot.frontM) : null,
        price: Number(lot.price),
        status: lot.status,
        planLocation: lot.planLocation,
        lotCount: lot.lotCount,
      })),
      milestones: project.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        date: milestone.date.toISOString(),
        note: milestone.note,
      })),
      media: project.media.map((media) => ({
        id: media.id,
        type: media.type,
        url: media.url,
        publicId: media.publicId,
        position: media.position,
        isCover: media.isCover,
      })),
      agent: project.agentProfile
        ? {
            id: project.agentProfile.id,
            name:
              project.contactName ??
              project.businessName ??
              project.agentProfile.businessName ??
              `${project.agentProfile.user.firstName} ${project.agentProfile.user.lastName ?? ''}`.trim(),
            type: project.agentProfile.type,
            status: project.agentProfile.status,
            whatsapp: project.contactWhatsapp ?? project.agentProfile.whatsapp,
            phone: project.contactPhone ?? project.agentProfile.user.phone,
            email: project.contactEmail ?? project.agentProfile.user.email,
          }
        : {
            id: null,
            name:
              project.contactName ?? project.businessName ?? 'ARIZ Proyectos',
            type: 'ADMIN',
            status: 'APPROVED',
            whatsapp: project.contactWhatsapp,
            phone:
              project.contactPhone ??
              project.adminProject?.createdByAdmin.phone,
            email:
              project.contactEmail ??
              project.adminProject?.createdByAdmin.email ??
              '',
          },
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toFrontendLotStatus(status: LotStatus) {
    if (status === LotStatus.RESERVED) return 'reservado';
    if (status === LotStatus.SOLD) return 'vendido';
    if (status === LotStatus.BLOCKED) return 'bloqueado';
    return 'disponible';
  }
}
