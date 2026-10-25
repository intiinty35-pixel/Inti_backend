import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Delete,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../generated/prisma/enums';
import { SaveSitePlanDto, SitePlanAccessCodeDto, SitePlanDto } from './dto/site-plan.dto';
import { SitePlansService } from './site-plans.service';
import { exportLotTable } from './site-plan-export';

@Roles(Role.ADMIN)
@Controller('admin/projects/:id/site-plan')
export class AdminSitePlansController {
  constructor(private readonly plans: SitePlansService) {}
  @Post('export/:format') async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('format') format: string,
    @Body() plan: SitePlanDto,
    @Res() res: Response,
  ) {
    if (format !== 'xlsx' && format !== 'pdf') throw new BadRequestException('Formato no válido');
    const session = await this.plans.admin(id);
    const buffer = await exportLotTable(plan, session.project, format);
    res.type(format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`lotes.${format}`).send(buffer);
  }
  @Post('lots/:lotId/pdf') async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() plan: SitePlanDto,
    @Res() res: Response,
  ) {
    res
      .type('application/pdf')
      .attachment(`ficha-lote-${lotId}.pdf`)
      .send(await this.plans.adminPdf(id, lotId, plan));
  }
  @Get() get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.admin(id);
  }
  @Post('access-code') generateAccessCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SitePlanAccessCodeDto,
  ) {
    return this.plans.generateAccessCode(id, dto.expiresInDays);
  }
  @Delete('access-code') revokeAccessCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.revokeAccessCode(id);
  }
  @Put() save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveSitePlanDto,
  ) {
    return this.plans.save(id, dto);
  }
  @Get('template') async template(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    await this.plans.admin(id);
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('plantilla-lotes.xlsx')
      .send(await this.plans.template());
  }
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    }),
  )
  async import(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    await this.plans.admin(id);
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx'))
      throw new BadRequestException('Selecciona un archivo .xlsx');
    return this.plans.importExcel(file.buffer);
  }
}

@Controller('projects/:slug/site-plan')
export class PublicSitePlansController {
  constructor(private readonly plans: SitePlansService) {}
  @Public() @Get('apartments/:apartmentId/pdf') async apartmentPdf(
    @Param('slug') slug: string,
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Headers('x-site-plan-code') code: string | undefined,
    @Res() res: Response,
  ) {
    res.type('application/pdf').attachment(`ficha-departamento-${apartmentId}.pdf`)
      .send(await this.plans.apartmentPdf(slug, apartmentId, code));
  }
  @Public() @Get() get(
    @Param('slug') slug: string,
    @Headers('x-site-plan-code') code?: string,
  ) {
    return this.plans.publicPlan(slug, code);
  }
  @Public() @Get('lots/:lotId/pdf') async pdf(
    @Param('slug') slug: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Headers('x-site-plan-code') code: string | undefined,
    @Res() res: Response,
  ) {
    res
      .type('application/pdf')
      .attachment(`ficha-lote-${lotId}.pdf`)
      .send(await this.plans.pdf(slug, lotId, code));
  }
}
