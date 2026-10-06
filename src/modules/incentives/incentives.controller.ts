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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { CreateIncentiveDto } from './dto/create-incentive.dto';
import { IncentiveQueryDto } from './dto/incentive-query.dto';
import { UpdateIncentiveDto } from './dto/update-incentive.dto';
import { UpdateIncentiveStatusDto } from './dto/update-incentive-status.dto';
import { IncentivesService } from './incentives.service';

@Roles(Role.ADMIN)
@Controller('admin/incentives')
export class IncentivesController {
  constructor(private readonly incentives: IncentivesService) {}

  @Get()
  list(@Query() query: IncentiveQueryDto) {
    return this.incentives.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.incentives.get(id);
  }

  @Post()
  create(@Body() dto: CreateIncentiveDto) {
    return this.incentives.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIncentiveDto) {
    return this.incentives.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncentiveStatusDto,
  ) {
    return this.incentives.updateStatus(id, dto.status);
  }

  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.incentives.softDelete(id);
  }
}
