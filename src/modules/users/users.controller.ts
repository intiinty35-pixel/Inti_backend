import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ParseEnumPipe } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus, Role } from '../../generated/prisma/enums';
import { ListProfessionalsQueryDto } from './dto/list-professionals-query.dto';
import { NotifyProfessionalDto } from './dto/notify-professional.dto';
import { UpdateOfficialDeveloperDto } from './dto/update-official-developer.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { UsersService } from './users.service';

@Roles(Role.ADMIN)
@Controller('admin/professionals')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @Query('status', new ParseEnumPipe(ApprovalStatus, { optional: true }))
    status: ApprovalStatus | undefined,
    @Query() query: ListProfessionalsQueryDto,
  ) {
    return this.users.listProfessionals(status, query.page, query.pageSize);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalStatusDto,
  ) {
    return this.users.setProfessionalStatus(id, dto.status);
  }

  @Patch(':id/official-developer')
  setOfficialDeveloper(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfficialDeveloperDto,
  ) {
    return this.users.setOfficialDeveloper(id, dto.isOfficialDeveloper);
  }

  @Post(':id/notify')
  notify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifyProfessionalDto,
  ) {
    return this.users.notifyProfessional(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteProfessionalAccount(id);
  }
}
