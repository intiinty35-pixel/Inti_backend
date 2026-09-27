import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { ReviewSubscriptionDto } from './dto/review-subscription.dto';
import { PlansService } from './plans.service';

@Roles(Role.ADMIN)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly plans: PlansService) {}

  @Get('pending')
  pending() {
    return this.plans.listPendingSubscriptions();
  }

  @Patch(':id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSubscriptionDto) {
    return this.plans.reviewSubscription(id, dto);
  }
}
