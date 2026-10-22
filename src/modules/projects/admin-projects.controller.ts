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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { CreateProjectDto, ProjectLocationDto } from './dto/create-project.dto';
import { AdminProjectQueryDto } from './dto/admin-project-query.dto';
import { ProjectsService } from './projects.service';

@Roles(Role.ADMIN)
@Controller('admin/projects')
export class AdminProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query() query: AdminProjectQueryDto) {
    return this.projects.listAdminProjects(query);
  }

  @Get('all')
  all(@Query() query: AdminProjectQueryDto) {
    return this.projects.listAdminProjects(query, true);
  }

  @Get('portfolio-summary')
  summary() {
    return this.projects.adminPortfolioSummary();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getAdminProject(id, true);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.createAdminDraft(user, dto);
  }

  @Patch(':id/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.publishAdminProject(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.removeAdminProject(user, id);
  }

  @Patch(':id/location')
  updateLocation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectLocationDto,
  ) {
    return this.projects.updateAdminLocation(user, id, dto);
  }
}
