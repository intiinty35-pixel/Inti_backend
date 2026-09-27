import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AlertsService } from './alerts.service';
import { CreatePriceAlertDto, CreateSearchAlertDto } from './dto/create-alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Post('search')
  createSearch(@CurrentUser() user: AuthUser, @Body() dto: CreateSearchAlertDto) {
    return this.alerts.createSearch(user, dto);
  }

  @Post('price')
  createPrice(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceAlertDto) {
    return this.alerts.createPrice(user, dto);
  }
}
