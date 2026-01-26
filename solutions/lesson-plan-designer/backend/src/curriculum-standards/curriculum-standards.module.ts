import { Module } from '@nestjs/common';
import { CurriculumStandardsController } from './curriculum-standards.controller';
import { CurriculumStandardsService } from './curriculum-standards.service';

@Module({
  controllers: [CurriculumStandardsController],
  providers: [CurriculumStandardsService],
  exports: [CurriculumStandardsService],
})
export class CurriculumStandardsModule {}
