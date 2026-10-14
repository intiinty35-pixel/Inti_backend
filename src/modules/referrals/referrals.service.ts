import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CampaignPointsTracker } from '../campaigns/campaign-points-tracker';
import { ReferralStatus } from '../../generated/prisma/enums';
import { ReferralAvailability } from '../../generated/prisma/enums';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';
import { UpdateReferralPointsDto } from './dto/update-referral-points.dto';

const STATUS_LABELS: Record<ReferralStatus, string> = {
  [ReferralStatus.PENDING_VALIDATION]: 'Pendiente de validacion',
  [ReferralStatus.CONTACTED]: 'Contactado',
  [ReferralStatus.VISIT]: 'Visita',
  [ReferralStatus.OPERATION_COMPLETED]: 'Operación concretada',
  [ReferralStatus.REJECTED]: 'Rechazado',
};

const INTEREST_LABELS: Record<string, string> = {
  VENTA: 'Venta',
  COMPRA: 'Compra',
  ALQUILER: 'Alquilar',
  COMPRA_LOTE: 'Comprar un lote',
  INVERSION: 'Invertir en un proyecto',
  CORRETAJE: 'Servicio de corretaje',
};

const STATUS_ORDER: ReferralStatus[] = [
  ReferralStatus.CONTACTED,
  ReferralStatus.VISIT,
  ReferralStatus.OPERATION_COMPLETED,
];

const AVAILABILITY_LABELS: Record<string, string> = {
  INMEDIATA: 'Inmediata',
  AVERIGUAR: 'Averiguar',
  POR_CONFIRMAR: 'Por confirmar',
};

export interface ReferralHistoryRecord {
  id: string;
  fromStatus: ReferralStatus | null;
  toStatus: ReferralStatus;
  pointsAwarded: number;
  createdAt: Date;
}

export interface ReferralWithHistory {
  availability: string;
  history: ReferralHistoryRecord[];
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly campaignsService: CampaignsService,
    private readonly campaignTracker: CampaignPointsTracker,
  ) {}

  /**
   * Rango de fechas del registro del referido. `to` es inclusivo: se compara
   * contra el inicio del dia siguiente.
   */
  private createdAtRange(query: Pick<ReferralQueryDto, 'from' | 'to'>) {
    const range: Prisma.DateTimeFilter = {};
    if (query.from) range.gte = new Date(`${query.from.slice(0, 10)}T00:00:00.000-05:00`);
    if (query.to) {
      const end = new Date(`${query.to.slice(0, 10)}T00:00:00.000-05:00`);
      end.setDate(end.getDate() + 1);
      range.lt = end;
    }
    return query.from || query.to ? range : undefined;
  }

  /** Miembros visibles (no ocultos) que cumplen la busqueda y el rango de fechas. */
  private referrerFilter(
    query: Pick<ReferralQueryDto, 'search' | 'from' | 'to'>,
  ): Prisma.ReferrerWhereInput {
    const range = this.createdAtRange(query);
    const search = query.search?.trim();

    return {
      deletedAt: null,
      ...(range ? { referrals: { some: { createdAt: range } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { referrals: { some: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  /** Referidos incluidos por miembro: solo los del rango cuando hay fechas. */
  private referralsIncludeFor(query: Pick<ReferralQueryDto, 'from' | 'to'>) {
    const range = this.createdAtRange(query);
    return {
      referrals: {
        ...(range ? { where: { createdAt: range } } : {}),
        orderBy: { createdAt: 'asc' as const },
        include: {
          project: { select: { id: true, name: true } },
          history: { orderBy: { createdAt: 'asc' as const } },
        },
      },
    } as const;
  }

  async list(query: ReferralQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.referrerFilter(query);
    const [referrers, total, statusPoints] = await Promise.all([
      this.prisma.referrer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.referralsIncludeFor(query),
      }),
      this.prisma.referrer.count({ where }),
      this.prisma.referralStatusPoint.findMany(),
    ]);

    return {
      items: referrers.map((referrer) => this.toReferrerResponse(referrer)),
      total,
      page,
      pageSize,
      statusPoints: this.toStatusPointsResponse(statusPoints),
    };
  }

  async updateStatusPoints(dto: UpdateReferralPointsDto) {
    const updated = await this.prisma.$transaction(
      STATUS_ORDER.map((status) =>
        this.prisma.referralStatusPoint.upsert({
          where: { status },
          update: { points: dto[status] },
          create: { status, points: dto[status] },
        }),
      ),
    );

    return this.toStatusPointsResponse(updated);
  }

  async get(id: string) {
    const referrer = await this.prisma.referrer.findFirst({
      where: { referrals: { some: { id } } },
      include: this.referralsInclude(),
    });
    if (!referrer) throw new NotFoundException('Referido no encontrado');
    return this.toReferrerResponse(referrer);
  }

  async getReferrer(id: string) {
    const referrer = await this.prisma.referrer.findUnique({
      where: { id },
      include: this.referralsInclude(),
    });
    if (!referrer) throw new NotFoundException('Referente no encontrado');
    return this.toReferrerResponse(referrer);
  }

  /** Oculta al miembro (baja logica): se conserva todo su historial de referidos y puntos. */
  async deleteReferrer(id: string) {
    const referrer = await this.prisma.referrer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!referrer) throw new NotFoundException('Referente no encontrado');

    await this.prisma.referrer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { id, deleted: true };
  }

  async getReferrerByCode(code: string) {
    const referrer = await this.prisma.referrer.findFirst({
      where: { code: code.toUpperCase(), deletedAt: null },
      select: { id: true, name: true, email: true, phone: true },
    });
    return referrer;
  }

  /**
   * Lista publica de los referidos de un referente identificado por su codigo
   * APCOD-XXXXXXXX. Devuelve solo los campos necesarios para que el referente vea
   * el avance de cada referido.
   */
  async getReferralsByCode(code: string) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) {
      return {
        valid: false,
        message: 'Código de referente no válido',
        referrals: [],
      };
    }

    const referrer = await this.prisma.referrer.findFirst({
      where: { code: normalized, deletedAt: null },
      select: { id: true, code: true, name: true },
    });

    if (!referrer) {
      return {
        valid: false,
        message: 'Código de referente no válido',
        referrals: [],
      };
    }

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: referrer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        history: { orderBy: { createdAt: 'asc' as const } },
      },
    });

    return {
      valid: true,
      referrer: { code: referrer.code, name: referrer.name },
      total: referrals.length,
      referrals: referrals.map((referral) => ({
        id: referral.id,
        name: referral.name,
        email: referral.email,
        phone: referral.phone,
        status: referral.status,
        statusLabel: STATUS_LABELS[referral.status],
        interest: referral.interest,
        interestLabel:
          INTEREST_LABELS[String(referral.interest)] ??
          String(referral.interest),
        availability:
          AVAILABILITY_LABELS[String(referral.availability)] ??
          String(referral.availability),
        points: referral.history.reduce(
          (sum, item) => sum + item.pointsAwarded,
          0,
        ),
        project: referral.project
          ? { id: referral.project.id, name: referral.project.name }
          : null,
        createdAt: referral.createdAt,
      })),
    };
  }

  /**
   * Puntos adicionales de un proyecto Ariz para un estado. Solo aplican a proyectos
   * creados por ARIZ (con registro de proyecto de administrador); cualquier otro
   * proyecto, o ninguno, suma 0.
   */
  private async arizProjectExtraPoints(
    client: Prisma.TransactionClient | PrismaService,
    projectId: string | null | undefined,
    status: ReferralStatus,
  ): Promise<number> {
    if (!projectId) return 0;
    const config = await client.projectPointsConfig.findFirst({
      where: { projectId, project: { adminProject: { isNot: null }, isDeleted: false } },
    });
    if (!config) return 0;
    if (status === ReferralStatus.CONTACTED) return config.contactedPoints;
    if (status === ReferralStatus.VISIT) return config.visitPoints;
    if (status === ReferralStatus.OPERATION_COMPLETED) return config.operationCompletedPoints;
    return 0;
  }

  /** Proyectos Ariz publicados con sus puntos adicionales, para el registro de referidos. */
  async listArizProjectsWithPoints() {
    const adminProjects = await this.prisma.adminProject.findMany({
      where: { project: { status: 'PUBLISHED', isDeleted: false } },
      include: { project: { select: { id: true, name: true, slug: true } } },
      orderBy: { project: { name: 'asc' } },
    });
    const configs = await this.prisma.projectPointsConfig.findMany({
      where: { projectId: { in: adminProjects.map((item) => item.project.id) } },
    });
    const byProject = new Map(configs.map((config) => [config.projectId, config]));

    return adminProjects.map((item) => {
      const config = byProject.get(item.project.id);
      const points = {
        CONTACTED: config?.contactedPoints ?? 0,
        VISIT: config?.visitPoints ?? 0,
        OPERATION_COMPLETED: config?.operationCompletedPoints ?? 0,
      };
      return {
        id: item.project.id,
        name: item.project.name,
        slug: item.project.slug,
        points,
        totalExtraPoints: points.CONTACTED + points.VISIT + points.OPERATION_COMPLETED,
      };
    });
  }

  async referrerExistsByEmail(email: string): Promise<boolean> {
    const referrer = await this.prisma.referrer.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return !!referrer;
  }

  async create(dto: CreateReferralDto, changedById?: string | null) {
    const points = await this.prisma.referralStatusPoint.findUnique({
      where: { status: ReferralStatus.CONTACTED },
    });
    if (!points)
      throw new ConflictException(
        'No existe configuración para el estado inicial',
      );

    const extraInitialPoints = await this.arizProjectExtraPoints(
      this.prisma,
      dto.projectId,
      ReferralStatus.CONTACTED,
    );
    const initialPoints = points.points + extraInitialPoints;

    const referrerCode = dto.referrerCode?.trim().toUpperCase();
    const referrerEmail = dto.referrerEmail.trim().toLowerCase();
    const referralCode = await this.uniqueCode('RFD');
    let isNewReferrer = false;
    let campaignId: string | null = null;

    // Validar código de campaña si se proporciona
    if (dto.campaignCode) {
      const campaignValidation = await this.campaignsService.validateCampaignCode(
        dto.campaignCode,
      );
      if (!campaignValidation || !campaignValidation.isValid) {
        throw new BadRequestException(
          campaignValidation
            ? 'La campaña no está activa o ha expirado'
            : 'Código de campaña no válido',
        );
      }
      campaignId = campaignValidation.id;
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        let referrer = referrerCode
          ? await tx.referrer.findUnique({ where: { code: referrerCode } })
          : null;

        if (!referrer) {
          referrer = await tx.referrer.findFirst({
            where: { email: referrerEmail },
          });
        }

        if (referrer?.deletedAt) {
          referrer = await tx.referrer.update({
            where: { id: referrer.id },
            data: { deletedAt: null },
          });
        }

        if (!referrer) {
          referrer = await tx.referrer.create({
            data: {
              code: await this.uniqueCode('APCOD'),
              name: dto.referrerName.trim(),
              email: referrerEmail,
              phone: dto.referrerPhone.trim(),
              bankAccount: dto.referrerBankAccount?.trim() || null,
              yape: dto.referrerYape?.trim() || null,
              plin: dto.referrerPlin?.trim() || null,
            },
          });
          isNewReferrer = true;
        }

        const referral = await tx.referral.create({
          data: {
            referrerId: referrer.id,
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone.trim(),
            interest: dto.interest,
            availability: dto.availability ?? ReferralAvailability.INMEDIATA,
            projectId: dto.projectId || null,
            campaignId: campaignId,
            code: referralCode,
            status: ReferralStatus.CONTACTED,
            history: {
              create: {
                toStatus: ReferralStatus.CONTACTED,
                pointsAwarded: initialPoints,
                changedById,
              },
            },
          },
          include: {
            referrer: true,
          },
        });

        // Si el referido tiene campaña, registrar puntos de campaña para el estado inicial
        // Esto debe hacerse dentro de la transacción para garantizar consistencia
        if (campaignId) {
          await this.campaignTracker.processReferralStatusChange(
            referrer.id,
            referral.id,
            campaignId,
            ReferralStatus.CONTACTED,
            tx, // Pasar el cliente de transacción
          );
        }

        return referral;
      });

      const persisted = await this.prisma.referral.findUnique({
        where: { id: created.id },
        include: { history: true },
      });
      const totalPoints =
        persisted?.history.reduce((sum, item) => sum + item.pointsAwarded, 0) ??
        initialPoints;

      if (isNewReferrer) {
        await this.mail.sendReferrerWelcome({
          referrerName: created.referrer.name,
          referrerEmail: created.referrer.email,
          referrerCode: created.referrer.code,
        });
      }

      await this.mail.sendReferralRegisteredToAdmin({
        referralCode: created.code,
        referrerName: created.referrer.name,
        referrerEmail: created.referrer.email,
        referrerPhone: created.referrer.phone,
        referrerCode: created.referrer.code,
        referrerBankAccount: created.referrer.bankAccount,
        referrerYape: created.referrer.yape,
        referrerPlin: created.referrer.plin,
        isNewReferrer,
        referralName: created.name,
        referralEmail: created.email,
        referralPhone: created.phone,
        interestLabel:
          INTEREST_LABELS[String(created.interest)] ?? String(created.interest),
        availabilityLabel:
          AVAILABILITY_LABELS[String(created.availability)] ??
          String(created.availability),
      });

      return { ...created, points: initialPoints, totalPoints };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El código generado ya existe, inténtalo nuevamente',
        );
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: ReferralStatus, changedById: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.referral.findUnique({
        where: { id },
        include: {
          referrer: true,
          project: { select: { id: true, name: true } },
          history: { orderBy: { createdAt: 'asc' as const } },
        },
      });
      if (!current) throw new NotFoundException('Referido no encontrado');
      if (current.status === status)
        return this.responseWithTotals(tx, current, 0, false);

      const reached = await tx.referralStatusHistory.findUnique({
        where: { referralId_toStatus: { referralId: id, toStatus: status } },
      });
      const configured = await tx.referralStatusPoint.findUnique({
        where: { status },
      });
      if (!configured)
        throw new ConflictException(
          'No existe configuración para el estado seleccionado',
        );

      const extraPoints = reached
        ? 0
        : await this.arizProjectExtraPoints(tx, current.projectId, status);
      const pointsAwarded = reached ? 0 : configured.points + extraPoints;
      await tx.referral.update({ where: { id }, data: { status } });
      if (!reached) {
        await tx.referralStatusHistory.create({
          data: {
            referralId: id,
            fromStatus: current.status,
            toStatus: status,
            pointsAwarded,
            changedById,
          },
        });
      }

      // Procesar puntos de campaña si el referido está asociado a una campaña
      let campaignPointsAwarded = 0;
      if (current.campaignId && !reached) {
        campaignPointsAwarded = await this.campaignTracker.processReferralStatusChange(
          current.referrerId,
          id,
          current.campaignId,
          status,
          tx, // Pasar el cliente de transacción
        );
      }

      const updated = { ...current, status };
      const response = await this.responseWithTotals(tx, updated, pointsAwarded, true);
      
      // Agregar información de puntos de campaña a la respuesta
      return {
        ...response,
        campaignPointsAwarded,
      };
    });

    if (result.changed) {
      await this.mail.sendReferralStatusUpdated({
        referrerName: result.referrer.name,
        referrerEmail: result.referrer.email,
        interestLabel: INTEREST_LABELS[String(result.interest)] ?? 'Referido',
        projectName: result.project?.name ?? 'Sin proyecto',
        status: STATUS_LABELS[status],
        pointsAwarded: result.pointsAwarded,
        referralPoints: result.points,
        totalPoints: result.totalPoints,
      });
    }
    return result;
  }

  async approveReferral(id: string, changedById: string) {
    const current = await this.prisma.referral.findUnique({
      where: { id },
      include: { referrer: true },
    });
    if (!current) throw new NotFoundException('Referido no encontrado');
    if (current.status === ReferralStatus.CONTACTED) {
      return this.updateStatus(id, ReferralStatus.CONTACTED, changedById);
    }
    throw new ConflictException('El referido ya fue aprobado previamente');
  }

  async rejectReferral(id: string, _changedById: string) {
    const current = await this.prisma.referral.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Referido no encontrado');
    throw new ConflictException('El estado rechazado no está disponible');
  }

  private referralsInclude() {
    return {
      referrals: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          project: { select: { id: true, name: true } },
          history: { orderBy: { createdAt: 'asc' as const } },
        },
      },
    } as const;
  }

  private toReferrerResponse<T extends { referrals: ReferralWithHistory[] }>(
    referrer: T,
  ) {
    const referrals = referrer.referrals.map((referral) =>
      this.toReferralResponse(referral),
    );
    return {
      ...referrer,
      referrals,
      totalPoints: referrals.reduce((sum, item) => sum + item.points, 0),
    };
  }

  private toReferralResponse<T extends ReferralWithHistory>(referral: T) {
    return {
      ...referral,
      availability:
        AVAILABILITY_LABELS[String(referral.availability)] ??
        String(referral.availability),
      points: referral.history.reduce(
        (sum, item) => sum + item.pointsAwarded,
        0,
      ),
      history: referral.history.map((item) => ({
        ...item,
        fromStatus: item.fromStatus ? STATUS_LABELS[item.fromStatus] : null,
        toStatus: STATUS_LABELS[item.toStatus],
      })),
    };
  }

  private toStatusPointsResponse<
    T extends { status: ReferralStatus; points: number },
  >(statusPoints: T[]) {
    const byStatus = new Map(statusPoints.map((item) => [item.status, item]));
    return STATUS_ORDER.map((status) => {
      const item = byStatus.get(status);
      return {
        status,
        label: STATUS_LABELS[status],
        points: item?.points ?? 0,
      };
    });
  }

  private async responseWithTotals<
    T extends { id: string; referrerId: string },
  >(
    tx: Prisma.TransactionClient,
    referral: T,
    pointsAwarded: number,
    changed: boolean,
  ) {
    const history = await tx.referralStatusHistory.findMany({
      where: { referralId: referral.id },
      orderBy: { createdAt: 'asc' },
    });
    const points = history.reduce((sum, item) => sum + item.pointsAwarded, 0);
    const siblings = await tx.referral.findMany({
      where: { referrerId: referral.referrerId },
      include: { history: true },
    });
    const totalPoints = siblings.reduce(
      (sum, item) =>
        sum +
        item.history.reduce((inner, entry) => inner + entry.pointsAwarded, 0),
      0,
    );
    return {
      ...referral,
      points,
      totalPoints,
      pointsAwarded,
      changed,
      history,
    };
  }

  private async uniqueCode(prefix: string): Promise<string> {
    const code = `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const exists =
      prefix === 'APCOD'
        ? await this.prisma.referrer.findUnique({
            where: { code },
            select: { id: true },
          })
        : await this.prisma.referral.findUnique({
            where: { code },
            select: { id: true },
          });
    return exists ? this.uniqueCode(prefix) : code;
  }

  /** Metodos de pago que el miembro registro, para la columna "Tipo de pago". */
  private paymentTypeLabel(referrer: {
    bankAccount: string | null;
    yape: string | null;
    plin: string | null;
  }) {
    const types = [
      referrer.yape ? 'Yape' : null,
      referrer.plin ? 'Plin' : null,
      referrer.bankAccount ? 'Cuenta bancaria' : null,
    ].filter(Boolean);
    return types.length > 0 ? types.join(' / ') : 'Sin registrar';
  }

  /**
   * Ranking de miembros por cantidad de referidos (en el rango de fechas, si lo hay).
   * Incluye datos de contacto para poder llamarlos.
   */
  async ranking(query: Pick<ReferralQueryDto, 'search' | 'from' | 'to'> & { limit?: number }) {
    const referrers = await this.prisma.referrer.findMany({
      where: this.referrerFilter(query),
      include: this.referralsIncludeFor(query),
    });

    const rows = referrers
      .map((referrer) => {
        const referrals = referrer.referrals;
        const points = referrals.reduce(
          (sum, referral) =>
            sum + referral.history.reduce((inner, item) => inner + item.pointsAwarded, 0),
          0,
        );
        const lastReferralAt = referrals.reduce<Date | null>(
          (latest, referral) =>
            !latest || referral.createdAt > latest ? referral.createdAt : latest,
          null,
        );
        return {
          id: referrer.id,
          code: referrer.code,
          name: referrer.name,
          email: referrer.email,
          phone: referrer.phone,
          paymentType: this.paymentTypeLabel(referrer),
          referralsCount: referrals.length,
          completedCount: referrals.filter(
            (referral) => referral.status === ReferralStatus.OPERATION_COMPLETED,
          ).length,
          visitCount: referrals.filter((referral) => referral.status === ReferralStatus.VISIT)
            .length,
          points,
          lastReferralAt,
        };
      })
      .sort(
        (a, b) =>
          b.referralsCount - a.referralsCount ||
          b.points - a.points ||
          a.name.localeCompare(b.name),
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));

    const totals = {
      members: rows.length,
      referrals: rows.reduce((sum, row) => sum + row.referralsCount, 0),
      completed: rows.reduce((sum, row) => sum + row.completedCount, 0),
      points: rows.reduce((sum, row) => sum + row.points, 0),
    };

    return {
      generatedAt: new Date(),
      totals,
      items: query.limit ? rows.slice(0, query.limit) : rows,
    };
  }

  async exportRankingExcel(
    query: Pick<ReferralQueryDto, 'search' | 'from' | 'to'>,
  ): Promise<Buffer> {
    const { items } = await this.ranking(query);
    const data = items.map((row) => ({
      Puesto: row.rank,
      Miembro: row.name,
      'Código Miembro': row.code,
      Teléfono: row.phone,
      Email: row.email,
      'Tipo de pago': row.paymentType,
      Referidos: row.referralsCount,
      'En visita': row.visitCount,
      Concretados: row.completedCount,
      Puntos: row.points,
      'Último referido': row.lastReferralAt
        ? new Date(row.lastReferralAt).toLocaleDateString('es-PE')
        : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 18 },
      { wch: 15 },
      { wch: 30 },
      { wch: 22 },
      { wch: 11 },
      { wch: 11 },
      { wch: 13 },
      { wch: 10 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quienes más refirieron');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportExcel(query: Pick<ReferralQueryDto, 'search' | 'from' | 'to'> = {}): Promise<Buffer> {
    const referrers = await this.prisma.referrer.findMany({
      where: this.referrerFilter(query),
      orderBy: { createdAt: 'desc' },
      include: this.referralsIncludeFor(query),
    });

    const data: any[] = [];

    referrers.forEach((referrer) => {
      referrer.referrals.forEach((referral) => {
        const totalPoints = referral.history.reduce(
          (sum, item) => sum + item.pointsAwarded,
          0,
        );
        const lastStatus =
          referral.history.length > 0
            ? STATUS_LABELS[
                referral.history[referral.history.length - 1].toStatus
              ]
            : 'Sin estado';

        data.push({
          'Código Miembro': referrer.code,
          Miembro: referrer.name,
          'Email Miembro': referrer.email,
          'Teléfono Miembro': referrer.phone,
          'Tipo de pago': this.paymentTypeLabel(referrer),
          'Código Referido': referral.code,
          'Nombre Referido': referral.name,
          'Email Referido': referral.email,
          'Teléfono Referido': referral.phone,
          Interés:
            INTEREST_LABELS[String(referral.interest)] ??
            String(referral.interest),
          Disponibilidad:
            AVAILABILITY_LABELS[String(referral.availability)] ??
            String(referral.availability),
          'Último Estado': lastStatus,
          Puntos: totalPoints,
          Proyecto: referral.project?.name ?? 'Sin proyecto',
          'Fecha Registro': new Date(referral.createdAt).toLocaleDateString(
            'es-PE',
          ),
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Miembros y puntos');

    const colWidths = [
      { wch: 18 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 22 },
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
    ];
    worksheet['!cols'] = colWidths;

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportPdf(query: Pick<ReferralQueryDto, 'search' | 'from' | 'to'> = {}): Promise<Buffer> {
    const referrers = await this.prisma.referrer.findMany({
      where: this.referrerFilter(query),
      orderBy: { createdAt: 'desc' },
      include: this.referralsIncludeFor(query),
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Reporte de Miembros y puntos', { align: 'center' });
      doc.moveDown(0.2);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, {
          align: 'center',
        });
      doc.moveDown(1);

      const left = doc.page.margins.left;
      const columnRatios = [0.105, 0.155, 0.105, 0.17, 0.16, 0.24, 0.065];
      const tableWidth = doc.page.width - left - doc.page.margins.right;
      const colWidths = columnRatios.map((ratio) => tableWidth * ratio);
      const headers = [
        'Código Miembro',
        'Miembro',
        'Código Refdo.',
        'Referido',
        'Estado',
        'Proyecto',
        'Puntos',
      ];
      const headerHeight = 25;
      const rowHeight = 22;

      const drawHeader = () => {
        const headerY = doc.y;

        doc.save();
        doc.rect(left, headerY, tableWidth, headerHeight).fill('#0f2e5c');
        doc.restore();

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
        let x = left;
        headers.forEach((header, i) => {
          doc.text(header, x + 4, headerY + 8, {
            width: colWidths[i] - 8,
            height: headerHeight - 8,
            align: 'left',
            lineBreak: false,
            ellipsis: true,
          });
          x += colWidths[i];
        });
        doc.fillColor('#000000');
        doc.y = headerY + headerHeight;
      };

      drawHeader();

      doc.fontSize(8).font('Helvetica');
      let rowIndex = 0;
      let referralCount = 0;

      referrers.forEach((referrer) => {
        referrer.referrals.forEach((referral) => {
          if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            drawHeader();
            doc.fontSize(8).font('Helvetica');
            rowIndex = 0;
          }

          const rowY = doc.y;

          if (rowIndex % 2 === 0) {
            doc.save();
            doc.rect(left, rowY, tableWidth, rowHeight).fill('#f4f7fb');
            doc.restore();
          }

          const totalPoints = referral.history.reduce(
            (sum, item) => sum + item.pointsAwarded,
            0,
          );
          const lastStatus =
            referral.history.length > 0
              ? STATUS_LABELS[
                  referral.history[referral.history.length - 1].toStatus
                ]
              : '-';

          const values = [
            referrer.code,
            referrer.name,
            referral.code,
            referral.name,
            lastStatus,
            referral.project?.name ?? '-',
            totalPoints.toString(),
          ];

          let rx = left;
          values.forEach((val, i) => {
            doc.text(val, rx + 4, rowY + 6, {
              width: colWidths[i] - 8,
              height: rowHeight - 6,
              align: 'left',
              lineBreak: false,
              ellipsis: true,
            });
            rx += colWidths[i];
          });
          doc.y = rowY + rowHeight;
          rowIndex++;
          referralCount++;
        });
      });

      if (referralCount === 0) {
        doc
          .fontSize(10)
          .text('No hay referidos registrados.', { align: 'center' });
      }

      doc.end();
    });
  }
}
