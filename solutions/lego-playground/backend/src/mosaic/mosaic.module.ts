import { Module } from '@nestjs/common';
import { MosaicController } from './mosaic.controller';
import { MosaicService } from './mosaic.service';

@Module({
  controllers: [MosaicController],
  providers: [MosaicService],
})
export class MosaicModule {}
