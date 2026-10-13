import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ResolveMapsLinkDto } from './dto/resolve-maps-link.dto';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('resolve-maps-link')
  @HttpCode(200)
  resolve(@Body() dto: ResolveMapsLinkDto) {
    return this.geo.resolveMapsLink(dto.url);
  }
}
