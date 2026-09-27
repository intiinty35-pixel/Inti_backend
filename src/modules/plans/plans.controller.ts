import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { RequestPlanDto } from './dto/request-plan.dto';
import { UpsertPlanDto } from './dto/upsert-plan.dto';
import { PlansService } from './plans.service';

@Roles(Role.REAL_ESTATE)
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listActive();
  }

  @Get('me/subscription')
  mySubscription(@CurrentUser() user: AuthUser) {
    return this.plans.getMySubscription(user.id);
  }

  @Post(':id/request')
  request(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestPlanDto,
  ) {
    return this.plans.requestPlan(user.id, id, dto);
  }
}

@Roles(Role.ADMIN)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listAll();
  }

  @Post()
  create(@Body() dto: UpsertPlanDto) {
    return this.plans.createPlan(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertPlanDto) {
    return this.plans.updatePlan(id, dto);
  }
}
