import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
  ) {}

  async list(query: ReferralQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [referrers, total, statusPoints] = await Promise.all([
      this.prisma.referrer.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.referralsInclude(),
      }),
      this.prisma.referrer.count(),
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

  async getReferrerByCode(code: string) {
    const referrer = await this.prisma.referrer.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, name: true, email: true, phone: true },
    });
    return referrer;
  }

  /**
   * Lista publica de los referidos de un referente identificado por su codigo
   * REF-XXXXXXXX. Devuelve solo los campos necesarios para que el referente vea
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

    const referrer = await this.prisma.referrer.findUnique({
      where: { code: normalized },
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

    const referrerCode = dto.referrerCode?.trim().toUpperCase();
    const referrerEmail = dto.referrerEmail.trim().toLowerCase();
    const referralCode = await this.uniqueCode('RFD');
    let isNewReferrer = false;

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

        if (!referrer) {
          referrer = await tx.referrer.create({
            data: {
              code: await this.uniqueCode('REF'),
              name: dto.referrerName.trim(),
              email: referrerEmail,
              phone: dto.referrerPhone.trim(),
            },
          });
          isNewReferrer = true;
        }

        return tx.referral.create({
          data: {
            referrerId: referrer.id,
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone.trim(),
            interest: dto.interest,
            availability: dto.availability ?? ReferralAvailability.INMEDIATA,
            code: referralCode,
            status: ReferralStatus.CONTACTED,
            history: {
              create: {
                toStatus: ReferralStatus.CONTACTED,
                pointsAwarded: points.points,
                changedById,
              },
            },
          },
          include: {
            referrer: true,
          },
        });
      });

      const persisted = await this.prisma.referral.findUnique({
        where: { id: created.id },
        include: { history: true },
      });
      const totalPoints =
        persisted?.history.reduce((sum, item) => sum + item.pointsAwarded, 0) ??
        points.points;

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

      return { ...created, points: points.points, totalPoints };
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

      const pointsAwarded = reached ? 0 : configured.points;
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

      const updated = { ...current, status };
      return this.responseWithTotals(tx, updated, pointsAwarded, true);
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
      prefix === 'REF'
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
}
