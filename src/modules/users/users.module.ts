import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminDeveloperReviewController } from './admin-developer-review.controller';
import { PropertiesModule } from '../properties/properties.module';
import { ProjectsModule } from '../projects/projects.module';
import { AdminAgencyReviewController } from './admin-agency-review.controller';

@Module({
  imports: [PlansModule, PropertiesModule, ProjectsModule],
  controllers: [UsersController, AdminDeveloperReviewController, AdminAgencyReviewController],
  providers: [UsersService],
})
export class UsersModule {}
