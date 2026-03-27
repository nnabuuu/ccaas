import { Module, Global } from '@nestjs/common';
import { EvaluatorService } from './evaluator.service';

@Global()
@Module({
  providers: [EvaluatorService],
  exports: [EvaluatorService],
})
export class EvaluatorModule {}
