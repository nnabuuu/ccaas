import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  create(@Body() dto: CreateProblemDto) {
    return this.problemsService.create(dto);
  }

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('subject') subject?: string,
    @Query('limit') limit?: string,
  ) {
    return this.problemsService.findAll(
      tenantId,
      subject,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.problemsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProblemDto) {
    return this.problemsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.problemsService.remove(id);
    return { success: true };
  }
}
