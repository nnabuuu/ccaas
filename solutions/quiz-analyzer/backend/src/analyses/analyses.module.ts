import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';
import { QuizAnalysis, Quiz } from '../database/entities';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizAnalysis, Quiz]),
    MessagesModule,
  ],
  controllers: [AnalysesController],
  providers: [AnalysesService],
  exports: [AnalysesService],
})
export class AnalysesModule {}
