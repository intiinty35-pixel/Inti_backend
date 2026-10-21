import type { PlanPointDto } from './dto/site-plan.dto';

/** Simple, non-degenerate polygon; an empty path represents an unassigned base lot. */
export function validPolygon(path: PlanPointDto[]) {
  if (path.length < 3) return false;
  const origin = path[0];
  const points = path.map((p) => ({
    x: (p.lng - origin.lng) * 111320 * Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * 111320,
  }));
  const cross = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) return false;
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))
      )
        return false;
    }
  }
  return Math.abs(area) > 0.01;
}
