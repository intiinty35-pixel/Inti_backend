import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { InvestmentOpportunityDto } from './dto/investment-opportunity.dto';
import { InvestmentOpportunitiesService } from './investment-opportunities.service';

@Roles(Role.ADMIN)
@Controller('admin/investment-opportunities')
export class AdminInvestmentOpportunitiesController {
  constructor(private readonly opportunities: InvestmentOpportunitiesService) {}

  @Get()
  list() {
    return this.opportunities.listAdmin();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.getAdmin(id);
  }

  @Post()
  create(
    @CurrentUser() _user: AuthUser,
    @Body() dto: InvestmentOpportunityDto,
  ) {
    return this.opportunities.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvestmentOpportunityDto,
  ) {
    return this.opportunities.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.delete(id);
  }
}
