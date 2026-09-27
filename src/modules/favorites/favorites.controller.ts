import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { FavoritesService } from './favorites.service';

class ToggleFavoriteDto {
  @IsUUID()
  propertyId!: string;
}

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user);
  }

  @Post('toggle')
  toggle(@CurrentUser() user: AuthUser, @Body() dto: ToggleFavoriteDto) {
    return this.favorites.toggle(user, dto.propertyId);
  }
}
