import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ProjectsService } from './projects.service';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('cloudinary', () => ({ v2: { api: { resource: jest.fn() } } }));
jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));

describe('Project video duration', () => {
  const resource = cloudinary.api.resource as jest.Mock;
  const service = new ProjectsService(
    {} as PrismaService,
    { getOrThrow: () => 'cloudinary://key:secret@test-cloud' } as unknown as ConfigService,
  );
  const url = 'https://res.cloudinary.com/test-cloud/video/upload/v123/ariz/projects/test.mp4';

  beforeEach(() => jest.resetAllMocks());

  it.each([10.005, 20, 120, '20'])('accepts a duration of %s seconds and requests metadata', async (duration) => {
    resource.mockResolvedValue({ duration });
    await expect(service['validateTourVideo'](url)).resolves.toBeUndefined();
    expect(resource).toHaveBeenCalledWith('ariz/projects/test', expect.objectContaining({
      resource_type: 'video', media_metadata: true,
    }));
  });

  it('rejects videos exceeding two minutes', async () => {
    resource.mockResolvedValue({ duration: 120.01 });
    await expect(service['validateTourVideo'](url)).rejects.toThrow('máximo 2 minutos');
  });

  it('reports missing metadata separately from an overlong video', async () => {
    resource.mockResolvedValue({});
    await expect(service['validateTourVideo'](url)).rejects.toThrow('No se pudo leer la duración');
  });
});
