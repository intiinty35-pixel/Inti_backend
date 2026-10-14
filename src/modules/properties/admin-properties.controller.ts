import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { PropertyStatus, Role } from '../../generated/prisma/enums';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertiesService } from './properties.service';

class AdminPropertyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;
}

/** Propiedades ARIZ: las crea y publica el administrador, sin pago ni membresia. */
@Roles(Role.ADMIN)
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(@Query() query: AdminPropertyQueryDto) {
    return this.properties.listAdminProperties(query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.createAdminDraft(user, dto);
  }

  @Patch(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.properties.publish(user, id);
  }
}
