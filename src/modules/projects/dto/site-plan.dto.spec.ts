import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PlanZoneDto } from './site-plan.dto';

describe('Park zone validation', () => {
  const park = {
    id: 'e2f8b8d7-a542-4000-8899-123456789000',
    kind: 'PARK',
    name: 'Parque Central',
    path: [
      { lat: -12, lng: -77 },
      { lat: -12, lng: -76.9998 },
      { lat: -12.0001, lng: -76.9997 },
      { lat: -12.0002, lng: -76.9998 },
      { lat: -12.0002, lng: -77 },
    ],
  };

  it('accepts a park with more than four vertices', async () => {
    expect(await validate(plainToInstance(PlanZoneDto, park))).toEqual([]);
  });

  it('rejects a park with fewer than three vertices', async () => {
    const errors = await validate(plainToInstance(PlanZoneDto, { ...park, path: park.path.slice(0, 2) }));
    expect(errors.some(error => error.property === 'path')).toBe(true);
  });
});
