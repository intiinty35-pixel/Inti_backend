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
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { BatchUpdateProjectPointsDto } from './dto/project-points.dto';

@Roles(Role.ADMIN)
@Controller('admin/campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@Query() query: CampaignQueryDto) {
    return this.campaigns.list(query);
  }

  @Get('validate-code/:code')
  validateCode(@Param('code') code: string) {
    return this.campaigns.validateCampaignCode(code);
  }

  @Get('stats')
  async getCampaignStats() {
    const campaigns = await this.prisma.campaign.findMany({
      include: {
        referrals: {
          select: { id: true, referrerId: true },
        },
        referralPoints: {
          select: { points: true },
        },
      },
    });

    return campaigns.map((campaign) => {
      const uniqueReferrers = new Set(campaign.referrals.map((r) => r.referrerId));
      const totalPoints = campaign.referralPoints.reduce((sum, p) => sum + p.points, 0);

      return {
        id: campaign.id,
        code: campaign.code,
        name: campaign.name,
        totalReferrals: campaign.referrals.length,
        uniqueReferrers: uniqueReferrers.size,
        totalPoints,
      };
    });
  }

  @Get('project-points')
  listProjectPoints() {
    return this.campaigns.listProjectPoints();
  }

  @Patch('project-points/batch')
  batchUpdateProjectPoints(@Body() dto: BatchUpdateProjectPointsDto) {
    return this.campaigns.batchUpdateProjectPoints(dto);
  }

  @Patch('project-points/:projectId')
  updateProjectPoints(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: { points: { CONTACTED: number; VISIT: number; OPERATION_COMPLETED: number } },
  ) {
    return this.campaigns.updateProjectPoints(projectId, body.points);
  }

  @Get('ariz-projects')
  getArizProjects() {
    return this.campaigns.getArizProjects();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.delete(id);
  }
}
