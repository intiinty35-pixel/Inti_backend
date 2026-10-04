import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PublicReferralsController } from './public-referrals.controller';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [MailModule],
  controllers: [ReferralsController, PublicReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
