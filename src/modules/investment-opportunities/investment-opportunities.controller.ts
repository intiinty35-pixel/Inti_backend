import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { InvestmentOpportunitiesService } from './investment-opportunities.service';

@Controller('investment-opportunities')
export class InvestmentOpportunitiesController {
  constructor(private readonly opportunities: InvestmentOpportunitiesService) {}

  @Public()
  @Get()
  list() {
    return this.opportunities.listPublic();
  }

  @Public()
  @Get('types')
  listTypes() {
    return this.opportunities.listTypes(false);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.opportunities.getPublicBySlug(slug);
  }
}
