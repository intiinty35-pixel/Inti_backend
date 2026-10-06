import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminDeveloperReviewController } from './admin-developer-review.controller';
import { PropertiesModule } from '../properties/properties.module';
import { ProjectsModule } from '../projects/projects.module';
import { AdminAgencyReviewController } from './admin-agency-review.controller';
import { CustomerAccountController } from './customer-account.controller';
import { CustomerAccountService } from './customer-account.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PlansModule, PropertiesModule, ProjectsModule, MailModule],
  controllers: [
    UsersController,
    AdminDeveloperReviewController,
    AdminAgencyReviewController,
    CustomerAccountController,
  ],
  providers: [UsersService, CustomerAccountService],
})
export class UsersModule {}
