import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminPlansController, PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [MailModule],
  controllers: [PlansController, AdminPlansController, AdminSubscriptionsController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
