import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreatePropertyDto } from './dto/create-property.dto';
import { OwnerPropertyQueryDto } from './dto/owner-property-query.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Public()
  @Get()
  list(@Query() query: PropertyQueryDto) {
    return this.properties.listPublic(query);
  }

  @Get('owner/me')
  mine(@CurrentUser() user: AuthUser, @Query() query: OwnerPropertyQueryDto) {
    return this.properties.listMine(user, query);
  }

  @Get('owner/:id')
  mineById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.properties.getMineForEdit(user, id);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.properties.getPublicBySlug(slug);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.createDraft(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.update(user, id, dto);
  }

  @Patch(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.properties.publish(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.properties.remove(user, id);
  }
}
