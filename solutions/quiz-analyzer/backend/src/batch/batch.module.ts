import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { BatchProcessorService } from './batch-processor.service';
import { BatchAnalysisJob, Quiz } from '../database/entities';
import { AnalysesModule } from '../analyses/analyses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchAnalysisJob, Quiz]),
    AnalysesModule,
  ],
  controllers: [BatchController],
  providers: [BatchService, BatchProcessorService],
  exports: [BatchService],
})
export class BatchModule {}
