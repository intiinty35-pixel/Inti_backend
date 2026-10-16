import { ReferralsService } from './referrals.service';
import { ReferralStatus, PointMovementType, ReferralInterest, ReferralAvailability } from '../../generated/prisma/enums';

jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class { sendWelcome() {} sendReferrerWelcome() {} sendReferralRegisteredToAdmin() {} } }));
jest.mock('../campaigns/campaigns.service', () => ({ CampaignsService: class { validateCampaignCode() { return Promise.resolve(null); } } }));
jest.mock('../campaigns/campaign-points-tracker', () => ({ CampaignPointsTracker: class { processReferralStatusChange() { return Promise.resolve(0); } } }));

const buildPrismaMock = () => {
  const referrerFindFirst = jest.fn();
  const referrerFindUnique = jest.fn();
  const referrerCreate = jest.fn();
  const referralCreate = jest.fn();
  const referralFindUnique = jest.fn();
  const registrationReferralCreate = jest.fn();
  const pointMovementCreate = jest.fn();
  const referralStatusPointFindUnique = jest.fn();
  const projectPointsConfigFindFirst = jest.fn();

  const tx = {
    referrer: { findUnique: referrerFindUnique, findFirst: referrerFindFirst, create: referrerCreate },
    referral: { create: referralCreate, findUnique: referralFindUnique },
    registrationReferral: { create: registrationReferralCreate },
    pointMovement: { create: pointMovementCreate },
    referralStatusPoint: { findUnique: referralStatusPointFindUnique },
    projectPointsConfig: { findFirst: projectPointsConfigFindFirst },
  };

  const $transaction = jest.fn((fn: (client: typeof tx) => unknown) => fn(tx));

  return {
    prisma: {
      referrer: { findFirst: referrerFindFirst, findUnique: referrerFindUnique, create: referrerCreate },
      referral: { create: referralCreate, findUnique: referralFindUnique },
      registrationReferral: { create: registrationReferralCreate },
      pointMovement: { create: pointMovementCreate },
      referralStatusPoint: { findUnique: referralStatusPointFindUnique },
      projectPointsConfig: { findFirst: projectPointsConfigFindFirst },
      $transaction,
    },
    tx,
    referrerFindFirst,
    referrerFindUnique,
    referrerCreate,
    referralCreate,
    referralFindUnique,
    registrationReferralCreate,
    pointMovementCreate,
    referralStatusPointFindUnique,
    projectPointsConfigFindFirst,
    $transaction,
  };
};

const buildDto = (overrides: Partial<{
  referrerName: string;
  referrerEmail: string;
  referrerPhone: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  availability: string;
  invitedByCode: string;
}> = {}) => ({
  referrerName: 'Nuevo Miembro',
  referrerEmail: 'nuevo@example.com',
  referrerPhone: '51999123456',
  name: 'Referido',
  email: 'referido@example.com',
  phone: '51999654321',
  interest: ReferralInterest.VENTA,
  availability: ReferralAvailability.INMEDIATA,
  ...overrides,
});

const buildService = (prisma: ReturnType<typeof buildPrismaMock>['prisma']) => {
  const mail = { sendWelcome: jest.fn(), sendReferrerWelcome: jest.fn(), sendReferralRegisteredToAdmin: jest.fn() } as never;
  const campaigns = { validateCampaignCode: jest.fn().mockResolvedValue(null) } as never;
  const campaignTracker = { processReferralStatusChange: jest.fn().mockResolvedValue(0) } as never;
  return new ReferralsService(prisma, mail, campaigns, campaignTracker);
};

describe('Registration referral rewards', () => {
  let mocks: ReturnType<typeof buildPrismaMock>;
  let service: ReferralsService;

  beforeEach(() => {
    mocks = buildPrismaMock();
    service = buildService(mocks.prisma);
    mocks.referralStatusPointFindUnique.mockResolvedValue({ status: ReferralStatus.CONTACTED, points: 10 });
    mocks.projectPointsConfigFindFirst.mockResolvedValue(null);
    mocks.referrerFindUnique.mockResolvedValue(null);
    mocks.referrerFindFirst.mockResolvedValue(null);
    mocks.referralFindUnique.mockResolvedValue(null);
    mocks.referrerCreate.mockResolvedValue({ id: 'new-referrer-1', code: 'APCOD-NEW001', email: 'nuevo@example.com', name: 'Nuevo Miembro', phone: '51999123456', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), bankAccount: null, yape: null, plin: null });
    mocks.referralCreate.mockResolvedValue({ id: 'referral-1', code: 'RFD-0001', referrerId: 'new-referrer-1', referrer: { id: 'new-referrer-1', code: 'APCOD-NEW001', name: 'Nuevo Miembro', email: 'nuevo@example.com', phone: '51999123456' } });
    mocks.registrationReferralCreate.mockResolvedValue({ id: 'rr-1' });
    mocks.pointMovementCreate.mockResolvedValue({ id: 'pm-1' });
  });

  it('does not award points when registering without an invitedByCode', async () => {
    const dto = buildDto();
    await service.create(dto);

    expect(mocks.registrationReferralCreate).not.toHaveBeenCalled();
    expect(mocks.pointMovementCreate).not.toHaveBeenCalled();
  });

  it('awards 50 points to the inviter when a valid invitedByCode is provided for a new member', async () => {
    const dto = buildDto({ invitedByCode: 'APCOD-INVITE' });
    mocks.referrerFindFirst.mockResolvedValueOnce({
      id: 'inviter-1',
      code: 'APCOD-INVITE',
      email: 'inviter@example.com',
      deletedAt: null,
    });

    await service.create(dto);

    expect(mocks.referrerFindFirst).toHaveBeenCalledWith({
      where: { code: 'APCOD-INVITE', deletedAt: null },
      select: { id: true, code: true, email: true },
    });
    expect(mocks.registrationReferralCreate).toHaveBeenCalledWith({
      data: {
        newReferrerId: 'new-referrer-1',
        inviterId: 'inviter-1',
        inviterCode: 'APCOD-INVITE',
        pointsAwarded: 50,
      },
    });
    expect(mocks.pointMovementCreate).toHaveBeenCalledWith({
      data: {
        referrerId: 'inviter-1',
        points: 50,
        type: PointMovementType.POINTS_EARNED,
        description: 'Recompensa por registro con código APCOD-INVITE',
      },
    });
  });

  it('does not award points when the inviter code is invalid', async () => {
    const dto = buildDto({ invitedByCode: 'APCOD-INVALID' });
    mocks.referrerFindFirst.mockResolvedValueOnce(null);

    await service.create(dto);

    expect(mocks.registrationReferralCreate).not.toHaveBeenCalled();
    expect(mocks.pointMovementCreate).not.toHaveBeenCalled();
  });

  it('does not award points when the inviter is the same as the new member (self-referral)', async () => {
    const dto = buildDto({ referrerEmail: 'self@example.com', invitedByCode: 'APCOD-SELF' });
    mocks.referrerFindFirst.mockResolvedValueOnce({
      id: 'inviter-1',
      code: 'APCOD-SELF',
      email: 'self@example.com',
      deletedAt: null,
    });

    await service.create(dto);

    expect(mocks.registrationReferralCreate).not.toHaveBeenCalled();
    expect(mocks.pointMovementCreate).not.toHaveBeenCalled();
  });

  it('allows the same inviter code to be used by multiple new members', async () => {
    for (let i = 1; i <= 5; i++) {
      const dto = buildDto({ referrerEmail: `member${i}@example.com`, invitedByCode: 'APCOD-INVITE' });
      mocks.referrerFindFirst.mockResolvedValueOnce({
        id: 'inviter-1',
        code: 'APCOD-INVITE',
        email: 'inviter@example.com',
        deletedAt: null,
      });
      mocks.referrerCreate.mockResolvedValue({ id: `new-referrer-${i}`, code: `APCOD-NEW00${i}`, email: `member${i}@example.com`, name: 'Nuevo Miembro', phone: '51999123456', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), bankAccount: null, yape: null, plin: null });
      mocks.referralCreate.mockResolvedValue({ id: `referral-${i}`, code: `RFD-000${i}`, referrerId: `new-referrer-${i}`, referrer: { id: `new-referrer-${i}`, code: `APCOD-NEW00${i}`, name: 'Nuevo Miembro', email: `member${i}@example.com`, phone: '51999123456' } });
      mocks.registrationReferralCreate.mockResolvedValue({ id: `rr-${i}` });
      mocks.pointMovementCreate.mockResolvedValue({ id: `pm-${i}` });

      await service.create(dto);
    }

    expect(mocks.registrationReferralCreate).toHaveBeenCalledTimes(5);
    expect(mocks.pointMovementCreate).toHaveBeenCalledTimes(5);
  });

  it('does not award points when the referrer already exists (not a new member)', async () => {
    const dto = buildDto({ referrerEmail: 'existing@example.com', invitedByCode: 'APCOD-INVITE' });
    mocks.referrerFindFirst.mockResolvedValueOnce({
      id: 'inviter-1',
      code: 'APCOD-INVITE',
      email: 'inviter@example.com',
      deletedAt: null,
    });
    mocks.referrerFindFirst.mockResolvedValueOnce({
      id: 'existing-referrer',
      code: 'APCOD-EXIST',
      email: 'existing@example.com',
      deletedAt: null,
    });

    await service.create(dto);

    expect(mocks.referrerCreate).not.toHaveBeenCalled();
    expect(mocks.registrationReferralCreate).not.toHaveBeenCalled();
    expect(mocks.pointMovementCreate).not.toHaveBeenCalled();
  });

  it('normalizes the invitedByCode to uppercase', async () => {
    const dto = buildDto({ invitedByCode: 'apcod-lower' });
    mocks.referrerFindFirst.mockResolvedValueOnce({
      id: 'inviter-1',
      code: 'APCOD-LOWER',
      email: 'inviter@example.com',
      deletedAt: null,
    });

    await service.create(dto);

    expect(mocks.referrerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'APCOD-LOWER', deletedAt: null } }),
    );
  });
});
