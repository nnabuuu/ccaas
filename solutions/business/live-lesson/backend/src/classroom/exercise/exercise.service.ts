import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { GradingService } from './grading.service';
import { sanitizeAnswerKey } from '../../schemas/manifest.utils';
import type { ExerciseSpec, GradeResult } from '../../schemas';

@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly gradingService: GradingService,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async getExerciseSpec(session: ClassroomSession, step: number): Promise<ExerciseSpec> {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);
    if (!stepDef?.answerKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const spec = sanitizeAnswerKey(stepDef.answerKey, stepDef.exerciseLabel as string | undefined);
    if (!spec) throw new NotFoundException(`Unsupported exercise type at step ${step}`);
    return spec;
  }

  async checkAnswer(
    session: ClassroomSession,
    studentId: string,
    step: number,
    data: Record<string, unknown>,
  ): Promise<{ type: string; allCorrect: boolean; items: Array<Record<string, unknown>> }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);
    if (!stepDef?.answerKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const ak = stepDef.answerKey as Record<string, unknown>;
    const gradeResult = await this.gradingService.grade(ak, data as Record<string, unknown>);

    const items = gradeResult ? this.buildCheckItems(ak, data, gradeResult) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: ak.type as string, allCorrect, items };
  }

  buildCheckItems(
    ak: Record<string, unknown>,
    data: Record<string, unknown>,
    gradeResult: GradeResult,
  ): Array<Record<string, unknown>> {
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    const answers = ak.answers as Array<Record<string, unknown>> | undefined;
    const sections = ak.sections as Array<Record<string, unknown>> | undefined;

    switch (ak.type) {
      case 'quiz':
        return (answers || []).map((a) => {
          const correct = dimOk(gradeResult.byDimension?.[`q${a.questionIdx}`]);
          return {
            idx: a.questionIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
            ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
            ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          };
        });

      case 'match':
        return (answers || []).map((a) => {
          const correct = dimOk(gradeResult.byDimension?.[`p${a.pairIdx}`]);
          return {
            idx: a.pairIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
            ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
            ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          };
        });

      case 'matrix':
        return (answers || []).filter((a) => !a.isDemo).map((a) => {
          const place = gradeResult.byDimension?.place ?? 0;
          const practice = gradeResult.byDimension?.practice ?? 0;
          const reason = gradeResult.byDimension?.reason ?? 0;
          const correct = dimOk(place) && dimOk(practice) && dimOk(reason);
          return {
            idx: a.rowIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
          };
        });

      case 'stance': {
        const posCorrect = dimOk(gradeResult.byDimension?.position);
        const evCorrect = dimOk(gradeResult.byDimension?.evidence);
        return [
          { idx: 'position', correct: posCorrect },
          { idx: 'evidence', correct: evCorrect },
        ];
      }

      case 'order': {
        const orderItems = ak.items as string[];
        const correctOrder = (ak.correctOrder || []) as number[];
        const studentOrder = (data.order || []) as unknown[];
        return correctOrder.map((expectedIdx, pos) => {
          const expectedLabel = (orderItems[expectedIdx] ?? '').toLowerCase();
          const raw = studentOrder[pos];
          const studentLabel = typeof raw === 'string' ? raw.toLowerCase()
            : typeof raw === 'number' ? (orderItems[raw] ?? '').toLowerCase() : '';
          return { idx: pos, correct: studentLabel === expectedLabel };
        });
      }

      case 'select-evidence':
        return (sections || []).map((s) => {
          const sectionData = (data?.sections as Record<string, Record<string, unknown>> | undefined)?.[s.id as string];
          const functionCorrect = (sectionData?.function as string)?.toLowerCase() === (s.correctFunction as string)?.toLowerCase();
          return {
            idx: s.id,
            correct: functionCorrect,
            ...(!functionCorrect && s.hint && { hint: s.hint }),
            ...(!functionCorrect && s.hintZh && { hintZh: s.hintZh }),
            ...(functionCorrect && s.aiCorrect && { aiMessage: s.aiCorrect }),
            ...(!functionCorrect && s.aiPartial && { aiMessage: s.aiPartial }),
          };
        });

      case 'map': {
        const mapItems = ak.items as Array<Record<string, unknown>> | undefined;
        const practiceCount = ak.practiceCount as number | undefined;
        const itemsToCheck = practiceCount ? (mapItems || []).slice(0, practiceCount) : (mapItems || []);
        const result: Array<Record<string, unknown>> = itemsToCheck.map((it) => {
          const id = it.id as string;
          const placed = gradeResult.byDimension?.[`${id}_placed`] === true;
          const reasoned = gradeResult.byDimension?.[`${id}_reasoned`] === true;
          const posScore = (gradeResult.byDimension?.[`${id}_positionScore`] as number) ?? 0;
          return { idx: id, correct: placed && reasoned && posScore >= 50 };
        });
        if (gradeResult.llmFeedback) {
          result.push({ idx: '_llm', correct: true, hint: gradeResult.llmFeedback });
        }
        return result;
      }

      default:
        return [];
    }
  }
}
