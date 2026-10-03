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
@Controller('admin/developers')
export class AdminDeveloperReviewController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
  ) {}

  @Get()
  listDevelopers(@Query() query: DeveloperReviewQueryDto) {
    return this.users.listDevelopers(query);
  }

  @Get(':id')
  developerDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeveloperReviewQueryDto,
  ) {
    return this.users.getDeveloper(id, query);
  }

  @Patch('properties/:id/publish')
  publishProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.reviewDeveloperProperty(
      id,
      PropertyStatus.PUBLISHED,
    );
  }

  @Patch('properties/:id/reject')
  rejectProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.reviewDeveloperProperty(id, PropertyStatus.REJECTED);
  }

  @Patch('projects/:id/publish')
  publishProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.reviewDeveloperProject(id, ProjectStatus.PUBLISHED);
  }

  @Patch('projects/:id/reject')
  rejectProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.reviewDeveloperProject(id, ProjectStatus.REJECTED);
  }
}
