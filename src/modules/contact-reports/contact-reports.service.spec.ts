import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ContactReportsService } from './contact-reports.service';

jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));

describe('ContactReportsService', () => {
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const service = new ContactReportsService(
    { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as PrismaService,
    {} as MailService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('marks a report deleted without removing its record', async () => {
    executeRaw.mockResolvedValue(1);
    await expect(service.remove('report-id')).resolves.toEqual({ id: 'report-id' });
    const [sql, id] = executeRaw.mock.calls[0] as [TemplateStringsArray, string];
    expect(sql.join('?')).toContain('UPDATE "contact_reports"');
    expect(sql.join('?')).toContain('"status" = \'DELETED\'');
    expect(sql.join('?')).not.toContain('DELETE FROM');
    expect(id).toBe('report-id');
  });

  it('rejects missing or already deleted reports', async () => {
    executeRaw.mockResolvedValue(0);
    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('excludes deleted reports from both the list and total, with ten per page', async () => {
    queryRaw.mockResolvedValueOnce([{ id: 'active' }]).mockResolvedValueOnce([{ count: 21n }]);
    const result = await service.list({ page: 2 });
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 21, hasMore: true });
    for (const [sql] of queryRaw.mock.calls as [TemplateStringsArray][]) {
      expect(sql.join('?')).toContain('WHERE "status" <> \'DELETED\'');
    }
    expect(queryRaw.mock.calls[0].slice(1)).toEqual([10, 10]);
  });
});
