import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto, CreateFileDto, UpdateFileDto } from './project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  // ── Project CRUD ──

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.archive(id);
  }

  // ── File operations ──

  @Get(':id/files')
  @ApiQuery({ name: 'path', required: false, description: 'Virtual file path; omit to list all files' })
  listOrReadFiles(@Param('id') id: string, @Query('path') filePath?: string) {
    if (filePath) {
      return this.service.readFile(id, filePath);
    }
    return this.service.listFiles(id);
  }

  @Post(':id/files')
  createFile(@Param('id') id: string, @Body() dto: CreateFileDto) {
    return this.service.createFile(id, dto);
  }

  @Put(':id/files')
  @ApiQuery({ name: 'path', required: true, description: 'Virtual file path within the project' })
  writeFile(
    @Param('id') id: string,
    @Query('path') filePath: string,
    @Body() dto: UpdateFileDto,
  ) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.writeFile(id, filePath, dto.content);
  }

  @Delete(':id/files')
  @ApiQuery({ name: 'path', required: true, description: 'Virtual file path to delete' })
  deleteFile(@Param('id') id: string, @Query('path') filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }
    return this.service.deleteFile(id, filePath);
  }

  // ── Publish ──

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }
}
