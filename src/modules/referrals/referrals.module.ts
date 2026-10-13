import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { PublicReferralsController } from './public-referrals.controller';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [MailModule, CampaignsModule],
  controllers: [ReferralsController, PublicReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
