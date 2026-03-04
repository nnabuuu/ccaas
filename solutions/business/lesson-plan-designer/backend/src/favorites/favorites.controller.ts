import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './favorites.types';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() dto: AddFavoriteDto, @Headers('x-user-id') userId?: string) {
    return this.favoritesService.add(dto.lessonPlanId, userId || 'anonymous');
  }

  @Delete(':lessonPlanId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('lessonPlanId') lessonPlanId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    this.favoritesService.remove(lessonPlanId, userId || 'anonymous');
  }

  @Get()
  list(@Headers('x-user-id') userId?: string) {
    return this.favoritesService.list(userId || 'anonymous');
  }

  @Get(':lessonPlanId/status')
  status(
    @Param('lessonPlanId') lessonPlanId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return {
      isFavorited: this.favoritesService.isFavorited(
        lessonPlanId,
        userId || 'anonymous',
      ),
    };
  }
}
