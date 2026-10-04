import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { RequestCustomerMembershipDto } from './dto/request-customer-membership.dto';
import { PlansService } from './plans.service';

@Roles(Role.USER)
@Controller('customer/membership')
export class CustomerMembershipController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  getStatus(@CurrentUser() user: AuthUser) {
    return this.plans.getCustomerMembership(user.id);
  }

  @Post()
  request(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestCustomerMembershipDto,
  ) {
    return this.plans.requestCustomerMembership(user.id, dto);
  }
}
