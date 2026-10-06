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
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';

const STATUS_LABELS: Record<ReferralStatus, string> = {
  [ReferralStatus.CONTACTED]: 'Contactado',
  [ReferralStatus.VISIT]: 'Visita',
  [ReferralStatus.OPERATION_COMPLETED]: 'Operación concretada',
};

export interface ReferralHistoryRecord {
  id: string;
  fromStatus: ReferralStatus | null;
  toStatus: ReferralStatus;
  pointsAwarded: number;
  createdAt: Date;
}

export interface ReferralWithHistory {
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
      statusPoints: statusPoints.map((item) => ({
        status: item.status,
        label: STATUS_LABELS[item.status],
        points: item.points,
      })),
    };
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
        // Primero buscar por código si se proporcionó
        let referrer = referrerCode
          ? await tx.referrer.findUnique({ where: { code: referrerCode } })
          : null;
        
        // Si no se encontró por código, buscar por email
        if (!referrer) {
          referrer = await tx.referrer.findFirst({ where: { email: referrerEmail } });
        }
        
        // Si aún no existe, crear nuevo referente
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
            projectId: dto.projectId,
            code: referralCode,
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
            project: { select: { id: true, name: true } },
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
        projectName: result.project?.name ?? 'Sin proyecto',
        status: STATUS_LABELS[status],
        pointsAwarded: result.pointsAwarded,
        referralPoints: result.points,
        totalPoints: result.totalPoints,
      });
    }
    return result;
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
