import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';
import { UpdateReferralPointsDto } from './dto/update-referral-points.dto';
import { UpdateReferralStatusDto } from './dto/update-referral-status.dto';
import { ReferralsService } from './referrals.service';

@Roles(Role.ADMIN)
@Controller('admin/referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list(@Query() query: ReferralQueryDto) {
    return this.referrals.list(query);
  }

  @Get('referrers/:id')
  referrerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.getReferrer(id);
  }

  @Patch('status-points')
  updateStatusPoints(@Body() dto: UpdateReferralPointsDto) {
    return this.referrals.updateStatusPoints(dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReferralDto) {
    return this.referrals.create(dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReferralStatusDto,
  ) {
    return this.referrals.updateStatus(id, dto.status, user.id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.referrals.approveReferral(id, user.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.referrals.rejectReferral(id, user.id);
  }
}
