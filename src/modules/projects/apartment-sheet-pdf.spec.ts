import { renderApartmentSheetPdf } from './apartment-sheet-pdf';
import type { PlanApartmentDto, PlanBuildingDto, PlanFloorDto, SitePlanDto } from './dto/site-plan.dto';

const unit: PlanApartmentDto = { id: 'unit', code: '109', areaM2: 85, price: 150000, operation: 'SALE', status: 'AVAILABLE', maintenanceFee: 200, bedrooms: 3, bathrooms: 2, notes: 'Vista al parque', financingAllowed: true, financedPrice: 170000, downPayment: 20000, installments: 36, interestRateMonthly: 0, monthlyPayment: 4166.67, path: [{ x: .2, y: .2 }, { x: .5, y: .2 }, { x: .5, y: .5 }, { x: .2, y: .5 }] };
const floor: PlanFloorDto = { id: 'floor', name: 'Piso 1', number: 1, apartments: [unit] };
const building: PlanBuildingDto = { id: 'building', name: 'Torre A', path: [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.999 }, { lat: -12.001, lng: -76.999 }], floors: [floor] };
const plan: SitePlanDto = { mode: 'APARTMENTS', logoUrl: '', lots: [], zones: [], buildings: [building] };
const project = { name: 'Proyecto de prueba', currency: 'PEN' };

describe('Apartment PDF sheet', () => {
  afterEach(() => jest.restoreAllMocks());
  it('creates separate information and location pages without a source image', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const bytes = await renderApartmentSheetPdf(unit, project, building.name, floor.name, { plan, building, floor });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('embeds the shared source once fetched and supports cropped floor images', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAAAWSURBVBiVY7z+7Ox/BjyACZ/k8FEAAKW3A5noi4KhAAAAAElFTkSuQmCC', 'base64');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, arrayBuffer: async () => png } as unknown as Response);
    const url = 'https://res.cloudinary.com/test/image/upload/plan.png';
    const withImage = { ...plan, image: { url, center: { lat: -12, lng: -77 }, widthM: 100, heightM: 150, rotation: 20, opacity: 1 } };
    const croppedFloor = { ...floor, image: { url, width: 1000, height: 1500, crop: { left: .1, top: .2, right: .8, bottom: .9 } } };
    const bytes = await renderApartmentSheetPdf(unit, project, building.name, floor.name, { plan: withImage, building, floor: croppedFloor });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bytes.toString('latin1')).toContain('/Subtype /Image');
    expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  });
  it('keeps vector plans available when remote images fail and does not fetch untrusted URLs', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    const remoteFloor = { ...floor, image: { url: 'https://example.com/plan.png', width: 1000, height: 700 } };
    const bytes = await renderApartmentSheetPdf(unit, project, building.name, floor.name, { plan, building, floor: remoteFloor });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    remoteFloor.image.url = 'https://res.cloudinary.com/test/image/upload/plan.png';
    expect((await renderApartmentSheetPdf(unit, project, building.name, floor.name, { plan, building, floor: remoteFloor })).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
