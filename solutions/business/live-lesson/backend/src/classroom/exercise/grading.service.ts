import { Injectable } from '@nestjs/common';
import { AnswerKeySchema } from '../../schemas';
import type { AnswerKey, GradeResult } from '../../schemas';
import type { Grader } from './graders/grader.interface';
import { QuizGrader } from './graders/quiz.grader';
import { MatchGrader } from './graders/match.grader';
import { MatrixGrader } from './graders/matrix.grader';
import { StanceGrader } from './graders/stance.grader';
import { OrderGrader } from './graders/order.grader';
import { SelectEvidenceGrader } from './graders/select-evidence.grader';
import { MapGrader } from './graders/map.grader';
import { AiPromptBuilder } from '../ai-prompt-builder';

@Injectable()
export class GradingService {
  private readonly graders: Record<string, Grader>;

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
    this.graders = {
      quiz: new QuizGrader(),
      match: new MatchGrader(),
      matrix: new MatrixGrader(aiPromptBuilder),
      stance: new StanceGrader(),
      order: new OrderGrader(),
      'select-evidence': new SelectEvidenceGrader(),
      map: new MapGrader(aiPromptBuilder),
    };
  }

  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    if (!rawKey) return null;
    const parsed = AnswerKeySchema.safeParse(rawKey);
    if (!parsed.success) return null;
    const key: AnswerKey = parsed.data;
    const grader = this.graders[key.type];
    if (!grader) return null;
    return grader.grade(key, data);
  }
}
