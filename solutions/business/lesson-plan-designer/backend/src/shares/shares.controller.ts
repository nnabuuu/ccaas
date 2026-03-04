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
import { SharesService } from './shares.service';
import { CreateShareDto } from './shares.types';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  share(@Body() dto: CreateShareDto, @Headers('x-user-id') userId?: string) {
    return this.sharesService.share(dto, userId || 'anonymous');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id') id: string) {
    this.sharesService.revoke(id);
  }

  @Get('by-me')
  listByMe(@Headers('x-user-id') userId?: string) {
    return this.sharesService.listByMe(userId || 'anonymous');
  }

  @Get('to-me')
  listToMe(@Headers('x-user-id') userId?: string) {
    return this.sharesService.listToMe(userId || 'anonymous');
  }
}
