import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validateApartmentPlan } from './apartment-plan-validation';
import { SitePlanDto } from './dto/site-plan.dto';

function plan(): SitePlanDto {
  return {
    mode: 'APARTMENTS', logoUrl: '', lots: [], zones: [], buildings: [{
      id: 'e2f8b8d7-a542-4000-8899-123456789001', name: 'Torre A',
      path: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }, { lat: -12.001, lng: -76.999 }, { lat: -12.001, lng: -77 }],
      floors: [{
        id: 'e2f8b8d7-a542-4000-8899-123456789002', number: 1, name: 'Piso 1',
        image: { url: 'https://res.cloudinary.com/test/image/upload/v1/floor.png', width: 1000, height: 700 },
        apartments: [{
          id: 'e2f8b8d7-a542-4000-8899-123456789003', code: '101', areaM2: 85, price: 2500, operation: 'RENT', status: 'RENTED', maintenanceFee: 180, bedrooms: 3, bathrooms: 2, notes: '',
          path: [{ x: .1, y: .1 }, { x: .8, y: .1 }, { x: .8, y: .8 }, { x: .1, y: .8 }],
        }],
      }],
    }],
  };
}
describe('Apartment plans', () => {
  it('retains nested apartment data through DTO whitelisting and accepts rental availability', async () => {
    const dto = plainToInstance(SitePlanDto, plan());
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.buildings![0].floors[0].apartments[0]).toMatchObject({ code: '101', operation: 'RENT', status: 'RENTED', maintenanceFee: 180 });
    expect(validateApartmentPlan(dto, true)).toBe(1);
  });
  it('permits incomplete tower drafts but requires apartments and prices before publication', () => {
    const dto = plan();
    dto.buildings![0].floors = [];
    expect(validateApartmentPlan(dto, false)).toBe(0);
    expect(() => validateApartmentPlan(dto, true)).toThrow('pisos');
    const missingPrice = plan(); missingPrice.buildings![0].floors[0].apartments[0].price = 0;
    expect(validateApartmentPlan(missingPrice, false)).toBe(1);
    expect(() => validateApartmentPlan(missingPrice, true)).toThrow('precio');
  });
  it('rejects duplicated floors, unit codes and shared IDs', () => {
    const dto = plan();
    dto.buildings![0].floors.push({ ...dto.buildings![0].floors[0], id: 'e2f8b8d7-a542-4000-8899-123456789004' });
    expect(() => validateApartmentPlan(dto, false)).toThrow('pisos');
    const duplicate = plan();
    duplicate.buildings![0].floors[0].apartments.push({ ...duplicate.buildings![0].floors[0].apartments[0], id: 'e2f8b8d7-a542-4000-8899-123456789005' });
    expect(() => validateApartmentPlan(duplicate, false)).toThrow('repetido');
    const ids = new Set([plan().buildings![0].id]);
    expect(() => validateApartmentPlan(plan(), false, ids)).toThrow('Identificador duplicado');
  });
  it('rejects invalid floor coordinates, crossed paths and incompatible operation states', async () => {
    const dto = plan(); dto.buildings![0].floors[0].apartments[0].path[0].x = -1;
    expect((await validate(plainToInstance(SitePlanDto, dto))).length).toBeGreaterThan(0);
    const crossed = plan(), path = crossed.buildings![0].floors[0].apartments[0].path;
    [path[1], path[2]] = [path[2], path[1]];
    expect(() => validateApartmentPlan(crossed, false)).toThrow('dibujo');
    const operation = plan(); operation.buildings![0].floors[0].apartments[0].operation = 'SALE';
    expect(() => validateApartmentPlan(operation, false)).toThrow('operación');
  });
  it('rejects floor image sources outside the project image library', () => {
    const dto = plan(); dto.buildings![0].floors[0].image!.url = 'https://example.com/floor.png';
    expect(() => validateApartmentPlan(dto, false)).toThrow('biblioteca');
  });
  it('preserves shared base image references and floor-only crop metadata through whitelisting', async () => {
    const input = plan();
    input.buildings![0].floors[0].imageSource = 'BASE';
    input.buildings![0].floors[0].image!.crop = {left:.1,top:.2,right:.9,bottom:.8};
    const dto = plainToInstance(SitePlanDto,input);
    expect(await validate(dto,{whitelist:true})).toEqual([]);
    expect(dto.buildings![0].floors[0].imageSource).toBe('BASE');
    expect(dto.buildings![0].floors[0].image!.crop).toEqual(input.buildings![0].floors[0].image!.crop);
    expect(validateApartmentPlan(dto,true)).toBe(1);
    dto.buildings![0].floors[0].image!.crop!.left=.95;
    expect(()=>validateApartmentPlan(dto,false)).toThrow('recorte');
  });
});

describe('Apartment financing', () => {
  function financed() {
    const dto = plan();
    const unit = dto.buildings![0].floors[0].apartments[0];
    Object.assign(unit, { operation: 'SALE', status: 'AVAILABLE', financingAllowed: true, financedPrice: 120000, downPayment: 20000, installments: 10, interestRateMonthly: 0, monthlyPayment: 1 });
    return { dto, unit };
  }
  it('preserves credit fields through whitelisting and recalculates the payment', async () => {
    const { dto } = financed();
    const saved = plainToInstance(SitePlanDto, dto);
    expect(await validate(saved, { whitelist: true })).toEqual([]);
    validateApartmentPlan(saved, true);
    expect(saved.buildings![0].floors[0].apartments[0]).toMatchObject({ financingAllowed: true, financedPrice: 120000, downPayment: 20000, installments: 10, monthlyPayment: 10000 });
  });
  it('calculates amortized monthly interest', () => {
    const { dto, unit } = financed(); unit.interestRateMonthly = 1;
    validateApartmentPlan(dto, true);
    expect(unit.monthlyPayment).toBe(10558.21);
  });
  it('rejects missing terms, excessive initial payments and rental financing', () => {
    for (const patch of [{ installments: 0 }, { downPayment: 120001 }, { financedPrice: undefined }, { operation: 'RENT' }, { interestRateMonthly: -1 }]) {
      const { dto, unit } = financed(); Object.assign(unit, patch);
      expect(() => validateApartmentPlan(dto, false)).toThrow();
    }
  });
});
