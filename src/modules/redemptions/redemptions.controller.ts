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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../generated/prisma/enums';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionQueryDto } from './dto/redemption-query.dto';
import { UpdateRedemptionStatusDto } from './dto/update-redemption-status.dto';
import { RedemptionsService } from './redemptions.service';

@Controller('redemptions')
export class PublicRedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Public()
  @Post('access')
  validateAccess(@Body() body: { referralCode: string }) {
    return this.redemptions.validateReferrerAccess(body.referralCode);
  }

  @Public()
  @Get('catalog')
  getCatalog() {
    return this.redemptions.getActiveIncentives();
  }

  @Public()
  @Post()
  create(@Body() dto: CreateRedemptionDto) {
    return this.redemptions.createRedemption(dto);
  }

  @Public()
  @Get('my')
  getMyRedemptions(@Query('code') code: string) {
    return this.redemptions.getMyRedemptions(code);
  }
}

@Roles(Role.ADMIN)
@Controller('admin/redemptions')
export class RedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Get()
  list(@Query() query: RedemptionQueryDto) {
    return this.redemptions.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.redemptions.getRedemption(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.redemptions.approveRedemption(id, user.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRedemptionStatusDto,
  ) {
    return this.redemptions.rejectRedemption(id, user.id, dto.reason);
  }

  @Patch(':id/deliver')
  deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.redemptions.deliverRedemption(id, user.id);
  }
}
