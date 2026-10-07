import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralsService } from './referrals.service';

@Public()
@Controller('referrals')
export class PublicReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Post()
  create(@Body() dto: CreateReferralDto) {
    return this.referrals.create(dto);
  }

  @Get('validate-code')
  async validateReferrerCode(@Query('code') code: string) {
    if (!code) return { valid: false };
    const referrer = await this.referrals.getReferrerByCode(code);
    if (!referrer) return { valid: false };
    return { 
      valid: true, 
      referrer: { 
        id: referrer.id, 
        name: referrer.name,
        email: referrer.email,
        phone: referrer.phone
      } 
    };
  }

  @Get('my')
  async myReferrals(@Query('code') code: string) {
    return this.referrals.getReferralsByCode(code);
  }
}
