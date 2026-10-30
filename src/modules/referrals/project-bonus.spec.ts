import { ReferralsService } from './referrals.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ReferralStatus } from '../../generated/prisma/enums';

jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('../campaigns/campaign-points-tracker', () => ({ CampaignPointsTracker: class {} }));

describe('Inti project bonus points', () => {
  const projectId = 'project';
  const config = { projectId, contactedPoints: 20, visitPoints: 30, operationCompletedPoints: 50 };
  const prisma = {
    adminProject: { findMany: jest.fn(), findFirst: jest.fn() },
    projectPointsConfig: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
  };
  const campaigns = new CampaignsService(prisma as never);
  const referrals = new ReferralsService(prisma as never, {} as never, campaigns, {} as never);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminProject.findMany.mockResolvedValue([{ project: { id: projectId, name: 'Proyecto Inti', slug: 'ariz' } }]);
    prisma.adminProject.findFirst.mockResolvedValue({ projectId });
    prisma.projectPointsConfig.findMany.mockResolvedValue([config]);
    prisma.projectPointsConfig.findFirst.mockResolvedValue(config);
    prisma.projectPointsConfig.upsert.mockResolvedValue(config);
  });

  it('loads saved points for administrators and the public project selection', async () => {
    const admin = await campaigns.listProjectPoints();
    const publicProjects = await referrals.listArizProjectsWithPoints();
    expect(admin[0].points).toEqual({ CONTACTED: 20, VISIT: 30, OPERATION_COMPLETED: 50 });
    expect(publicProjects[0]).toMatchObject({ points: admin[0].points, totalExtraPoints: 100 });
    expect(prisma.adminProject.findMany.mock.calls[1][0].where.project).toEqual({ status: 'PUBLISHED', isDeleted: false });
  });

  it('saves separate extra points for each stage of a project', async () => {
    await campaigns.updateProjectPoints(projectId, { CONTACTED: 20, VISIT: 30, OPERATION_COMPLETED: 50 });
    expect(prisma.projectPointsConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId }, update: { contactedPoints: 20, visitPoints: 30, operationCompletedPoints: 50 },
    }));
  });

  it('returns the configured bonus for each state and zero without an eligible project', async () => {
    const bonus = (id: string | null, status: ReferralStatus) => referrals['arizProjectExtraPoints'](prisma as never, id, status);
    expect(await bonus(projectId, ReferralStatus.CONTACTED)).toBe(20);
    expect(await bonus(projectId, ReferralStatus.VISIT)).toBe(30);
    expect(await bonus(projectId, ReferralStatus.OPERATION_COMPLETED)).toBe(50);
    expect(prisma.projectPointsConfig.findFirst).toHaveBeenCalledWith({
      where: { projectId, project: { adminProject: { isNot: null }, isDeleted: false } },
    });
    expect(await bonus(null, ReferralStatus.CONTACTED)).toBe(0);
    prisma.projectPointsConfig.findFirst.mockResolvedValue(null);
    expect(await bonus('other', ReferralStatus.CONTACTED)).toBe(0);
  });
});
