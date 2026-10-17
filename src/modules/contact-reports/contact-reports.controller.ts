import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { ContactReportsService } from './contact-reports.service';
import { ContactReportQueryDto } from './dto/contact-report-query.dto';
import { CreateContactReportDto } from './dto/create-contact-report.dto';

@Controller()
export class ContactReportsController {
  constructor(private readonly reports: ContactReportsService) {}

  @Public()
  @Post('contact-reports')
  create(@Body() dto: CreateContactReportDto) {
    return this.reports.create(dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/contact-reports/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.remove(id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/contact-reports')
  list(@Query() query: ContactReportQueryDto) {
    return this.reports.list(query);
  }
}
