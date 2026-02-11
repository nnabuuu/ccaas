import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { AgentFile } from './entities/agent-file.entity';
import { FileVersion } from './entities/file-version.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { SessionModule } from '../chat/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentFile, FileVersion]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
    SessionModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
