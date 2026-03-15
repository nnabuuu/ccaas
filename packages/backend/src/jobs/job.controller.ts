/**
 * Job Controller
 *
 * REST API for managing background jobs.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@ApiTags('jobs')
@Controller('api/v1/jobs')
export class JobController {
  private readonly logger = new Logger(JobController.name);

  constructor(private readonly jobService: JobService) {}

  @Post()
  async create(@Body() dto: CreateJobDto) {
    this.logger.log(`Creating job: "${dto.name}" (type: ${dto.type})`);
    return this.jobService.create(dto);
  }

  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobService.findAll({
      tenantId,
      sessionId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.jobService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    this.logger.log(`Updating job ${id}: ${JSON.stringify(dto)}`);
    return this.jobService.update(id, dto);
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    this.logger.log(`Resuming job ${id}`);
    return this.jobService.resume(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    this.logger.log(`Cancelling job ${id}`);
    return this.jobService.cancel(id);
  }

  @Get(':id/files/:filename')
  async serveFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const job = await this.jobService.findById(id);
    const filePath = this.jobService.getFilePath(job, filename);

    if (!filePath) {
      throw new NotFoundException(`File not found: ${filename}`);
    }

    return res.sendFile(filePath);
  }
}
