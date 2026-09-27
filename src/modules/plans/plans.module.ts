import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminPlansController, PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansController, AdminPlansController, AdminSubscriptionsController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
