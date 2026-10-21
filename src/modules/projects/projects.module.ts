import { SitePlansService } from './site-plans.service';
import {
  AdminSitePlansController,
  PublicSitePlansController,
} from './site-plans.controller';
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { AdminProjectsController } from './admin-projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [
    AdminSitePlansController,
    PublicSitePlansController,
    ProjectsController,
    AdminProjectsController,
  ],
  providers: [ProjectsService, SitePlansService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
