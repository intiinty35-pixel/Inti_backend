import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { AdminProjectsController } from './admin-projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController, AdminProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
