import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ProjectStatus,
  PropertyStatus,
  Role,
} from '../../generated/prisma/enums';
import { ProjectsService } from '../projects/projects.service';
import { PropertiesService } from '../properties/properties.service';
import { DeveloperReviewQueryDto } from './dto/developer-review-query.dto';
import { UsersService } from './users.service';

@Roles(Role.ADMIN)
@Controller('admin/agencies')
export class AdminAgencyReviewController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
  ) {}

  @Get()
  listAgencies(@Query() query: DeveloperReviewQueryDto) {
    return this.users.listAgencies(query);
  }

  @Get('properties/:id')
  agencyPropertyDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.getAgencyPropertyReviewDetail(id);
  }

  @Get('projects/:id')
  agencyProjectDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getAgencyProjectReviewDetail(id);
  }

  @Get(':id')
  agencyDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeveloperReviewQueryDto,
  ) {
    return this.users.getAgency(id, query);
  }

  @Patch('properties/:id/publish')
  publishProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.reviewAgencyProperty(id, PropertyStatus.PUBLISHED);
  }

  @Patch('properties/:id/reject')
  rejectProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.reviewAgencyProperty(id, PropertyStatus.REJECTED);
  }

  @Patch('projects/:id/publish')
  publishProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.reviewAgencyProject(id, ProjectStatus.PUBLISHED);
  }

  @Patch('projects/:id/reject')
  rejectProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.reviewAgencyProject(id, ProjectStatus.REJECTED);
  }
}
