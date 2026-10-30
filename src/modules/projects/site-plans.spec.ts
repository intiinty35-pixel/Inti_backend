import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SitePlansService } from './site-plans.service';
import { SaveSitePlanDto, SitePlanDto } from './dto/site-plan.dto';
import { validPolygon } from './site-plan-geometry';
import { exportLotTable } from './site-plan-export';

jest.mock('../../database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

const projectId = 'e2f8b8d7-a542-4000-8899-123456789000';
const lotId = 'e2f8b8d7-a542-4000-8899-123456789001';
const path = [
  { lat: -12, lng: -77 },
  { lat: -12, lng: -76.9999 },
  { lat: -12.0001, lng: -76.9999 },
  { lat: -12.0001, lng: -77 },
];
function plan(): SitePlanDto {
  return {
    image: {
      url: 'https://res.cloudinary.com/test/image/upload/v1/plan.png',
      center: { lat: -12, lng: -77 },
      widthM: 250,
      heightM: 300,
      rotation: 0,
      opacity: 0.85,
    },
    logoUrl: '',
    zones: [],
    lots: [
      {
        id: lotId,
        code: 'L-01',
        block: 'A',
        street: '',
        address: '',
        type: '',
        dimensions: '10 x 12 m',
        areaM2: 120,
        perimeterM: 44,
        frontM: 10,
        price: 50000,
        priceM2: 416.67,
        status: 'AVAILABLE',
        cashAllowed: true,
        financingAllowed: true,
        financedPrice: 55000,
        downPayment: 10000,
        installments: 36,
        monthlyPayment: 1250,
        notes: '',
        path,
      },
    ],
  };
}
function setup() {
  const tx = {
    project: {
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({
        id: projectId,
        location: { latitude: -12, longitude: -77 },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    projectSitePlan: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    projectLot: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    tx,
    prisma,
    service: new SitePlansService(prisma as unknown as PrismaService),
  };
}

describe('Site plans: draft, publication and inventory', () => {
  it('requires a plan image before saving geometry, but permits an undrawn lot base', async () => {
    const { service } = setup();
    const next = plan();
    delete next.image;
    await expect(
      service.save(projectId, { plan: next, revision: 0, publish: false }),
    ).rejects.toThrow('Sube el plano');
    next.lots[0].path = [];
    await expect(
      service.save(projectId, { plan: next, revision: 0, publish: false }),
    ).resolves.toMatchObject({ revision: 1 });
    await expect(
      service.save(projectId, { plan: next, revision: 0, publish: true }),
    ).rejects.toThrow('Sube el plano');
  });
  it('starts with an empty lot base rather than copying legacy project inventory', async () => {
    const { service, tx } = setup();
    tx.project.findFirst.mockResolvedValue({
      id: projectId,
      name: 'Proyecto',
      currency: 'PEN',
      status: 'DRAFT',
      sitePlan: null,
      location: null,
      lots: [
        {
          id: lotId,
          lotNumber: 'Grupo A',
          block: 'A',
          areaM2: 120,
          frontM: 8,
          price: 50000,
          status: 'AVAILABLE',
          lotCount: 3,
        },
      ],
    } as never);
    const session = await service.admin(projectId);
    expect(session.plan).toMatchObject({ lots: [], zones: [] });
  });
  it('saves a draft without changing the public snapshot or live lot inventory', async () => {
    const { service, tx } = setup();
    await expect(
      service.save(projectId, { plan: plan(), revision: 0, publish: false }),
    ).resolves.toMatchObject({ revision: 1 });
    expect(tx.projectSitePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectId }) }),
    );
    expect(tx.projectSitePlan.update).not.toHaveBeenCalled();
    expect(tx.projectLot.deleteMany).not.toHaveBeenCalled();
  });
  it('publishes an apartment building without requiring lot polygons or a terrain image', async () => {
    const { service, tx } = setup();
    const snapshot: SitePlanDto = {
      mode: 'APARTMENTS', logoUrl: '', zones: [], lots: [], buildings: [{
        id: 'e2f8b8d7-a542-4000-8899-123456789010', name: 'Torre A', path,
        floors: [{ id: 'e2f8b8d7-a542-4000-8899-123456789011', number: 1, name: 'Piso 1', apartments: [{
          id: 'e2f8b8d7-a542-4000-8899-123456789012', code: '101', areaM2: 80, price: 150000, operation: 'SALE', status: 'AVAILABLE', maintenanceFee: 200, bedrooms: 2, bathrooms: 2, notes: '',
          path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
        }] }],
      }],
    };
    await service.save(projectId, { plan: snapshot, revision: 1, publish: true });
    expect(tx.projectSitePlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ published: snapshot }) }));
    expect(tx.project.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'DEPARTAMENTOS', totalLots: 1, totalBlocks: 1 }) }));
    expect(tx.projectLot.createMany).not.toHaveBeenCalled();
    tx.projectSitePlan.update.mockClear(); tx.projectLot.deleteMany.mockClear();
    await service.save(projectId, { plan: snapshot, revision: 2, publish: false });
    expect(tx.projectSitePlan.update).not.toHaveBeenCalled();
    expect(tx.projectLot.deleteMany).not.toHaveBeenCalled();
    tx.project.findFirst.mockResolvedValue({ id: projectId, category: 'LOTIZACION', location: { latitude: -12, longitude: -77 } } as never);
    tx.projectSitePlan.updateMany.mockClear();
    await expect(service.save(projectId, { plan: snapshot, revision: 3, publish: false })).rejects.toThrow('tipo del plano');
    expect(tx.projectSitePlan.updateMany).not.toHaveBeenCalled();
    tx.project.findFirst.mockResolvedValue({ id: projectId, category: 'DEPARTAMENTOS', location: { latitude: -12, longitude: -77 } } as never);
    await expect(service.save(projectId, { plan: plan(), revision: 3, publish: false })).rejects.toThrow('tipo del plano');
  });
  it('preserves the original PDF and selected page in the saved draft', async () => {
    const { service, tx } = setup();
    const snapshot = plan();
    Object.assign(snapshot.image!, {
      sourcePdfUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/plano.pdf',
      sourcePdfPage: 2,
      sourcePdfName: 'plano.pdf',
    });
    await service.save(projectId, { plan: snapshot, revision: 0, publish: false });
    expect(tx.projectSitePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ draft: snapshot }) }),
    );
    snapshot.image!.sourcePdfUrl = 'https://example.com/plano.pdf';
    await expect(service.save(projectId, { plan: snapshot, revision: 0, publish: false })).rejects.toThrow('PDF original');
  });
  it('persists crop metadata and rejects reversed crop bounds before saving', async () => {
    const { service, tx } = setup();
    const snapshot = plan();
    snapshot.image!.crop = { left: .1, top: .2, right: .9, bottom: .8 };
    const validated = plainToInstance(SaveSitePlanDto, { plan: snapshot, revision: 1, publish: false });
    expect(await validate(validated, { whitelist: true })).toEqual([]);
    expect(validated.plan.image!.crop).toEqual(snapshot.image!.crop);
    await service.save(projectId, validated);
    expect(tx.projectSitePlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ draft: snapshot }) }));
    tx.projectSitePlan.updateMany.mockClear();
    validated.plan.image!.crop!.left = .95;
    await expect(service.save(projectId, validated)).rejects.toThrow('recorte');
    expect(tx.projectSitePlan.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale revisions before replacing published inventory', async () => {
    const { service, tx } = setup();
    tx.projectSitePlan.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.save(projectId, { plan: plan(), revision: 2, publish: true }),
    ).rejects.toThrow('Otro administrador');
    expect(tx.projectLot.deleteMany).not.toHaveBeenCalled();
  });
  it('publishes stable lot IDs, statuses and the financing price for financing-only lots', async () => {
    const { service, tx } = setup();
    const next = plan();
    next.lots[0].cashAllowed = false;
    next.lots[0].status = 'RESERVED';
    await service.save(projectId, { plan: next, revision: 1, publish: true });
    expect(tx.projectSitePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ published: next }),
      }),
    );
    expect(tx.projectLot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: lotId,
          price: 55000,
          status: 'RESERVED',
        }),
      ],
    });
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { totalLots: 1, totalBlocks: 0, lotMode: 'INDIVIDUAL' },
      }),
    );
  });
  it('requires prices before publishing but permits an incomplete price in a draft', async () => {
    const { service } = setup();
    const next = plan();
    next.lots[0].price = 0;
    await expect(
      service.save(projectId, { plan: next, revision: 1, publish: true }),
    ).rejects.toThrow('Completa los precios');
    await expect(
      service.save(projectId, { plan: next, revision: 1, publish: false }),
    ).resolves.toMatchObject({ revision: 2 });
  });
  it('requires the original project location before publishing', async () => {
    const { service, tx } = setup();
    tx.project.findFirst.mockResolvedValue({ id: projectId, location: null });
    await expect(
      service.save(projectId, { plan: plan(), revision: 1, publish: true }),
    ).rejects.toThrow('punto exacto');
  });
  it('rejects duplicate codes within the same block', async () => {
    const { service } = setup();
    const next = plan();
    next.lots.push({
      ...next.lots[0],
      id: 'e2f8b8d7-a542-4000-8899-123456789002',
      code: ' l-01 ',
    });
    await expect(
      service.save(projectId, { plan: next, revision: 1, publish: false }),
    ).rejects.toThrow('duplicado');
  });
  it('allows a base lot without a polygon while requiring at least one drawn lot for publication', async () => {
    const { service } = setup();
    const next = plan();
    next.lots[0].path = [];
    await expect(
      service.save(projectId, { plan: next, revision: 0, publish: false }),
    ).resolves.toMatchObject({ revision: 1 });
    await expect(
      service.save(projectId, { plan: next, revision: 1, publish: true }),
    ).rejects.toThrow('Dibuja al menos');
  });
  it('does not expose a draft for unpublished or deleted projects', async () => {
    const { service, tx } = setup();
    tx.project.findFirst.mockResolvedValue(null);
    await expect(service.publicPlan('draft-project')).rejects.toThrow(
      'Proyecto no encontrado',
    );
    expect(tx.project.findFirst).toHaveBeenCalledWith({
      where: { slug: 'draft-project', status: 'PUBLISHED', isDeleted: false },
      include: { sitePlan: true },
    });
  });
  it('requires a configured project code before returning public plan data', async () => {
    const { service, tx } = setup();
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: null,
      sitePlan: { published: plan() },
    } as never);
    await expect(service.publicPlan('published-project')).rejects.toThrow(
      'código coordinado',
    );
  });
  it('allows public plan access only with the configured project code', async () => {
    const { service, tx } = setup();
    const accessCode = 'ABCDEF0123456789AB';
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: await argon2.hash(accessCode),
      sitePlanAccessCodeExpiresAt: new Date(Date.now() + 60_000),
      currency: 'PEN',
      sitePlan: { published: plan() },
    } as never);
    await expect(service.publicPlan('published-project', 'incorrecta')).rejects.toThrow(
      'código coordinado',
    );
    await expect(service.publicPlan('published-project', accessCode)).resolves.toMatchObject({
      currency: 'PEN',
      lots: expect.any(Array),
    });
  });
  it('rejects codes after their expiry time', async () => {
    const { service, tx } = setup();
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: await argon2.hash('ABCDEF0123456789AB'),
      sitePlanAccessCodeExpiresAt: new Date(Date.now() - 60_000),
      sitePlan: { published: plan() },
    } as never);
    await expect(service.publicPlan('published-project', 'ABCDEF0123456789AB')).rejects.toThrow(
      'código coordinado',
    );
  });
  it('lists access-code status without exposing stored hashes', async () => {
    const { service, tx } = setup();
    tx.project.findMany.mockResolvedValue([
      {
        id: projectId,
        name: 'Proyecto de prueba',
        slug: 'prueba',
        status: 'PUBLISHED',
        sitePlanAccessCodeHash: 'argon2-hash',
        sitePlanAccessCodeExpiresAt: new Date(Date.now() + 60_000),
      },
    ] as never);
    const [row] = await service.listAccessCodes();
    expect(row).toMatchObject({
      id: projectId,
      configured: true,
    });
    expect(row).not.toHaveProperty('sitePlanAccessCodeHash');
  });
  it('generates expiring random codes and stores only their hash', async () => {
    const { service, tx } = setup();
    const result = await service.generateAccessCode(projectId, 7);
    expect(result.code).toMatch(/^[A-F0-9]{18}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const savedHash = tx.project.update.mock.calls[0][0].data.sitePlanAccessCodeHash;
    expect(savedHash).not.toBe(result.code);
    expect(await argon2.verify(savedHash!, result.code)).toBe(true);
    expect(tx.project.update.mock.calls[0][0].data.sitePlanAccessCodeExpiresAt).toEqual(result.expiresAt);
    await expect(service.revokeAccessCode(projectId)).resolves.toEqual({ revoked: true });
    expect(tx.project.update.mock.calls[1][0].data).toEqual({
      sitePlanAccessCodeHash: null,
      sitePlanAccessCodeExpiresAt: null,
    });
  });
});

describe('Site plan validation and polygons', () => {
  it('rejects missing plan data rather than allowing an undefined payload', async () => {
    const errors = await validate(
      plainToInstance(SaveSitePlanDto, { revision: 0, publish: false }),
    );
    expect(errors.some((error) => error.property === 'plan')).toBe(true);
  });
  it('validates a complete payload and rejects non-finite coordinates', async () => {
    const next = { revision: 0, publish: false, plan: plan() };
    expect(await validate(plainToInstance(SaveSitePlanDto, next))).toEqual([]);
    next.plan.lots[0].path = [{ ...path[0], lat: Infinity }, ...path.slice(1)];
    expect(
      (await validate(plainToInstance(SaveSitePlanDto, next))).length,
    ).toBeGreaterThan(0);
  });
  it('accepts an independent project contour in the same payload as blocks and lots', async () => {
    const snapshot = plan();
    snapshot.zones = [{ id: projectId, kind: 'CONTOUR', name: 'Contorno', path }];
    const dto = plainToInstance(SaveSitePlanDto, { revision: 0, publish: false, plan: snapshot });
    expect(await validate(dto)).toEqual([]);
    const { service, tx } = setup();
    await service.save(projectId, dto);
    expect(tx.projectSitePlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ draft: snapshot }) }));
  });
  it('accepts convex and concave polygons, and rejects crossing or degenerate ones', () => {
    expect(validPolygon(path)).toBe(true);
    expect(
      validPolygon([
        path[0],
        path[1],
        { lat: -12.00005, lng: -76.99995 },
        path[2],
        path[3],
      ]),
    ).toBe(true);
    expect(validPolygon([path[0], path[2], path[1], path[3]])).toBe(false);
    expect(validPolygon([path[0], path[1], path[0]])).toBe(false);
  });
});

describe('Excel lot base and downloadable PDF', () => {
  it('exports manual and imported lots once, with sale prices and numeric measurements', async () => {
    const snapshot = plan();
    snapshot.lots.push({ ...snapshot.lots[0], id: projectId, code: 'L-02', cashAllowed: false });
    snapshot.lots.push({ ...snapshot.lots[0], code: 'NO-DIBUJADO', path: [] });
    const bytes = await exportLotTable(snapshot, { name: 'Proyecto', currency: 'USD' }, 'xlsx');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0];
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getColumn(1).values).not.toContain('NO-DIBUJADO');
    expect(sheet.getRow(1).values).not.toContain('Precio final');
    expect(sheet.getCell('E2').value).toBe(120);
    expect(sheet.getCell('J2').value).toBe(50000);
    expect(sheet.getCell('J3').value).toBe(55000);
    expect(sheet.getRow(1).values).not.toContain('Dibujo');
  });
  it('paginates a complete lot list as a real PDF', async () => {
    const snapshot = plan();
    snapshot.lots = Array.from({ length: 70 }, (_, i) => ({ ...snapshot.lots[0], code: `L-${i}` }));
    const bytes = await exportLotTable(snapshot, { name: 'Proyecto', currency: 'PEN' }, 'pdf');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1);
  });
  it('downloads an administrative draft without publishing or changing the project', async () => {
    const { service, tx } = setup();
    jest
      .spyOn(service, 'admin')
      .mockResolvedValue({
        project: { id: projectId, name: 'Proyecto borrador', currency: 'PEN' },
        plan: plan(),
        revision: 0,
      } as never);
    const pdf = await service.adminPdf(projectId, lotId, plan());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(tx.projectSitePlan.update).not.toHaveBeenCalled();
    expect(tx.project.update).not.toHaveBeenCalled();
  });
  it('rejects remote logo URLs outside the image library in the administrative PDF', async () => {
    const { service } = setup();
    jest
      .spyOn(service, 'admin')
      .mockResolvedValue({
        project: { name: 'Proyecto', currency: 'PEN' },
      } as never);
    const draft = plan();
    draft.logoUrl = 'http://127.0.0.1/private';
    await expect(service.adminPdf(projectId, lotId, draft)).rejects.toThrow(
      'biblioteca',
    );
  });
  it('round trips the template with dimensions and finance columns', async () => {
    const { service } = setup();
    const file = await service.template();
    const result = await service.importExcel(file);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      codigo: 'L-01',
      area_m2: '120',
      dimensiones: '8 x 15 m',
      financiado: 'si',
      cuotas: '36',
    });
  });
  it('reports bad numeric data with the Excel row number without changing inventory', async () => {
    const { service, tx } = setup();
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Lotes');
    sheet.addRow(['codigo', 'area_m2', 'precio_contado']);
    sheet.addRow(['L-02', 'no es un área', 50000]);
    await expect(
      service.importExcel(Buffer.from(await book.xlsx.writeBuffer())),
    ).rejects.toThrow('Fila 2');
    expect(tx.projectLot.createMany).not.toHaveBeenCalled();
  });
  it('downloads a published apartment as PDF and rejects missing or invalid access codes', async () => {
    const { service, tx, prisma } = setup();
    const accessCode = 'ABCDEF0123456789AB';
    const published: SitePlanDto = { ...plan(), mode: 'APARTMENTS', lots: [], buildings: [{
      id: projectId, name: 'Torre A', path, floors: [{ id: projectId, number: 1, name: 'Primer piso', apartments: [{
        id: lotId, code: '101', areaM2: 80, price: 150000, operation: 'SALE', status: 'RESERVED',
        maintenanceFee: 200, bedrooms: 2, bathrooms: 2, notes: 'Vista al parque',
        path: [{ x: .1, y: .1 }, { x: .5, y: .1 }, { x: .5, y: .5 }, { x: .1, y: .5 }],
      }] }],
    }] };
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: await argon2.hash(accessCode),
      sitePlanAccessCodeExpiresAt: new Date(Date.now() + 60_000),
      sitePlan: { published },
    } as never);
    Object.assign(prisma.project, { findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Proyecto de prueba', currency: 'PEN' }) });
    await expect(service.apartmentPdf('prueba', lotId)).rejects.toThrow();
    await expect(service.apartmentPdf('prueba', lotId, 'INVALID')).rejects.toThrow();
    const pdf = await service.apartmentPdf('prueba', lotId, accessCode);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    await expect(service.apartmentPdf('prueba', projectId, accessCode)).rejects.toThrow('Departamento no encontrado');
  });
  it('creates a real PDF from the published lot and includes the bundled INTI logo', async () => {
    const { service, tx, prisma } = setup();
    const accessCode = 'ABCDEF0123456789AB';
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: await argon2.hash(accessCode),
      sitePlanAccessCodeExpiresAt: new Date(Date.now() + 60_000),
      sitePlan: { published: plan() },
    } as never);
    Object.assign(prisma.project, {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ name: 'Proyecto de prueba', currency: 'PEN' }),
    });
    const pdf = await service.pdf('prueba', lotId, accessCode);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
    expect(prisma.project.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { slug: 'prueba' },
      include: { location: true },
    });
  });
  it('includes the project logo too and converts WebP logos to PNG before embedding them', async () => {
    const { service, tx, prisma } = setup();
    const accessCode = 'ABCDEF0123456789AB';
    const published = plan();
    published.logoUrl =
      'https://res.cloudinary.com/test/image/upload/v1/project.webp';
    tx.project.findFirst.mockResolvedValue({
      sitePlanAccessCodeHash: await argon2.hash(accessCode),
      sitePlanAccessCodeExpiresAt: new Date(Date.now() + 60_000),
      sitePlan: { published },
    } as never);
    Object.assign(prisma.project, {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ name: 'Proyecto de prueba', currency: 'USD' }),
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          new Uint8Array(
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              'base64',
            ),
          ),
        ),
      );
    try {
      const pdf = await service.pdf('prueba', lotId, accessCode);
      expect(
        (pdf.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length,
      ).toBeGreaterThanOrEqual(2);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://res.cloudinary.com/test/image/upload/f_png,w_500,c_limit/v1/project.webp',
        expect.objectContaining({ redirect: 'error' }),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
});
