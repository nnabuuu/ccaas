import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PromoteTemplateDto } from './dto/promote-template.dto';
import { ReviewPromotionDto } from './dto/review-promotion.dto';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('page_size') page_size?: string,
    @Query('scope') scope?: string,
    @Query('subject_id') subject_id?: string,
    @Query('lesson_type') lesson_type?: string,
    @Query('q') q?: string,
  ) {
    const resolvedLimit = page_size || limit;
    return this.templateService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: resolvedLimit ? parseInt(resolvedLimit, 10) : 20,
      scope,
      subject_id,
      lesson_type,
      q,
    });
  }

  @Get('promotions')
  getPromotions(@Query('status') status?: string) {
    return this.templateService.getPromotions(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templateService.softDelete(id);
  }

  @Post(':id/promote')
  promote(@Param('id') id: string, @Body() dto: PromoteTemplateDto) {
    return this.templateService.promote(id, dto);
  }

  @Post('promotions/:id/review')
  reviewPromotion(
    @Param('id') id: string,
    @Body() dto: ReviewPromotionDto,
  ) {
    return this.templateService.reviewPromotion(id, dto);
  }
}
