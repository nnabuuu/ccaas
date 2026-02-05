import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';
import { QuizAnalysis, Quiz } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([QuizAnalysis, Quiz])],
  controllers: [AnalysesController],
  providers: [AnalysesService],
  exports: [AnalysesService],
})
export class AnalysesModule {}
