import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [MailModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
