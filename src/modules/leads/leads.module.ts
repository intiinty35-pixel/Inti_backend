import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [MailModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
