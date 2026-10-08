import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
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

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.findOne(id);
  }

  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.claims.softDelete(id);
  }
}
