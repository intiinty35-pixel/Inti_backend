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
import { ReferralRecordsQueryDto } from './dto/referral-records-query.dto';
import { SetReferralPointsDto } from './dto/set-referral-points.dto';
import { UpdateReferrerDto } from './dto/update-referrer.dto';
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

  @Get('ranking')
  ranking(@Query() query: ReferralQueryDto) {
    return this.referrals.ranking(query);
  }

  @Get('records')
  records(@Query() query: ReferralRecordsQueryDto) {
    return this.referrals.listRecords(query);
  }

  @Patch('records/:id/points')
  setRecordPoints(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetReferralPointsDto,
    @CurrentUser() user: AuthUser) {
    return this.referrals.setRecordPoints(id, dto.points, user.id);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.deleteRecord(id);
  }

  @Get('records/export/excel')
  async exportRecordsExcel(@Query() query: ReferralRecordsQueryDto, @Res() res: Response) {
    const buffer = await this.referrals.exportRecordsExcel(query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="referidos-ariz.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('ranking/export/excel')
  async exportRankingExcel(@Query() query: ReferralQueryDto, @Res() res: Response) {
    const buffer = await this.referrals.exportRankingExcel(query);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quienes-mas-refirieron-${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('export/excel')
  async exportExcel(@Query() query: ReferralQueryDto, @Res() res: Response) {
    const buffer = await this.referrals.exportExcel(query);
    const filename = `miembros-y-puntos-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(@Query() query: ReferralQueryDto, @Res() res: Response) {
    const buffer = await this.referrals.exportPdf(query);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="miembros-y-puntos-${new Date().toISOString().split('T')[0]}.pdf"`,
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

  @Patch('referrers/:id')
  updateReferrer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReferrerDto) {
    return this.referrals.updateReferrer(id, dto);
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
