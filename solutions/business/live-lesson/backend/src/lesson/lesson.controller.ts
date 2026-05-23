import { Controller, Get, Param, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { LessonService } from '../application/lesson/lesson.service';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('lessons')
@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  findAll() {
    return this.lessonService.findAll();
  }

  @Get(':id/manifest')
  findManifest(@Param('id') id: string) {
    return this.lessonService.findManifest(id);
  }

  @Get(':id/audio/:filename')
  getAudio(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new BadRequestException('Invalid lesson ID');
    }
    if (!/^[a-z0-9-]+\.(mp3|wav)$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    const audioPath = path.resolve(process.cwd(), '..', 'data', 'lessons', id, 'audio', filename);
    if (!fs.existsSync(audioPath)) {
      throw new NotFoundException('Audio file not found');
    }

    const contentType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(audioPath).pipe(res);
  }

  @Get(':id/resources/:filename')
  getResource(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new BadRequestException('Invalid lesson ID');
    }
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    const filePath = path.resolve(process.cwd(), '..', 'data', 'lessons', id, 'resources', filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Resource not found');
    }

    const ext = filename.split('.').pop()!.toLowerCase();
    const mime: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp',
    };
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  }
}
