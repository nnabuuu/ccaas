import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { GradingService } from './grading.service';
import { ExerciseTypeRegistry } from './exercise-type-registry';
import { ManifestCacheService } from '../manifest-cache.service';
import { sanitizeAnswerKey, seededShuffle } from '../../schemas/manifest.utils';
import type { ExerciseSpec, GradeResult } from '../../schemas';
import type { CheckResultResponse } from '../../schemas/classroom';

@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly gradingService: GradingService,
    private readonly registry: ExerciseTypeRegistry,
    private readonly manifestCache: ManifestCacheService,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async getExerciseSpec(session: ClassroomSession, step: number, studentId?: string, exerciseType?: string): Promise<ExerciseSpec> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');
    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);

    const rawKey = exerciseType === 'guided-discovery' ? stepDef?.discoveryKey : stepDef?.answerKey;
    if (!rawKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const ak = rawKey as Record<string, unknown>;
    let practiceItemIds: string[] | undefined;
    if (ak.type === 'map' && ak.randomPractice && ak.practiceCount && studentId) {
      // Validate studentId belongs to this session
      const student = await this.studentRepo.findOne({
        where: { id: studentId, sessionId: session.id },
      });
      if (!student) throw new NotFoundException('Student not found in this session');

      const items = (ak.items as Array<{ id: string }>) || [];
      const allIds = items.map(i => i.id);
      const shuffled = seededShuffle(allIds, `${studentId}:${step}`);
      practiceItemIds = shuffled.slice(0, ak.practiceCount as number);
    }

    const spec = sanitizeAnswerKey(rawKey, stepDef.exerciseLabel as string | undefined, practiceItemIds);
    if (!spec) throw new NotFoundException(`Unsupported exercise type at step ${step}`);
    return spec;
  }

  async checkAnswer(
    session: ClassroomSession,
    studentId: string,
    step: number,
    data: Record<string, unknown>,
    exerciseType?: string,
  ): Promise<CheckResultResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');

    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);

    // Use discoveryKey when exerciseType is 'guided-discovery', otherwise answerKey
    const rawKey = exerciseType === 'guided-discovery' ? stepDef?.discoveryKey : stepDef?.answerKey;
    if (!rawKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const ak = rawKey as Record<string, unknown>;

    // Server-side recompute of practiceItemIds — never trust client submission
    if (ak.type === 'map' && ak.randomPractice && ak.practiceCount) {
      const mapItems = (ak.items as Array<{ id: string }>) || [];
      const allIds = mapItems.map(i => i.id);
      const shuffled = seededShuffle(allIds, `${studentId}:${step}`);
      data.practiceItemIds = shuffled.slice(0, ak.practiceCount as number);
    }

    const gradeResult = await this.gradingService.grade(ak, data as Record<string, unknown>);

    const items = gradeResult ? (this.registry.buildCheckItems(ak, data, gradeResult) ?? []) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: ak.type as string, allCorrect, items };
  }
}
