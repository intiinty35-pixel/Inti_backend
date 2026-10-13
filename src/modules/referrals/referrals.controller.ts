import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { CampaignPointsTracker } from '../campaigns/campaign-points-tracker';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';
import { UpdateReferralPointsDto } from './dto/update-referral-points.dto';
import { UpdateReferralStatusDto } from './dto/update-referral-status.dto';
import { ReferralsService } from './referrals.service';

@Roles(Role.ADMIN)
@Controller('admin/referrals')
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly campaignTracker: CampaignPointsTracker,
  ) {}

  @Get()
  list(@Query() query: ReferralQueryDto) {
    return this.referrals.list(query);
  }

  @Get('export/excel')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.referrals.exportExcel();
    const filename = `referidos-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(@Res() res: Response) {
    const buffer = await this.referrals.exportPdf();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="referidos-${new Date().toISOString().split('T')[0]}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('referrers/:id')
  async referrerDetail(@Param('id', ParseUUIDPipe) id: string) {
    const referrer = await this.referrals.getReferrer(id);
    const campaignPoints = await this.campaignTracker.getReferrerCampaignPointsBreakdown(id);
    
    return {
      ...referrer,
      campaignPoints,
    };
  }

  @Get('referrers/:id/campaign-points')
  referrerCampaignPoints(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignTracker.getReferrerCampaignPointsBreakdown(id);
  }

  @Delete('referrers/:id')
  deleteReferrer(@Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.deleteReferrer(id);
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
