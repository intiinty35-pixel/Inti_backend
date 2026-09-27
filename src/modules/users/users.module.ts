import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PlansModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
