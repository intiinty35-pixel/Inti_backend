import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller()
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Public()
  @Get('promotions/current')
  current() {
    return this.promotions.listCurrent();
  }

  @Roles(Role.ADMIN)
  @Get('admin/promotions')
  list() {
    return this.promotions.list();
  }

  @Roles(Role.ADMIN)
  @Get('admin/promotions/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.get(id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/promotions')
  create(@Body() dto: CreatePromotionDto) {
    return this.promotions.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/promotions/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotions.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/promotions/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.remove(id);
  }
}
