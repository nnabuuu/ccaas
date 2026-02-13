import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { HooksService } from './hooks.service';

@Module({
  imports: [FilesModule],
  providers: [HooksService],
  exports: [HooksService],
})
export class HooksModule {}
