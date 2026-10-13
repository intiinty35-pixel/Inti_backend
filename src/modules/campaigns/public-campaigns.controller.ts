import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CampaignsService } from './campaigns.service';

@Public()
@Controller('campaigns')
export class PublicCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('active')
  getActive(@Query('referrerCode') _referrerCode?: string) {
    return this.campaigns.getActive();
  }

  @Get('validate-code')
  async validateCode(@Query('code') code: string) {
    if (!code) return { valid: false, message: 'Código requerido' };
    
    const campaign = await this.campaigns.validateCampaignCode(code);
    
    if (!campaign) {
      return { valid: false, message: 'Código de campaña no encontrado' };
    }
    
    if (!campaign.isValid) {
      return { 
        valid: false, 
        message: campaign.isActive 
          ? 'Campaña fuera del periodo de vigencia' 
          : 'Campaña inactiva' 
      };
    }
    
    return { 
      valid: true, 
      campaign: { 
        id: campaign.id,
        name: campaign.name 
      } 
    };
  }
}
