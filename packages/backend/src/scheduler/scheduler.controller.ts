/**
 * Scheduler Controller
 *
 * REST API for managing scheduled tasks and their execution history.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthAdminOrBuilder } from '../auth/decorators';
import { SchedulerService } from './scheduler.service';
import { CreateScheduledTaskDto } from './dto/create-scheduled-task.dto';
import { UpdateScheduledTaskDto } from './dto/update-scheduled-task.dto';

@AuthAdminOrBuilder()
@ApiTags('scheduler')
@Controller('api/v1/scheduled-tasks')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  @Post()
  async create(@Body() dto: CreateScheduledTaskDto) {
    this.logger.log(`Creating scheduled task: "${dto.name}"`);
    return this.schedulerService.create(dto);
  }

  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schedulerService.findAll({
      tenantId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.schedulerService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateScheduledTaskDto) {
    this.logger.log(`Updating scheduled task ${id}`);
    return this.schedulerService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting scheduled task ${id}`);
    return this.schedulerService.softDelete(id);
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string) {
    this.logger.log(`Pausing scheduled task ${id}`);
    return this.schedulerService.pause(id);
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    this.logger.log(`Resuming scheduled task ${id}`);
    return this.schedulerService.resume(id);
  }

  @Post(':id/trigger')
  async trigger(@Param('id') id: string) {
    this.logger.log(`Manually triggering scheduled task ${id}`);
    return this.schedulerService.trigger(id);
  }

  @Get(':id/executions')
  async findExecutions(
    @Param('id') taskId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.schedulerService.findExecutions(taskId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  @Get(':id/executions/:execId')
  async findExecution(
    @Param('id') taskId: string,
    @Param('execId') execId: string,
  ) {
    return this.schedulerService.findExecution(taskId, execId);
  }
}
