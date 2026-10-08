import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { ChangeProfessionalPasswordDto } from './dto/change-professional-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { ProfessionalsService } from './professionals.service';

@Roles(Role.REAL_ESTATE)
@Controller('professionals/me')
export class ProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser) {
    return this.professionals.getMe(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyProfileDto) {
    return this.professionals.updateMe(user.id, dto);
  }

  @Patch('password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeProfessionalPasswordDto,
  ) {
    await this.professionals.changePassword(user.id, dto);
    return { message: 'Contraseña actualizada' };
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.professionals.getNotificationSettings(user.id);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.professionals.updateNotificationSettings(user.id, dto);
  }
}
