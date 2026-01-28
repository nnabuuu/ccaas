import { Module } from '@nestjs/common';
import { TextbookController } from './textbook.controller';
import { TextbookService } from './textbook.service';

@Module({
  controllers: [TextbookController],
  providers: [TextbookService],
  exports: [TextbookService],
})
export class TextbookModule {}
