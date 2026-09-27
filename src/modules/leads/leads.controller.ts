import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { Role } from '../../generated/prisma/enums';
import { CreateLeadDto } from './dto/create-lead.dto';
import { OwnerLeadQueryDto } from './dto/owner-lead-query.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateLeadDto, @Req() request: Request & { user?: AuthUser }) {
    return this.leads.create(dto, request.user);
  }

  @Roles(Role.REAL_ESTATE)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: OwnerLeadQueryDto) {
    return this.leads.listMine(user, query);
  }
}
