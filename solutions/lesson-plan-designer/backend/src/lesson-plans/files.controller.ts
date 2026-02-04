import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { LessonPlansService } from './lesson-plans.service';

@Controller('api/v1/files')
export class FilesController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filePath, fileName, mimeType } = await this.lessonPlansService.getFileMetadata(fileId);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }
}
