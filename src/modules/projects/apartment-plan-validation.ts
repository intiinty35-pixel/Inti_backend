import { BadRequestException } from '@nestjs/common';
import type { SitePlanDto } from './dto/site-plan.dto';
import { validPolygon } from './site-plan-geometry';

export function validateApartmentPlan(plan: SitePlanDto, publish: boolean, ids = new Set<string>()) {
  const buildings = plan.buildings ?? [];
  const claim = (id: string) => {
    if (ids.has(id)) throw new BadRequestException('Identificador duplicado en edificios, pisos o departamentos');
    ids.add(id);
  };
  const names = new Set<string>();
  let total = 0;
  for (const building of buildings) {
    claim(building.id);
    const name = building.name.trim().toLowerCase();
    if (!name || names.has(name)) throw new BadRequestException('Cada edificio debe tener un nombre único');
    names.add(name);
    if (!validPolygon(building.path)) throw new BadRequestException(`Revisa el contorno de ${building.name}`);
    const numbers = new Set<number>();
    for (const floor of building.floors) {
      claim(floor.id);
      if (!floor.name.trim() || numbers.has(floor.number)) throw new BadRequestException(`Revisa los pisos de ${building.name}: el número no debe repetirse`);
      numbers.add(floor.number);
      if (floor.image && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(floor.image.url))
        throw new BadRequestException('Sube el plano de cada piso a la biblioteca del proyecto');
      if (floor.image?.crop && (floor.image.crop.left >= floor.image.crop.right || floor.image.crop.top >= floor.image.crop.bottom))
        throw new BadRequestException(`Revisa el recorte del plano de ${floor.name}`);
      const codes = new Set<string>();
      for (const unit of floor.apartments) {
        claim(unit.id);
        const code = unit.code.trim().toLowerCase();
        if (!code || codes.has(code)) throw new BadRequestException(`Número de departamento vacío o repetido en ${floor.name}`);
        codes.add(code);
        if (!validPolygon(unit.path.map(p => ({ lat: p.y, lng: p.x }))))
          throw new BadRequestException(`Revisa el dibujo del departamento ${unit.code}`);
        if ((unit.operation === 'SALE' && unit.status === 'RENTED') || (unit.operation === 'RENT' && unit.status === 'SOLD'))
          throw new BadRequestException(`El estado de ${unit.code} no corresponde a su operación`);
        if (publish && unit.price <= 0) throw new BadRequestException(`Completa el precio del departamento ${unit.code}`);
        total++;
      }
      if (publish && !floor.apartments.length) throw new BadRequestException(`Agrega los departamentos de ${building.name}, ${floor.name}`);
    }
    if (publish && !building.floors.length) throw new BadRequestException(`Agrega los pisos de ${building.name}`);
  }
  if (publish && !total) throw new BadRequestException('Agrega al menos un edificio, un piso y un departamento antes de publicar');
  return total;
}
