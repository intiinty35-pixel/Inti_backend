import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
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
}
