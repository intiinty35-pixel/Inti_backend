import { Workbook } from 'exceljs';
import { ReferralsService } from './referrals.service';

jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('../campaigns/campaigns.service', () => ({ CampaignsService: class {} }));
jest.mock('../campaigns/campaign-points-tracker', () => ({ CampaignPointsTracker: class {} }));

describe('Referral Excel export', () => {
  const findMany = jest.fn();
  const service = new ReferralsService({ referrer: { findMany } } as never, {} as never, {} as never, {} as never);

  it('exports payment details as text, points as numbers, and styled fixed headers with date filters', async () => {
    findMany.mockResolvedValue([{
      code: 'M001', name: 'Miembro de prueba', email: 'test@example.com', phone: '900000000',
      bankAccount: '00123456789012345678', yape: '099123456', plin: '098123456',
      referrals: [{ code: 'R001', name: 'Referido', email: 'ref@example.com', phone: '900000001',
        interest: 'VENTA', availability: 'INMEDIATA', project: null, createdAt: new Date('2026-10-10T12:00:00Z'),
        history: [{ toStatus: 'VISIT', pointsAwarded: 20 }],
      }],
    }]);
    const buffer = await service.exportExcel({ from: '2026-10-08', to: '2026-10-14' });
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('F7').value).toBe('00123456789012345678');
    expect(sheet.getCell('G7').value).toBe('099123456');
    expect(sheet.getCell('H7').value).toBe('098123456');
    expect(sheet.getCell('P7').value).toBe(20);
    expect(sheet.getCell('A7').value).toBe('M001');
    expect(sheet.getCell('O7').value).toBe('Visita');
    expect(sheet.getCell('A3').value).toContain('2026-10-08 al 2026-10-14');
    expect(sheet.getCell('A6').fill).toMatchObject({ fgColor: { argb: 'FF153C50' } });
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 });
    expect(sheet.autoFilter).toBeTruthy();
    expect(findMany.mock.calls[0][0].where.referrals.some.createdAt).toEqual({
      gte: new Date('2026-10-08T05:00:00Z'), lt: new Date('2026-10-15T05:00:00Z'),
    });
  });

  it('keeps headers and a valid workbook when there are no matching referrals', async () => {
    findMany.mockResolvedValue([]);
    const workbook = new Workbook();
    await workbook.xlsx.load(await service.exportExcel() as never);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('F6').value).toBe('Cuenta bancaria');
    expect(sheet.getCell('G6').value).toBe('Número de Yape');
    expect(sheet.getCell('A4').value).toContain('0 miembros Ariz · 0 referidos · 0 puntos');
  });
});
