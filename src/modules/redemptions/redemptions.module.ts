import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RedemptionsController, PublicRedemptionsController } from './redemptions.controller';
import { RedemptionsService } from './redemptions.service';

@Module({
  imports: [MailModule],
  controllers: [RedemptionsController, PublicRedemptionsController],
  providers: [RedemptionsService],
  exports: [RedemptionsService],
})
export class RedemptionsModule {}
