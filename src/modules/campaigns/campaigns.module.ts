import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { PublicCampaignsController } from './public-campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignPointsTracker } from './campaign-points-tracker';

@Module({
  controllers: [CampaignsController, PublicCampaignsController],
  providers: [CampaignsService, CampaignPointsTracker],
  exports: [CampaignsService, CampaignPointsTracker],
})
export class CampaignsModule {}
