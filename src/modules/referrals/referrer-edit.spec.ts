import { ReferralsService } from './referrals.service';
import { UpdateReferrerDto } from './dto/update-referrer.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

jest.mock('../../generated/prisma/client', () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../mail/mail.service', () => ({ MailService: class {} }));
jest.mock('../campaigns/campaigns.service', () => ({ CampaignsService: class {} }));
jest.mock('../campaigns/campaign-points-tracker', () => ({ CampaignPointsTracker: class {} }));

describe('Editing members', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const service = new ReferralsService({ referrer: { findUnique, update } } as never, {} as never, {} as never, {} as never);
  beforeEach(() => { jest.clearAllMocks(); findUnique.mockResolvedValue({ deletedAt: null }); });

  it('updates contact and payment fields without changing codes, points or referrals', async () => {
    await service.updateReferrer('member', { name: 'Ana', email: 'ana@example.com', phone: '900000001',
      bankAccount: '001234', yape: '', plin: ' 099000000 ', code: 'OTHER', deletedAt: new Date(), totalPoints: 100,
    } as UpdateReferrerDto);
    expect(update).toHaveBeenCalledWith({ where: { id: 'member' }, data: {
      name: 'Ana', email: 'ana@example.com', phone: '900000001', bankAccount: '001234', yape: null, plin: '099000000',
    } });
  });
  it('rejects missing or deleted members', async () => {
    const dto = { name: 'Ana', email: 'ana@example.com', phone: '900000001' };
    findUnique.mockResolvedValue(null);
    await expect(service.updateReferrer('missing', dto)).rejects.toThrow('Miembro Ariz no encontrado');
    findUnique.mockResolvedValue({ deletedAt: new Date() });
    await expect(service.updateReferrer('deleted', dto)).rejects.toThrow('Miembro Ariz no encontrado');
    expect(update).not.toHaveBeenCalled();
  });
  it('normalizes contact input and rejects blank names and invalid emails', async () => {
    const dto = plainToInstance(UpdateReferrerDto, { name: ' Ana ', email: ' ANA@EXAMPLE.COM ', phone: ' 900000001 ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ name: 'Ana', email: 'ana@example.com', phone: '900000001' });
    expect((await validate(plainToInstance(UpdateReferrerDto, { name: ' ', email: 'bad', phone: '' }))).length).toBeGreaterThan(0);
  });
  it('removes a member from listings while keeping their history', async () => {
    findUnique.mockResolvedValue({ id: 'member' });
    await service.deleteReferrer('member');
    expect(update).toHaveBeenCalledWith({ where: { id: 'member' }, data: { deletedAt: expect.any(Date) } });
  });
});
