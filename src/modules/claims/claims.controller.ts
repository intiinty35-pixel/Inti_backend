import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { ClaimQueryDto } from './dto/claim-query.dto';
import { ClaimsService } from './claims.service';

@Roles(Role.ADMIN)
@Controller('admin/claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  list(@Query() query: ClaimQueryDto) {
    return this.claims.list(query);
  }

  @Get('export/pdf')
  async exportPdf(@Res() res: Response) {
    const pdfBuffer = await this.claims.exportPdf();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="libro-reclamaciones-${new Date().toISOString().split('T')[0]}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.findOne(id);
  }

  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.softDelete(id);
  }
}
