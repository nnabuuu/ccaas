import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { MosaicService } from './mosaic.service';

@Controller('mosaic')
export class MosaicController {
  constructor(private readonly mosaicService: MosaicService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'lego-playground-backend', timestamp: new Date().toISOString() };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: resolve(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `mosaic-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return {
      imagePath: file.path,
      filename: file.filename,
      uploadUrl: `/api/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.mosaicService.getSession(id);
  }

  @Post('sessions')
  createSession(@Body() body: { config?: any }) {
    return this.mosaicService.createSession(body.config);
  }
}
