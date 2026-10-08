import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { ContactReportsController } from './contact-reports.controller';
import { ContactReportsService } from './contact-reports.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [ContactReportsController],
  providers: [ContactReportsService],
})
export class ContactReportsModule {}
