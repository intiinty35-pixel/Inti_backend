import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateProjectDto, ProjectLocationDto } from './dto/create-project.dto';
import { OwnerProjectQueryDto } from './dto/owner-project-query.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Public()
  @Get()
  list(@Query() query: ProjectQueryDto) {
    return this.projects.listPublic(query);
  }

  @Get('owner/me')
  mine(@CurrentUser() user: AuthUser, @Query() query: OwnerProjectQueryDto) {
    return this.projects.listMine(user, query);
  }

  @Public()
  @Get(':slug/units')
  units(@Param('slug') slug: string) {
    return this.projects.listUnits(slug);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.projects.getPublicBySlug(slug);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.createDraft(user, dto);
  }

  @Patch(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.publish(user, id);
  }

  @Patch(':id/location')
  updateLocation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectLocationDto,
  ) {
    return this.projects.updateLocation(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(user, id);
  }
}
