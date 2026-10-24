import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

jest.mock('../../database/prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('cloudinary', () => ({ v2: { api: { resource: jest.fn() } } }));
jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }));

describe('Apartment project creation and publication', () => {
  const service = new ProjectsService({} as PrismaService, {} as ConfigService);
  const draft = () => plainToInstance(CreateProjectDto, {
    category: 'DEPARTAMENTOS', stage: 'PRE_SALE', currency: 'PEN', name: 'Torres del Parque', description: 'Proyecto de edificios',
    priceFrom: 200000, priceTo: 400000, lotMode: 'INDIVIDUAL', lots: [], estimatedDelivery: '2027-12-31',
    location: { department: 'Lima', province: 'Lima', district: 'Lima', latitude: -12, longitude: -77 },
    media: [{ type: 'IMAGE', url: 'https://res.cloudinary.com/test/image/upload/cover.jpg', isCover: true }],
  });
  it('creates a department project before its units are configured without requiring a legacy lot', async () => {
    const dto = draft();
    expect(await validate(dto)).toEqual([]);
    expect(() => service['validateProject'](dto)).not.toThrow();
    dto.category = 'LOTIZACION';
    expect(() => service['validateProject'](dto)).toThrow('al menos un lote');
  });
  it('publishes from the published apartment inventory, preserving the ordinary lot publication check', () => {
    const project = { category: 'DEPARTAMENTOS' as const, location: { latitude: -12, longitude: -77 }, media: [{ type: 'IMAGE' as const }], lots: [], sitePlan: { published: { mode: 'APARTMENTS', buildings: [{ floors: [{ apartments: [{ code: '101' }] }] }] } } };
    expect(() => service['validatePublishableProject'](project)).not.toThrow();
    expect(() => service['validatePublishableProject']({ ...project, sitePlan: null })).toThrow('publica el plano');
    expect(() => service['validatePublishableProject']({ ...project, category: 'LOTIZACION' })).toThrow('lotes');
  });
});
