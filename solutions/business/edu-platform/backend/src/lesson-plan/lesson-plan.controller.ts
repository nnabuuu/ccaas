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
import { LessonPlanService } from './lesson-plan.service';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';
import { UpdateBlocksDto } from './dto/update-blocks.dto';
import { LinkRequirementDto } from './dto/link-requirement.dto';
import { LinkExercisesDto } from './dto/link-exercises.dto';

@ApiTags('lesson-plans')
@Controller('lesson-plans')
export class LessonPlanController {
  constructor(private readonly lessonPlanService: LessonPlanService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('page_size') page_size?: string,
    @Query('subject_id') subject_id?: string,
    @Query('status') status?: string,
    @Query('class_id') class_id?: string,
    @Query('has_requirement') has_requirement?: string,
    @Query('q') q?: string,
  ) {
    const resolvedLimit = page_size || limit;
    return this.lessonPlanService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: resolvedLimit ? parseInt(resolvedLimit, 10) : 20,
      subject_id,
      status,
      class_id,
      has_requirement,
      q,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonPlanService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLessonPlanDto) {
    return this.lessonPlanService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLessonPlanDto) {
    return this.lessonPlanService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonPlanService.softDelete(id);
  }

  @Post(':id/blocks')
  updateBlocks(@Param('id') id: string, @Body() dto: UpdateBlocksDto) {
    return this.lessonPlanService.updateBlocks(id, dto.blocks);
  }

  @Post(':id/link-requirement')
  linkRequirement(
    @Param('id') id: string,
    @Body() dto: LinkRequirementDto,
  ) {
    return this.lessonPlanService.linkRequirement(id, dto);
  }

  @Get(':id/requirement-status')
  getRequirementStatus(@Param('id') id: string) {
    return this.lessonPlanService.getRequirementStatus(id);
  }

  @Post(':id/exercises')
  linkExercises(
    @Param('id') id: string,
    @Body() dto: LinkExercisesDto,
  ) {
    return this.lessonPlanService.linkExercises(id, dto.exercise_ids);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.lessonPlanService.publish(id);
  }

  @Post(':id/export')
  exportDocx(@Param('id') id: string) {
    return this.lessonPlanService.exportDocx(id);
  }

  @Post(':id/save-as-template')
  saveAsTemplate(
    @Param('id') id: string,
    @Body() body: { name: string; description: string },
  ) {
    return this.lessonPlanService.saveAsTemplate(id, body);
  }
}
