import { Workbook } from 'exceljs';
import { ReferralsService } from './referrals.service';
import { ReferralRecordsQueryDto } from './dto/referral-records-query.dto';

jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('../campaigns/campaigns.service', () => ({ CampaignsService: class {} }));
jest.mock('../campaigns/campaign-points-tracker', () => ({ CampaignPointsTracker: class {} }));

describe('Referral records', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const aggregate = jest.fn();
  const findUnique = jest.fn();
  const deleteRecord = jest.fn();
  const upsert = jest.fn();
  const tx = { referral: { findUnique }, referralStatusHistory: { upsert } };
  const service = new ReferralsService({ referral: { findMany, count, findUnique, delete: deleteRecord }, referralStatusHistory: { aggregate },
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  } as never, {} as never, {} as never, {} as never);
  const row = {
    id: 'referral', code: 'R001', name: 'Referido', phone: '099123456', email: 'ref@example.com',
    status: 'VISIT', interest: 'VENTA', availability: 'INMEDIATA', createdAt: new Date('2026-10-10T12:00:00Z'),
    referrer: { id: 'member', code: 'M001', name: 'Miembro Inti' }, project: null,
    history: [{ pointsAwarded: 5 }, { pointsAwarded: 20 }],
  };
  beforeEach(() => {
    jest.clearAllMocks(); findMany.mockResolvedValue([row]); count.mockResolvedValue(30);
    aggregate.mockResolvedValue({ _sum: { pointsAwarded: 1000 } });
  });
  it('paginates referrals, filters by current status and registration dates, and counts all matching results', async () => {
    const query = Object.assign(new ReferralRecordsQueryDto(), { page: 2, search: 'Referido', from: '2026-10-08', to: '2026-10-14', status: 'VISIT' });
    const result = await service.listRecords(query);
    const options = findMany.mock.calls[0][0];
    expect(options).toMatchObject({ skip: 12, take: 12, where: { referrer: { deletedAt: null }, status: 'VISIT',
      createdAt: { gte: new Date('2026-10-08T05:00:00Z'), lt: new Date('2026-10-15T05:00:00Z') } } });
    expect(options.where.OR).toContainEqual({ name: { contains: 'Referido', mode: 'insensitive' } });
    expect(count.mock.calls[0][0]).toEqual({ where: options.where });
    expect(aggregate.mock.calls[0][0].where).toEqual({ referral: options.where });
    expect(result).toMatchObject({ total: 30, page: 2, pageSize: 12, totals: { points: 1000 },
      items: [{ name: 'Referido', points: 25, statusLabel: 'Visita', referrer: { name: 'Miembro Inti' } }] });
  });
  it('exports all filtered referrals with distinct referral and member columns, preserving phone numbers', async () => {
    const query = Object.assign(new ReferralRecordsQueryDto(), { page: 2, status: 'VISIT' });
    const workbook = new Workbook();
    await workbook.xlsx.load(await service.exportRecordsExcel(query) as never);
    const sheet = workbook.worksheets[0];
    expect(findMany.mock.calls[0][0].skip).toBeUndefined();
    expect(findMany.mock.calls[0][0].where.status).toBe('VISIT');
    expect(sheet.getCell('B5').value).toBe('Referido');
    expect(sheet.getCell('C5').value).toBe('099123456');
    expect(sheet.getCell('E5').value).toBe('Miembro Inti');
    expect(sheet.getCell('K5').value).toBe(25);
  });

  it('sets the requested total by adjusting only points in the current history entry', async () => {
    findUnique.mockResolvedValue({ status: 'VISIT', history: [
      { toStatus: 'CONTACTED', pointsAwarded: 10 }, { toStatus: 'VISIT', pointsAwarded: 20 },
    ] });
    await expect(service.setRecordPoints('referral', 5, 'admin')).resolves.toEqual({ id: 'referral', points: 5 });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { referralId_toStatus: { referralId: 'referral', toStatus: 'VISIT' } },
      update: { pointsAwarded: -5, changedById: 'admin' },
    });
    expect(10 + upsert.mock.calls[0][0].update.pointsAwarded).toBe(5);
  });

  it('handles referrals without history and rejects missing referrals', async () => {
    findUnique.mockResolvedValue({ status: 'CONTACTED', history: [] });
    await service.setRecordPoints('referral', 0, 'admin');
    expect(upsert.mock.calls[0][0].create).toMatchObject({ pointsAwarded: 0, toStatus: 'CONTACTED' });
    findUnique.mockResolvedValue(null);
    await expect(service.setRecordPoints('missing', 10, 'admin')).rejects.toThrow('Referido no encontrado');
    await expect(service.deleteRecord('missing')).rejects.toThrow('Referido no encontrado');
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it('deletes only the selected referral', async () => {
    findUnique.mockResolvedValue({ id: 'referral' });
    await expect(service.deleteRecord('referral')).resolves.toEqual({ deleted: true });
    expect(deleteRecord).toHaveBeenCalledWith({ where: { id: 'referral' } });
  });
});
