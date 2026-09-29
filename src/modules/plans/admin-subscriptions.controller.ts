import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { PageQueryDto } from './dto/page-query.dto';
import { ReviewSubscriptionDto } from './dto/review-subscription.dto';
import { PlansService } from './plans.service';

@Roles(Role.ADMIN)
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly plans: PlansService) {}

  @Get('pending')
  pending(@Query() query: PageQueryDto) {
    return this.plans.listPendingSubscriptions(query.page, query.pageSize);
  }

  @Patch(':id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSubscriptionDto) {
    return this.plans.reviewSubscription(id, dto);
  }
}
