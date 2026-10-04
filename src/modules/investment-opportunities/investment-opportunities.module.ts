import { Module } from '@nestjs/common';
import { AdminInvestmentOpportunitiesController } from './admin-investment-opportunities.controller';
import { InvestmentOpportunitiesController } from './investment-opportunities.controller';
import { InvestmentOpportunitiesService } from './investment-opportunities.service';

@Module({
  controllers: [
    InvestmentOpportunitiesController,
    AdminInvestmentOpportunitiesController,
  ],
  providers: [InvestmentOpportunitiesService],
})
export class InvestmentOpportunitiesModule {}
