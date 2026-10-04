import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CustomerAccountService } from './customer-account.service';

@Roles(Role.USER)
@Controller('customer-account')
export class CustomerAccountController {
  constructor(private readonly account: CustomerAccountService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.account.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.account.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeCustomerPasswordDto,
  ) {
    await this.account.changePassword(user.id, dto);
    return { message: 'Contraseña actualizada' };
  }
}
