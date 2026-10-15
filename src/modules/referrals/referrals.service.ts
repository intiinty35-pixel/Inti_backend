import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { Workbook } from 'exceljs';
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
import { ReferralRecordsQueryDto } from './dto/referral-records-query.dto';
import { UpdateReferrerDto } from './dto/update-referrer.dto';
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

  async setRecordPoints(id: string, points: number, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { id }, include: { history: true } });
      if (!referral) throw new NotFoundException('Referido no encontrado');
      const total = referral.history.reduce((sum, entry) => sum + entry.pointsAwarded, 0);
      const current = referral.history.find((entry) => entry.toStatus === referral.status);
      // Adjust the current state's contribution so all existing total calculations stay consistent.
      const contribution = (current?.pointsAwarded ?? 0) + points - total;
      if (contribution < -2147483648 || contribution > 2147483647) {
        throw new BadRequestException('El ajuste de puntos excede el rango permitido');
      }
      await tx.referralStatusHistory.upsert({
        where: { referralId_toStatus: { referralId: id, toStatus: referral.status } },
        update: { pointsAwarded: contribution, changedById: adminId },
        create: { referralId: id, fromStatus: referral.status, toStatus: referral.status,
          pointsAwarded: contribution, changedById: adminId },
      });
      return { id, points };
    }, { isolationLevel: 'Serializable' });
  }

  async deleteRecord(id: string) {
    const existing = await this.prisma.referral.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Referido no encontrado');
    await this.prisma.referral.delete({ where: { id } });
    return { deleted: true };
  }

  private recordFilter(query: ReferralRecordsQueryDto): Prisma.ReferralWhereInput {
    const search = query.search?.trim();
    return {
      referrer: { deletedAt: null },
      createdAt: this.createdAtRange(query),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { code: { contains: search, mode: 'insensitive' } },
        { referrer: { name: { contains: search, mode: 'insensitive' } } },
        { referrer: { code: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
  }

  private recordInclude = {
    referrer: { select: { id: true, name: true, code: true } },
    project: { select: { id: true, name: true } },
    history: { select: { pointsAwarded: true } },
  } as const;

  async listRecords(query: ReferralRecordsQueryDto) {
    const where = this.recordFilter(query);
    const [total, completed, visits, points, rows] = await Promise.all([
      this.prisma.referral.count({ where }),
      this.prisma.referral.count({ where: { AND: [where, { status: ReferralStatus.OPERATION_COMPLETED }] } }),
      this.prisma.referral.count({ where: { AND: [where, { status: ReferralStatus.VISIT }] } }),
      this.prisma.referralStatusHistory.aggregate({ where: { referral: where }, _sum: { pointsAwarded: true } }),
      this.prisma.referral.findMany({ where, include: this.recordInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    ]);
    return {
      generatedAt: new Date(), total, page: query.page, pageSize: query.pageSize,
      totals: { referrals: total, completed, visits, points: points._sum.pointsAwarded ?? 0 },
      items: rows.map(({ history, ...row }) => ({ ...row,
        points: history.reduce((sum, item) => sum + item.pointsAwarded, 0),
        interestLabel: INTEREST_LABELS[row.interest] ?? row.interest,
        availabilityLabel: AVAILABILITY_LABELS[row.availability] ?? row.availability,
        statusLabel: STATUS_LABELS[row.status],
      })),
    };
  }

  async exportRecordsExcel(query: ReferralRecordsQueryDto): Promise<Buffer> {
    const rows = await this.prisma.referral.findMany({
      where: this.recordFilter(query), include: this.recordInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const workbook = new Workbook();
    workbook.creator = 'Ariz Inmobiliaria';
    const sheet = workbook.addWorksheet('Referidos', {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    });
    const headers = ['Código', 'Referido', 'Teléfono', 'Email', 'Miembro Ariz', 'Código Miembro Ariz', 'Estado', 'Interés', 'Disponibilidad', 'Proyecto', 'Puntos', 'Fecha de registro'];
    sheet.columns = headers.map((key) => ({ key, width: key === 'Email' ? 34 : 26 }));
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = 'ARIZ · CONTROL DE REFERIDOS';
    sheet.getRow(1).height = 40;
    sheet.mergeCells('A2:L2');
    sheet.getCell('A2').value = `Periodo: ${query.from || 'Inicio'} al ${query.to || 'Hoy'} · Estado: ${query.status ? STATUS_LABELS[query.status] : 'Todos'} · ${rows.length} referidos${query.search ? ` · Búsqueda: ${query.search}` : ''}`;
    sheet.getRow(2).height = 28;
    sheet.addRow([]);
    sheet.addRow(headers).height = 30;
    rows.forEach((row) => sheet.addRow([
      row.code, row.name, row.phone, row.email, row.referrer.name, row.referrer.code,
      STATUS_LABELS[row.status], INTEREST_LABELS[row.interest] ?? row.interest,
      AVAILABILITY_LABELS[row.availability] ?? row.availability, row.project?.name ?? 'Sin proyecto',
      row.history.reduce((sum, item) => sum + item.pointsAwarded, 0),
      row.createdAt.toLocaleDateString('es-PE', { timeZone: 'America/Lima' }),
    ]));
    sheet.eachRow((row, index) => {
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        const header = index <= 4;
        cell.font = { name: 'Aptos', size: index === 1 ? 20 : 11, bold: header,
          color: { argb: header ? 'FFFFFFFF' : 'FF153C50' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb:
          header ? (index === 2 ? 'FF087F8C' : 'FF153C50') : (index % 2 ? 'FFF0F6F8' : 'FFFFFFFF') } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.numFmt = column === 11 && !header ? '#,##0' : '@';
      });
      if (index > 4) row.height = 32;
    });
    sheet.autoFilter = { from: 'A4', to: `L${Math.max(4, sheet.rowCount)}` };
    return Buffer.from(await workbook.xlsx.writeBuffer());
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

  /** Actualiza los datos de contacto y pago del miembro. */
  async updateReferrer(id: string, dto: UpdateReferrerDto) {
    const existing = await this.prisma.referrer.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Miembro Ariz no encontrado');
    try {
      await this.prisma.referrer.update({ where: { id }, data: {
        name: dto.name, email: dto.email, phone: dto.phone,
        ...(dto.bankAccount !== undefined ? { bankAccount: dto.bankAccount?.trim() || null } : {}),
        ...(dto.yape !== undefined ? { yape: dto.yape?.trim() || null } : {}),
        ...(dto.plin !== undefined ? { plin: dto.plin?.trim() || null } : {}),
      } });
      return { id, updated: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este correo ya pertenece a otro miembro Ariz');
      }
      throw error;
    }
  }

  /** Oculta al miembro conservando su historial. */
  async deleteReferrer(id: string) {
    const referrer = await this.prisma.referrer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!referrer) throw new NotFoundException('Referente no encontrado');

    // El correo es unico: se libera al ocultar al miembro para que, si vuelve a
    // registrarse, empiece como miembro nuevo (otro codigo y 0 puntos). El correo
    // original queda dentro del valor para poder consultarlo.
    const hidden = await this.prisma.referrer.findUniqueOrThrow({
      where: { id },
      select: { email: true },
    });
    await this.prisma.referrer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: `eliminado+${Date.now()}+${hidden.email}`.slice(0, 250),
      },
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

        // Un miembro eliminado no se reactiva: se registra uno nuevo. Si se ocultó
        // antes de liberar su correo, se libera aquí para evitar el choque de unicidad.
        if (referrer?.deletedAt) {
          if (referrer.email === referrerEmail) {
            await tx.referrer.update({
              where: { id: referrer.id },
              data: { email: `eliminado+${Date.now()}+${referrer.email}`.slice(0, 250) },
            });
          }
          referrer = null;
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
      'Miembro Ariz': row.name,
      'Código Miembro Ariz': row.code,
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

    const data: Record<string, string | number>[] = [];

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
          'Código Miembro Ariz': referrer.code,
          'Miembro Ariz': referrer.name,
          'Email Miembro Ariz': referrer.email,
          'Teléfono Miembro Ariz': referrer.phone,
          'Tipo de pago': this.paymentTypeLabel(referrer),
          'Cuenta bancaria': referrer.bankAccount ?? '',
          'Número de Yape': referrer.yape ?? '',
          'Número de Plin': referrer.plin ?? '',
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

    const workbook = new Workbook();
    workbook.creator = 'Ariz Inmobiliaria';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Miembros Ariz y puntos', {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: false }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const headers = [
      'Código Miembro Ariz', 'Miembro Ariz', 'Email Miembro Ariz', 'Teléfono Miembro Ariz',
      'Tipo de pago', 'Cuenta bancaria', 'Número de Yape', 'Número de Plin',
      'Código Referido', 'Nombre Referido', 'Email Referido', 'Teléfono Referido',
      'Interés', 'Disponibilidad', 'Último Estado', 'Puntos', 'Proyecto', 'Fecha Registro',
    ];
    const widths = [20, 30, 34, 20, 28, 30, 20, 20, 20, 30, 34, 20, 24, 24, 28, 14, 30, 20];
    worksheet.columns = headers.map((key, index) => ({ key, width: widths[index] }));
    const navy = 'FF153C50';
    const teal = 'FF087F8C';
    const gold = 'FFF2B544';
    const banner = (row: number, text: string, color: string, size: number) => {
      worksheet.mergeCells(row, 1, row, headers.length);
      const cell = worksheet.getCell(row, 1);
      cell.value = text;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.font = { name: 'Aptos', size, bold: row === 1, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', indent: 1 };
    };
    banner(1, 'MIEMBROS ARIZ · REFERIDOS Y PUNTOS', navy, 22);
    worksheet.getRow(1).height = 44;
    banner(2, 'Programa de referidos · Reporte de seguimiento', navy, 12);
    worksheet.getRow(2).height = 26;
    banner(3, `Periodo: ${query.from || 'Inicio'} al ${query.to || 'Hoy'}${query.search ? ` · Búsqueda: ${query.search}` : ''}`, teal, 11);
    worksheet.getRow(3).height = 26;
    banner(4, `${referrers.length} miembros Ariz · ${data.length} referidos · ${data.reduce((sum, row) => sum + Number(row.Puntos), 0)} puntos · Emitido: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`, teal, 11);
    worksheet.getRow(4).height = 26;
    worksheet.addRow([]);
    const header = worksheet.addRow(headers);
    header.height = 34;
    header.eachCell((cell, column) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column >= 5 && column <= 8 ? teal : navy } };
      cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: gold } } };
    });
    data.forEach((record, index) => {
      const row = worksheet.addRow(headers.map((key) => record[key]));
      row.height = 32;
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = { name: 'Aptos', size: 11, color: { argb: navy } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFF0F6F8' : 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE7EC' } } };
        // Keep account and phone numbers as text, preserving leading zeros.
        cell.numFmt = column === 16 ? '#,##0' : '@';
        if (column === 16) {
          cell.font = { name: 'Aptos', size: 12, bold: true, color: { argb: teal } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });
    worksheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + data.length, column: headers.length } };
    worksheet.pageSetup.printTitlesRow = '1:6';
    worksheet.headerFooter.oddFooter = 'Ariz Inmobiliaria | Página &P de &N';
    return Buffer.from(await workbook.xlsx.writeBuffer());
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
