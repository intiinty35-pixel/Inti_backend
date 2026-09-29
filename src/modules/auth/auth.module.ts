import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService],
})
export class AuthModule {}
