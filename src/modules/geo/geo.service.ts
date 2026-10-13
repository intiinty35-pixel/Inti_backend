import { BadRequestException, Injectable } from '@nestjs/common';

const ALLOWED_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.pe',
  'www.google.com.pe',
];
const MAX_REDIRECTS = 4;

export interface ResolvedPoint {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeoService {
  /**
   * Obtiene las coordenadas de un enlace de Google Maps. Los enlaces cortos se
   * siguen a mano y solo hacia hosts de Google, para que el endpoint no sirva
   * para consultar direcciones internas (SSRF).
   */
  async resolveMapsLink(rawUrl: string): Promise<ResolvedPoint> {
    let current = this.assertAllowed(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const point = this.extractPoint(current.toString());
      if (point) return point;

      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArizBot/1.0)' },
      }).catch(() => null);
      const location = response?.headers.get('location');
      if (!response || !location) break;

      current = this.assertAllowed(new URL(location, current).toString());
    }

    throw new BadRequestException(
      'No pudimos obtener la ubicación de ese enlace. Abre el lugar en Google Maps, copia el enlace de la barra de direcciones o haz clic en el mapa.',
    );
  }

  private assertAllowed(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('El enlace no es válido');
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname)) {
      throw new BadRequestException('Solo se admiten enlaces de Google Maps');
    }
    return url;
  }

  private extractPoint(url: string): ResolvedPoint | null {
    const decoded = decodeURIComponent(url);
    const patterns = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&](?:q|ll|query|destination)=(-?\d+\.\d+)[, ](-?\d+\.\d+)/,
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(decoded);
      if (!match) continue;
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180 &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        return {
          latitude: Number(latitude.toFixed(7)),
          longitude: Number(longitude.toFixed(7)),
        };
      }
    }
    return null;
  }
}
